import { BaseSmarterCrowdsourcingPairwiseAgent } from "../../base/scPairwiseAgent.js";
export class RankSolutionsAgent extends BaseSmarterCrowdsourcingPairwiseAgent {
    async voteOnPromptPair(subProblemIndex, promptPair) {
        const itemOneIndex = promptPair[0];
        const itemTwoIndex = promptPair[1];
        const solutionOne = this.allItems[subProblemIndex][itemOneIndex];
        const solutionTwo = this.allItems[subProblemIndex][itemTwoIndex];
        const messages = [
            this.createSystemMessage(`You're an expert in evaluating and ranking solution components to problems.

         Instructions:
         1. Analyze a problem and two solution components, labeled "Solution Component One" and "Solution Component Two"
         2. Determine which is more important and practical.
         ${this.customInstructionsRankSolutions
                ? `
           Important Instructions: ${this.customInstructionsRankSolutions}
           `
                : ""}

         Always output your decision as "One", "Two" or "Neither". No explanation is necessary.
         Let's think step by step.
        `),
            this.createHumanMessage(`${this.renderSubProblem(subProblemIndex, true)}

        Solution Components to assess:

        Solution Component One:
        ${solutionOne.title}
        ${solutionOne.description}

        ${solutionOne.pros
                ? `
        Top Pro for Solution Component One:
        ${solutionOne.pros[0].description}
        `
                : ""}

        ${solutionOne.cons
                ? `
        Top Con for Solution Component One:
        ${solutionOne.cons[0].description}
        `
                : ""}

        Solution Component Two:
        ${solutionTwo.title}
        ${solutionTwo.description}

        ${solutionTwo.pros
                ? `
        Top Pro for Solution Component Two:
        ${solutionTwo.pros[0].description}
        `
                : ""}

        ${solutionTwo.cons
                ? `
        Top Con for Solution Component Two:
        ${solutionTwo.cons[0].description}
        `
                : ""}

        The more important and practial solution component is:
        `),
        ];
        return await this.getResultsFromLLM(subProblemIndex, messages, itemOneIndex, itemTwoIndex);
    }
    async processSubProblem(subProblemIndex) {
        const lastPopulationIndex = this.lastPopulationIndex(subProblemIndex);
        this.logger.info(`Ranking solution components for sub problem ${subProblemIndex} population ${lastPopulationIndex}`);
        this.setupRankingPrompts(subProblemIndex, this.getActiveSolutionsLastPopulation(subProblemIndex), this.minimumNumberOfPairwiseVotesForPopulation *
            this.getActiveSolutionsLastPopulation(subProblemIndex).length);
        await this.performPairwiseRanking(subProblemIndex);
        this.memory.subProblems[subProblemIndex].solutions.populations[lastPopulationIndex] = this.getOrderedListOfItems(subProblemIndex, true);
        await this.saveMemory();
    }
    async process() {
        this.logger.info("Rank Solution Components Agent");
        super.process();
        try {
            const subProblemsPromises = Array.from({
                length: Math.min(this.memory.subProblems.length, this.maxSubProblems),
            }, async (_, subProblemIndex) => this.processSubProblem(subProblemIndex));
            await Promise.all(subProblemsPromises);
            this.logger.info("Rank Solution Components Agent Completed");
        }
        catch (error) {
            this.logger.error("Error in Rank Solution Components Agent");
            this.logger.error(error);
            throw error;
        }
    }
}
//# sourceMappingURL=rankSolutions.js.map