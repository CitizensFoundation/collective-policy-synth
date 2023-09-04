import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { IEngineConstants } from "../../../constants.js";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";
import ioredis from "ioredis";
import { GetEvidenceWebPagesProcessor } from "./getEvidenceWebPages.js";
const redis = new ioredis.default(process.env.REDIS_MEMORY_URL || "redis://localhost:6379");
//@ts-ignore
puppeteer.use(StealthPlugin());
export class GetRefinedEvidenceProcessor extends GetEvidenceWebPagesProcessor {
    renderEvidenceScanningPrompt(subProblemIndex, policy, type, text) {
        return [
            new SystemChatMessage(`You are an expert in analyzing policy evidence:

        Important Instructions:
        1. Examine the "<text context>" and analyze the evidence on how it relates to the problem and the specified policy proposal.
        2. Always rank JSON string[] output in importance to policy proposal.
        3. Output scores in the ranges of 0-100.
        4. Keep all texts clear and simple.
        5. relevanceToPolicyProposal should outline how the evidence found in the text is relevant to the policy proposal.
        6. mostRelevantParagraphs should be direct quotes from the most relevant and important paragraphs, in relation to the policy proposal, found in the text context, the most relevant paragraph should be first.
        7. Instead of referring to "The text" refer to "The website".
        8. Always output your results in the following JSON format:
        {
          relevanceToPolicyProposal: string;
          mostRelevantParagraphs: string[];
          summary: string;
          mostImportantPolicyEvidenceInTextContext: string[];
          prosForPolicyFoundInTextContext: string[],
          consForPolicyFoundInTextContext: string[],
          whatPolicyNeedsToImplementInResponseToEvidence: string[];
          risksForPolicy: string[];
          evidenceAcademicSources: string[];
          evidenceOrganizationSources: string[];
          evidenceHumanSources: string[];
          confidenceScore: number;
          relevanceToTypeScore: number;
          relevanceScore: number;
          qualityScore: number;
        }`),
            new HumanChatMessage(`
        ${this.renderSubProblem(subProblemIndex, true)}

        Policy Proposal:
        ${policy.title}
        ${policy.description}

        Policy Evidence Type: ${type}

        <text context>
        ${text}
        </text context>

        Let's think step by step.

        JSON Output:
        `),
        ];
    }
    async getEvidenceTextAnalysis(subProblemIndex, policy, type, text) {
        try {
            const { totalTokenCount, promptTokenCount } = await this.getEvidenceTokenCount(text, subProblemIndex, policy, type);
            this.logger.debug(`Total token count: ${totalTokenCount} Prompt token count: ${JSON.stringify(promptTokenCount)}`);
            let textAnalysis;
            if (IEngineConstants.getRefinedEvidenceModel.tokenLimit < totalTokenCount) {
                const maxTokenLengthForChunk = IEngineConstants.getRefinedEvidenceModel.tokenLimit -
                    promptTokenCount.totalCount -
                    64;
                this.logger.debug(`Splitting text into chunks of ${maxTokenLengthForChunk} tokens`);
                const splitText = await this.splitText(text, maxTokenLengthForChunk, subProblemIndex);
                this.logger.debug(`Got ${splitText.length} splitTexts`);
                for (let t = 0; t < splitText.length; t++) {
                    const currentText = splitText[t];
                    let nextAnalysis = await this.getRefinedEvidenceTextAIAnalysis(subProblemIndex, policy, type, currentText);
                    if (nextAnalysis) {
                        if (t == 0) {
                            textAnalysis = nextAnalysis;
                        }
                        else {
                            textAnalysis = this.mergeRefinedAnalysisData(textAnalysis, nextAnalysis);
                        }
                        this.logger.debug(`Refined evidence text analysis (${t}): ${JSON.stringify(textAnalysis, null, 2)}`);
                    }
                    else {
                        this.logger.error(`Error getting AI analysis for text ${currentText}`);
                    }
                }
            }
            else {
                textAnalysis = await this.getRefinedEvidenceTextAIAnalysis(subProblemIndex, policy, type, text);
                this.logger.debug(`Text analysis ${JSON.stringify(textAnalysis, null, 2)}`);
            }
            return textAnalysis;
        }
        catch (error) {
            this.logger.error(`Error in getTextAnalysis: ${error}`);
            throw error;
        }
    }
    async getRefinedEvidenceTextAIAnalysis(subProblemIndex, policy, type, text) {
        this.logger.info("Get Refined Evidence AI Analysis");
        const messages = this.renderEvidenceScanningPrompt(subProblemIndex, policy, type, text);
        const analysis = (await this.callLLM("web-get-refined-evidence", IEngineConstants.getRefinedEvidenceModel, messages, true, true));
        return analysis;
    }
    mergeRefinedAnalysisData(data1, data2) {
        return {
            mostRelevantParagraphs: [
                ...(data1.mostRelevantParagraphs || []),
                ...(data2.mostRelevantParagraphs || []),
            ],
            whatPolicyNeedsToImplementInResponseToEvidence: [
                ...(data1.whatPolicyNeedsToImplementInResponseToEvidence || []),
                ...(data2.whatPolicyNeedsToImplementInResponseToEvidence || []),
            ],
            mostImportantPolicyEvidenceInTextContext: [
                ...(data1.mostImportantPolicyEvidenceInTextContext || []),
                ...(data2.mostImportantPolicyEvidenceInTextContext || []),
            ],
            evidenceAcademicSources: [
                ...(data1.evidenceAcademicSources || []),
                ...(data2.evidenceAcademicSources || []),
            ],
            evidenceOrganizationSources: [
                ...(data1.evidenceOrganizationSources || []),
                ...(data2.evidenceOrganizationSources || []),
            ],
            evidenceHumanSources: [
                ...(data1.evidenceHumanSources || []),
                ...(data2.evidenceHumanSources || []),
            ],
            prosForPolicyFoundInTextContext: [
                ...(data1.prosForPolicyFoundInTextContext || []),
                ...(data2.prosForPolicyFoundInTextContext || []),
            ],
            consForPolicyFoundInTextContext: [
                ...(data1.consForPolicyFoundInTextContext || []),
                ...(data2.consForPolicyFoundInTextContext || []),
            ],
            risksForPolicy: [
                ...(data1.risksForPolicy || []),
                ...(data2.risksForPolicy || []),
            ],
            relevanceToPolicyProposal: data1.relevanceToPolicyProposal,
            relevanceToTypeScore: data1.relevanceToTypeScore,
            confidenceScore: data1.confidenceScore,
            relevanceScore: data1.relevanceScore,
            qualityScore: data1.qualityScore,
            totalScore: data1.totalScore,
            summary: data1.summary,
            hasBeenRefined: true
        };
    }
    async processPageText(text, subProblemIndex, url, type, entityIndex, policy = undefined) {
        this.logger.debug(`Processing page text ${text.slice(0, 150)} for ${url} for ${type} search results ${subProblemIndex} sub problem index`);
        try {
            const refinedAnalysis = (await this.getEvidenceTextAnalysis(subProblemIndex, policy, type, text));
            if (refinedAnalysis) {
                this.logger.debug(`Saving refined analysis ${JSON.stringify(refinedAnalysis, null, 2)}`);
                refinedAnalysis.hasBeenRefined = true;
                try {
                    await this.evidenceWebPageVectorStore.updateRefinedAnalysis(policy.vectorStoreId, refinedAnalysis);
                    this.totalPagesSave += 1;
                    this.logger.info(`Total ${this.totalPagesSave} saved pages`);
                }
                catch (e) {
                    this.logger.error(`Error posting web page for url ${url}`);
                    this.logger.error(e);
                    this.logger.error(e.stack);
                }
            }
            else {
                this.logger.warn(`No text analysis for ${url}`);
            }
        }
        catch (e) {
            this.logger.error(`Error in processPageText`);
            this.logger.error(e.stack || e);
        }
    }
    async getAndProcessEvidencePage(subProblemIndex, url, browserPage, type, policy) {
        if (url.toLowerCase().endsWith(".pdf")) {
            await this.getAndProcessPdf(subProblemIndex, url, type, undefined, policy);
        }
        else {
            await this.getAndProcessHtml(subProblemIndex, url, browserPage, type, undefined, policy);
        }
        return true;
    }
    simplifyEvidenceType(evidenceType) {
        let type = evidenceType
            .replace(/allPossible/g, "")
            .replace(/IdentifiedInTextContext/g, "");
        // Make the first character of type lowercase
        type = type.charAt(0).toLowerCase() + type.slice(1);
        return type;
    }
    async refineWebEvidence(policy, subProblemIndex, page) {
        const limit = 10;
        try {
            for (const evidenceType of IEngineConstants.policyEvidenceFieldTypes) {
                const searchType = this.simplifyEvidenceType(evidenceType);
                const results = await this.evidenceWebPageVectorStore.getTopPagesForProcessing(this.memory.groupId, subProblemIndex, policy.title, searchType, limit);
                this.logger.debug(`Got ${results.data.Get["EvidenceWebPage"].length} WebPage results from Weaviate`);
                if (results.data.Get["EvidenceWebPage"].length === 0) {
                    this.logger.error(`No results for ${policy.title} ${searchType}`);
                    continue;
                }
                let pageCounter = 0;
                for (const retrievedObject of results.data.Get["EvidenceWebPage"]) {
                    const webPage = retrievedObject;
                    const id = webPage._additional.id;
                    policy.vectorStoreId = id;
                    await this.getAndProcessEvidencePage(subProblemIndex, webPage.url, page, searchType, policy);
                    this.logger.info(`${subProblemIndex} - (+${pageCounter++}) - ${id} - Updated`);
                }
            }
        }
        catch (error) {
            this.logger.error(error.stack || error);
            throw error;
        }
    }
    async processSubProblems(browser) {
        const subProblemsLimit = 1; /*Math.min(
          this.memory.subProblems.length,
          IEngineConstants.maxSubProblems
        );*/
        const skipSubProblemsIndexes = [];
        const currentGeneration = 0;
        const subProblemsPromises = Array.from({ length: subProblemsLimit }, async (_, subProblemIndex) => {
            this.logger.info(`Refining evidence for sub problem ${subProblemIndex}`);
            const newPage = await browser.newPage();
            newPage.setDefaultTimeout(IEngineConstants.webPageNavTimeout);
            newPage.setDefaultNavigationTimeout(IEngineConstants.webPageNavTimeout);
            await newPage.setUserAgent(IEngineConstants.currentUserAgent);
            const subProblem = this.memory.subProblems[subProblemIndex];
            if (!skipSubProblemsIndexes.includes(subProblemIndex)) {
                if (subProblem.policies) {
                    const policies = subProblem.policies.populations[currentGeneration];
                    for (let p = 0; p <
                        Math.min(policies.length, IEngineConstants.maxTopPoliciesToProcess); p++) {
                        const policy = policies[p];
                        try {
                            await this.refineWebEvidence(policy, subProblemIndex, newPage);
                            this.logger.debug(`Finished ranking sub problem ${subProblemIndex} for policy ${policy}`);
                        }
                        catch (error) {
                            this.logger.error(error.stack || error);
                            throw error;
                        }
                    }
                }
            }
            else {
                this.logger.info(`Skipping sub problem ${subProblemIndex}`);
            }
        });
        await Promise.all(subProblemsPromises);
        this.logger.info("Finished rating all web evidence");
    }
    async getAllPages() {
        const browser = await puppeteer.launch({ headless: "new" });
        this.logger.debug("Launching browser");
        const browserPage = await browser.newPage();
        browserPage.setDefaultTimeout(IEngineConstants.webPageNavTimeout);
        browserPage.setDefaultNavigationTimeout(IEngineConstants.webPageNavTimeout);
        await browserPage.setUserAgent(IEngineConstants.currentUserAgent);
        await this.processSubProblems(browser);
        await this.saveMemory();
        await browser.close();
        this.logger.info("Browser closed");
    }
    async process() {
        this.logger.info("Refined Evidence Web Pages Processor");
        //super.process();
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.getRefinedEvidenceModel.temperature,
            maxTokens: IEngineConstants.getRefinedEvidenceModel.maxOutputTokens,
            modelName: IEngineConstants.getRefinedEvidenceModel.name,
            verbose: IEngineConstants.getRefinedEvidenceModel.verbose,
        });
        await this.getAllPages();
        this.logger.info(`Refined ${this.totalPagesSave} pages`);
        this.logger.info("Refine Evidence Web Pages Processor Complete");
    }
}
