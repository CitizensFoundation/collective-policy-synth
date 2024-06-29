import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import ioredis from "ioredis";
import { SmarterCrowdsourcingGetWebPagesAgent } from "../../solutions/web/getWebPages.js";
import { RootCauseWebPageVectorStore } from "../../../../vectorstore/rootCauseWebPage.js";
import { CreateRootCausesSearchQueriesAgent } from "../create/createRootCauseSearchQueries.js";
import { PsAiModelType } from "../../../../aiModelTypes.js";
const redis = new ioredis(process.env.REDIS_MEMORY_URL || "redis://localhost:6379");
//@ts-ignore
puppeteer.use(StealthPlugin());
const onlyCheckWhatNeedsToBeScanned = true;
class RootCauseTypeLookup {
    static rootCauseTypeMapping = {
        historicalRootCause: "allPossibleHistoricalRootCausesIdentifiedInTextContext",
        economicRootCause: "allPossibleEconomicRootCausesIdentifiedInTextContext",
        scientificRootCause: "allPossibleScientificRootCausesIdentifiedInTextContext",
        culturalRootCause: "allPossibleCulturalRootCausesIdentifiedInTextContext",
        socialRootCause: "allPossibleSocialRootCausesIdentifiedInTextContext",
        environmentalRootCause: "allPossibleEnvironmentalRootCausesIdentifiedInTextContext",
        legalRootCause: "allPossibleLegalRootCausesIdentifiedInTextContext",
        technologicalRootCause: "allPossibleTechnologicalRootCausesIdentifiedInTextContext",
        geopoliticalRootCause: "allPossibleGeopoliticalRootCausesIdentifiedInTextContext",
        ethicalRootCause: "allPossibleEthicalRootCausesIdentifiedInTextContext",
        caseStudies: "allPossibleRootCausesCaseStudiesIdentifiedInTextContext",
        //TODO: Figure this out better than doubling up on socialRootCause
        adminSubmitted: "allPossibleSocialRootCausesIdentifiedInTextContext",
    };
    static getPropertyName(rootCauseType) {
        return this.rootCauseTypeMapping[rootCauseType];
    }
}
export class GetRootCausesWebPagesAgent extends SmarterCrowdsourcingGetWebPagesAgent {
    rootCauseWebPageVectorStore = new RootCauseWebPageVectorStore();
    hasPrintedPrompt = false;
    outputInLanguage = "English";
    processesUrls = new Set();
    renderRootCauseScanningPrompt(type, text) {
        return [
            this.createSystemMessage(`You are an expert in identifying and analyzing root causes for a particular problem statement in a given text context.

        Important Instructions:
        1. Take a deep breath and examine the contents of the "<textContext>" section in detail, identify all specific root causes in the <textContext> that could be causes of the problem statement presented by the user.
        2. Always output your results in the following JSON format:
         [
            {
              rootCauseDescription: string;
              rootCauseTitle: string;
              rootCauseDescriptionForPairwiseRanking: string;
              whyRootCauseIsImportant: string;
              yearPublished?: number;
              rootCauseRelevanceScore: number;
              rootCauseQualityScore: number;
            }
          ]
        3. rootCauseDescription should describe each root cause in full in one to two paragraphs.
        4. rootCauseDescriptionForPairwiseRanking should provide a standalone description of each root cause in around 10-20 words.
        5. Never use acronyms in rootCauseDescription even if they are used in the text context.
        6. Never use the words "is a root cause" in the rootCauseDescription.
        7. Make sure to explain how the root cause relateds to the problem statement in the rootCauseDescription.
        8. Output scores in the ranges of 0-100 for the score JSON attributes.
        9. Try to establish when the text was published and include in the yearPublished field if you find it.
        10. If you do not find any relevant root causes in the <textContext> then just output an empty JSON array, never make up your own root causes.
        ${this.outputInLanguage
                ? `11. Always output text in the ${this.outputInLanguage} language even if the <textContext> is in a different language.`
                : ""}
        `),
            this.createHumanMessage(`
        ${this.renderProblemStatement()}

        <textContext>
        ${text}
        </textContext>

        JSON Output:
        `),
        ];
    }
    async getRootCauseTokenCount(text, type) {
        const emptyMessages = this.renderRootCauseScanningPrompt(type, "");
        const promptTokenCount = await this.getTokensFromMessages(emptyMessages);
        const textForTokenCount = this.createHumanMessage(text);
        const textTokenCount = await this.getTokensFromMessages([
            textForTokenCount,
        ]);
        const totalTokenCount = promptTokenCount +
            textTokenCount +
            this.maxModelTokensOut;
        return { totalTokenCount, promptTokenCount };
    }
    async getRootCauseTextAnalysis(type, text, url) {
        try {
            const { totalTokenCount, promptTokenCount } = await this.getRootCauseTokenCount(text, type);
            this.logger.debug(`Total token count: ${totalTokenCount} Prompt token count: ${JSON.stringify(promptTokenCount)}`);
            this.logger.debug(`Searching ${url}...`);
            let textAnalysis;
            if (this.tokenInLimit < totalTokenCount) {
                const maxTokenLengthForChunk = this.tokenInLimit -
                    promptTokenCount -
                    512;
                this.logger.debug(`Splitting text into chunks of ${maxTokenLengthForChunk} tokens`);
                const splitText = this.splitText(text, maxTokenLengthForChunk, undefined);
                this.logger.debug(`Got ${splitText.length} splitTexts`);
                for (let t = 0; t < splitText.length; t++) {
                    const currentText = splitText[t];
                    let nextAnalysis = await this.getRootCauseAIAnalysis(type, currentText);
                    if (nextAnalysis) {
                        for (let rootCause of nextAnalysis) {
                            this.logger.debug(`Root Cause: ${JSON.stringify(rootCause, null, 2)}`);
                            if (rootCause.rootCauseTitle && rootCause.rootCauseDescription) {
                                this.memory.subProblems.push({
                                    title: rootCause.rootCauseTitle,
                                    description: rootCause.rootCauseDescription,
                                    whyIsSubProblemImportant: rootCause.whyRootCauseIsImportant,
                                    shortDescriptionForPairwiseRanking: rootCause.rootCauseDescriptionForPairwiseRanking,
                                    yearPublished: rootCause.yearPublished,
                                    fromSearchType: type,
                                    fromUrl: url,
                                    relevanceScore: rootCause.rootCauseRelevanceScore,
                                    qualityScore: rootCause.rootCauseQualityScore,
                                    confidenceScore: rootCause.rootCauseConfidenceScore,
                                    solutions: {
                                        populations: [],
                                    },
                                    entities: [],
                                    searchQueries: {
                                        general: [],
                                        scientific: [],
                                        news: [],
                                        openData: [],
                                    },
                                    searchResults: {
                                        pages: {
                                            general: [],
                                            scientific: [],
                                            news: [],
                                            openData: [],
                                        },
                                    },
                                });
                            }
                            else {
                                this.logger.warn(`No title or description found for ${JSON.stringify(rootCause, null, 2)}`);
                            }
                        }
                    }
                    else {
                        this.logger.error(`Error getting AI analysis for text ${currentText}`);
                    }
                }
            }
            else {
                textAnalysis = await this.getRootCauseAIAnalysis(type, text);
                for (let rootCause of textAnalysis) {
                    this.logger.debug(`Root Cause: ${JSON.stringify(rootCause, null, 2)}`);
                    if (rootCause.rootCauseTitle && rootCause.rootCauseDescription) {
                        this.memory.subProblems.push({
                            title: rootCause.rootCauseTitle,
                            description: rootCause.rootCauseDescription,
                            whyIsSubProblemImportant: rootCause.whyRootCauseIsImportant,
                            shortDescriptionForPairwiseRanking: rootCause.rootCauseDescriptionForPairwiseRanking,
                            yearPublished: rootCause.yearPublished,
                            fromSearchType: type,
                            fromUrl: url,
                            relevanceScore: rootCause.rootCauseRelevanceScore,
                            qualityScore: rootCause.rootCauseQualityScore,
                            confidenceScore: rootCause.rootCauseConfidenceScore,
                            solutions: {
                                populations: [],
                            },
                            entities: [],
                            searchQueries: {
                                general: [],
                                scientific: [],
                                news: [],
                                openData: [],
                            },
                            searchResults: {
                                pages: {
                                    general: [],
                                    scientific: [],
                                    news: [],
                                    openData: [],
                                },
                            },
                        });
                    }
                    else {
                        this.logger.warn(`No title or description found for ${JSON.stringify(rootCause, null, 2)}`);
                    }
                }
                //this.logger.debug(
                //  `Text analysis ${JSON.stringify(textAnalysis, null, 2)}`
                //);
            }
            return textAnalysis;
        }
        catch (error) {
            this.logger.error(`Error in getTextAnalysis: ${error}`);
            throw error;
        }
    }
    async getRootCauseAIAnalysis(type, text) {
        this.logger.info("Get Root Cause AI Analysis");
        const messages = this.renderRootCauseScanningPrompt(type, text);
        if (!this.hasPrintedPrompt) {
            console.log(JSON.stringify(messages, null, 2));
            this.hasPrintedPrompt = true;
        }
        const analysis = (await this.callModel(PsAiModelType.Text, messages, true, true));
        return analysis;
    }
    isUrlInSubProblemMemory(url) {
        for (let subProblem of this.memory.subProblems) {
            if (subProblem.fromUrl == url) {
                return true;
            }
        }
        return false;
    }
    async processPageText(text, subProblemIndex = undefined, url, type, entityIndex, policy = undefined) {
        if (this.processesUrls.has(url)) {
            this.logger.info(`Already processed ${url}`);
            return;
        }
        else {
            this.processesUrls.add(url);
        }
        if (this.isUrlInSubProblemMemory(url)) {
            this.logger.info(`Already in memory ${url}`);
            this.processesUrls.add(url);
            return;
        }
        this.logger.debug(`Processing page text ${text.slice(0, 150)} for ${url} for ${type} search results (total urls processed ${this.processesUrls.size})`);
        try {
            const textAnalysis = (await this.getRootCauseTextAnalysis(type, text, url));
            await this.saveMemory();
        }
        catch (e) {
            this.logger.error(`Error in processPageText`);
            this.logger.error(e.stack || e);
        }
    }
    async getAndProcessRootCausePage(url, browserPage, type) {
        if (url ==
            "https://www.oecd.org/pisa/PISA%202018%20Insights%20and%20Interpretations%20FINAL%20PDF.pdf") {
            this.logger.info("Skipping the current url:" + url);
            return true;
        }
        if (url.toLowerCase().endsWith(".pdf")) {
            await this.getAndProcessPdf(undefined, url, type, undefined);
        }
        else {
            await this.getAndProcessHtml(undefined, url, browserPage, type, undefined);
        }
        return true;
    }
    async processRootCauses(browser) {
        const problemStatement = this.memory.problemStatement;
        const browserPage = await browser.newPage();
        browserPage.setDefaultTimeout(this.webPageNavTimeout);
        browserPage.setDefaultNavigationTimeout(this.webPageNavTimeout);
        await browserPage.setUserAgent(this.currentUserAgent);
        const clearSubProblems = false;
        if (clearSubProblems) {
            this.memory.subProblems = [];
        }
        if (this.memory.customInstructions.rootCauseUrlsToScan) {
            this.logger.info(`Processing custom urls... ${JSON.stringify(this.memory.customInstructions.rootCauseUrlsToScan, null, 2)}`);
            for (const url of this.memory.customInstructions.rootCauseUrlsToScan) {
                this.logger.info(`Processing ${url}`);
                if (this.isUrlInSubProblemMemory(url)) {
                    this.logger.info(`Already in memory ${url}`);
                    this.processesUrls.add(url);
                    continue;
                }
                await this.getAndProcessRootCausePage(url, browserPage, "adminSubmitted");
            }
        }
        for (const searchResultType of CreateRootCausesSearchQueriesAgent.rootCauseWebPageTypesArray) {
            let urlsToGet = problemStatement.rootCauseSearchResults[searchResultType];
            if (urlsToGet) {
                urlsToGet = urlsToGet.slice(0, Math.floor(urlsToGet.length *
                    this.maxRootCausePercentOfSearchResultWebPagesToGet));
                for (let i = 0; i < urlsToGet.length; i++) {
                    await this.getAndProcessRootCausePage(urlsToGet[i].url, browserPage, searchResultType);
                }
            }
            else {
                console.error(`No urls to get for ${searchResultType} (${this.lastPopulationIndex})`);
            }
            await this.saveMemory();
        }
        await browserPage.close();
        this.logger.info("Finished and closed page for current problem");
    }
    async getAllPages() {
        const browser = await puppeteer.launch({ headless: true });
        this.logger.debug("Launching browser");
        const browserPage = await browser.newPage();
        browserPage.setDefaultTimeout(this.webPageNavTimeout);
        browserPage.setDefaultNavigationTimeout(this.webPageNavTimeout);
        await browserPage.setUserAgent(this.currentUserAgent);
        await this.processRootCauses(browser);
        await this.saveMemory();
        await browser.close();
        this.logger.info("Browser closed");
    }
    async process() {
        this.logger.info("Get Root Cause Web Pages Agent");
        super.process();
        await this.getAllPages();
        this.logger.info(`Saved ${this.totalPagesSave} pages`);
        this.logger.info("Get Root Cause Web Pages Agent Complete");
    }
}
//# sourceMappingURL=getRootCausesWebPages.js.map