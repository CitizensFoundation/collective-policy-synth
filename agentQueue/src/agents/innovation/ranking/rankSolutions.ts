import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";

import { IEngineConstants } from "../../../constants.js";
import { BasePairwiseRankingsProcessor } from "./basePairwiseRanking.js";

export class RankSolutionsProcessor extends BasePairwiseRankingsProcessor {
  getProCons(prosCons: IEngineProCon[] | undefined) {
    if (prosCons && prosCons.length > 0) {
      return prosCons.map((proCon) => proCon.description);
    } else {
      return [];
    }
  }

  async voteOnPromptPair(
    subProblemIndex: number,
    promptPair: number[]
  ): Promise<IEnginePairWiseVoteResults> {
    const itemOneIndex = promptPair[0];
    const itemTwoIndex = promptPair[1];

    const solutionOne = this.allItems![subProblemIndex]![
      itemOneIndex
    ] as IEngineSolution;
    const solutionTwo = this.allItems![subProblemIndex]![
      itemTwoIndex
    ] as IEngineSolution;

    const messages = [
      new SystemChatMessage(
        `You are an expert in comparing and assessing solutions to problems.

         Instructions:
         1. You will be presented with a problem and two corresponding solutions. These will be labelled "Solution One" and "Solution Two".
         2. Assess which of the two solutions is more important in relation to the problem.
         3. Consider the best pro and con of each solution while assessing.
         ${this.memory.customInstructions.rankSolutions ? `
           Important Instructions: ${this.memory.customInstructions.rankSolutions}
           ` : '' }

         Always output your decision as "One", "Two" or "Neither. No explanation is necessary.
         Think step by step.
        `
      ),
      new HumanChatMessage(
        `
        ${this.renderSubProblem(subProblemIndex, true)}

        Solutions to assess:

        Solution One:
        ${solutionOne.title}
        ${solutionOne.description}

        Best Pro:
        ${this.getProCons(solutionOne.pros as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        Best Con:
        ${this.getProCons(solutionOne.cons as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        Solution Two:
        ${solutionTwo.title}
        ${solutionTwo.description}

        Best Pro:
        ${this.getProCons(solutionTwo.pros as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        Best Con:
        ${this.getProCons(solutionTwo.cons as IEngineProCon[]).slice(
          0,
          IEngineConstants.maxTopProsConsUsedForRanking
        )}

        The more important solution is:
        `
      ),
    ];

    return await this.getResultsFromLLM(
      subProblemIndex,
      "rank-solutions",
      IEngineConstants.solutionsRankingsModel,
      messages,
      itemOneIndex,
      itemTwoIndex
    );
  }

  async processSubProblem(subProblemIndex: number) {
    const currentPopulationIndex = this.currentPopulationIndex(subProblemIndex);
    this.logger.info(
      `Ranking solutions for sub problem ${subProblemIndex} population ${currentPopulationIndex}`
    );

    this.setupRankingPrompts(
      subProblemIndex,
      this.memory.subProblems[subProblemIndex].solutions.populations[
        currentPopulationIndex
      ]
    );

    await this.performPairwiseRanking(subProblemIndex);

    this.logger.debug(
      `Population Solutions before ranking: ${JSON.stringify(
        this.memory.subProblems[subProblemIndex].solutions.populations[
          currentPopulationIndex
        ]
      )}`
    );

    this.memory.subProblems[subProblemIndex].solutions.populations[
      currentPopulationIndex
    ] = this.getOrderedListOfItems(subProblemIndex, true) as IEngineSolution[];

    this.logger.debug(
      `Popuplation Solutions after ranking: ${JSON.stringify(
        this.memory.subProblems[subProblemIndex].solutions.populations[
          currentPopulationIndex
        ]
      )}`
    );

    await this.saveMemory();
  }

  async process() {
    this.logger.info("Rank Solutions Processor");
    super.process();

    try {
      this.chat = new ChatOpenAI({
        temperature: IEngineConstants.solutionsRankingsModel.temperature,
        maxTokens: IEngineConstants.solutionsRankingsModel.maxOutputTokens,
        modelName: IEngineConstants.solutionsRankingsModel.name,
        verbose: IEngineConstants.solutionsRankingsModel.verbose,
      });

      const subProblemsPromises = Array.from(
        {
          length: Math.min(
            this.memory.subProblems.length,
            IEngineConstants.maxSubProblems
          ),
        },
        async (_, subProblemIndex) => this.processSubProblem(subProblemIndex)
      );

      await Promise.all(subProblemsPromises);
      this.logger.info("Rank Solutions Processor Completed");
    } catch (error) {
      this.logger.error("Error in Rank Solutions Processor");
      this.logger.error(error);
      throw error;
    }
  }
}
