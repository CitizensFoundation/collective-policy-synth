import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage, SystemMessage } from "langchain/schema";
import { IEngineConstants } from "../../constants.js";
import { BasePairwiseRankingsProcessor } from "../../basePairwiseRanking.js";
export class RankSubProblemsProcessor extends BasePairwiseRankingsProcessor {
    constructor() {
        super(...arguments);
        this.subProblemIndex = 0;
    }
    async voteOnPromptPair(subProblemIndex, promptPair) {
        const itemOneIndex = promptPair[0];
        const itemTwoIndex = promptPair[1];
        const itemOne = this.allItems[subProblemIndex][itemOneIndex];
        const itemTwo = this.allItems[subProblemIndex][itemTwoIndex];
        const messages = [
            new SystemMessage(`
        You are an AI expert trained to analyse complex problem statements and associated sub-problems to determine their relevance.

        Instructions:
        1. You will be presented with a problem statement and two associated sub-problems. These will be marked as "Sub Problem One" and "Sub Problem Two".
        2. Analyse, compare, and rank these two sub-problems in relation to the main problem statement to determine which is more relevant and important.
        3. Output your decision as either "One", "Two" or "Neither". An explanation is not required.

        ${this.memory.customInstructions.rankSubProblems
                ? `
          Important Instructions: ${this.memory.customInstructions.rankSubProblems}
          `
                : ""}

        Let's think step by step.
        `),
            new HumanMessage(`
        ${this.renderProblemStatement()}

        Sub-Problems for Consideration:

        Sub Problem One:
        ${itemOne.title}
        ${itemOne.description}
        ${itemOne.whyIsSubProblemImportant}

        Sub Problem Two:
        ${itemTwo.title}
        ${itemTwo.description}
        ${itemTwo.whyIsSubProblemImportant}

        The Most Relevant Sub-Problem Is:
        `),
        ];
        return await this.getResultsFromLLM(subProblemIndex, "rank-sub-problems", IEngineConstants.subProblemsRankingsModel, messages, itemOneIndex, itemTwoIndex);
    }
    async process() {
        this.logger.info("Rank Sub Problems Processor");
        super.process();
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.subProblemsRankingsModel.temperature,
            maxTokens: IEngineConstants.subProblemsRankingsModel.maxOutputTokens,
            modelName: IEngineConstants.subProblemsRankingsModel.name,
            verbose: IEngineConstants.subProblemsRankingsModel.verbose,
        });
        let maxPrompts;
        if (this.memory.subProblems.length > 100) {
            maxPrompts = this.memory.subProblems.length * IEngineConstants.subProblemsRankingMinNumberOfMatches;
        }
        this.setupRankingPrompts(-1, this.memory.subProblems, maxPrompts);
        await this.performPairwiseRanking(-1);
        this.logger.debug(`Sub problems before ranking: ${JSON.stringify(this.memory.subProblems)}`);
        this.memory.subProblems = this.getOrderedListOfItems(-1, true);
        this.logger.debug(`Sub problems after ranking: ${JSON.stringify(this.memory.subProblems)}`);
        await this.saveMemory();
    }
}
//# sourceMappingURL=rankSubProblems.js.map