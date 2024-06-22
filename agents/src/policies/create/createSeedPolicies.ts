import { BaseProblemSolvingAgent } from "../../base/baseProblemSolvingAgent.js";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PsConstants } from "../../constants.js";

export class CreateSeedPoliciesProcessor extends BaseProblemSolvingAgent {
  renderCurrentSolution(solution: PsSolution) {
    return `
      Solution Component:

      Title: ${solution.title}

      Description: ${solution.description}

      Main benefit: ${solution.mainBenefitOfSolutionComponent}

      Main obstacle: ${solution.mainObstacleToSolutionComponentAdoption}

      Best pros:
      ${this.getProCons(solution.pros as PsProCon[]).slice(
        0,
        PsConstants.maxTopProsConsUsedForRating
      )}

      Best cons:
      ${this.getProCons(solution.cons as PsProCon[]).slice(
        0,
        PsConstants.maxTopProsConsUsedForRating
      )}
    `;
  }

  async renderCreatePrompt(subProblemIndex: number, solution: PsSolution) {
    const messages = [
      new SystemMessage(
        `
        You are an expert in creating concrete policy proposal from a solution.

        General instructions:
        1. Use the provided solution and problem statement to create 7 variations of how this solution can be turned into a full policy proposal.
        2. Use exactly the core ideas from the provided solution but try out different framing for each of the 7.
        3. The titles should stand alone, be professional and not include "Policy proposal", "Policy action", etc.
        4. The audience for those policy proposal are policymakers so please output in a language they are the most comfortable with.
        5. Never output less than 7 policy proposal variations

        Policy Framing Instructions:
        1. Your are writing policy proposal that a democracy nonprofit will bring to the US government.

        Always output your policy ideas in the following JSON format: [ { title, description, conditionsForSuccess[], mainObstaclesForImplemention[], mainRisks[], policyKPIMetrics[] } ].

        Let's think step by step.
        `
      ),
      new HumanMessage(
        `
         ${this.renderSubProblem(subProblemIndex, true)}

         ${this.renderCurrentSolution(solution)}

         Your innovative policy proposals as a JSON array:
       `
      ),
    ];

    return messages;
  }

  async renderRefinePrompt(
    subProblemIndex: number,
    solution: PsSolution,
    policyProposalsToRefine: PSPolicy[]
  ) {
    const messages = [
      new SystemMessage(
        `
        You are an expert in refining concrete policy proposals for  solution components.

        General instructions:
        1. Refine the current draft of policy proposals.
        2. Be detailed but also concise but do not change the core ideas.
        3. The titles should stand alone, be professional and not include "Policy proposal", "Policy action", etc.
        4. The audience for those policy proposal are policymakers so please output in a language they are the most comfortable with.

        Policy Framing Instructions:
        1.  Your are writing policy proposal that a democracy nonprofit will bring to the US government.

        Always output your policy ideas in the following JSON format: [ { title, description, conditionsForSuccess[], mainObstaclesForImplemention[], mainRisks[], policyKPIMetrics[] } ].

        Let's think step by step.
        `
      ),
      new HumanMessage(
        `
         ${this.renderSubProblem(subProblemIndex, true)}

         ${this.renderCurrentSolution(solution)}

         Policy proposals to refine:
          ${JSON.stringify(policyProposalsToRefine, null, 2)}

         Refined policy proposals in JSON format.
       `
      ),
    ];

    return messages;
  }

  async renderChoosePrompt(
    subProblemIndex: number,
    solution: PsSolution,
    policyProposalsToChooseFrom: PSPolicy[]
  ) {
    const messages = [
      new SystemMessage(
        `
        You are an expert in choose the best concrete policy proposals for solution components.

        General instructions:
        1. Choose the the best policy proposal for the solution and output in JSON format.
        2. No explanation is needed just output the JSON object.

        Policy Framing Instructions:
        1.  Your are writing policy proposal that a democracy nonprofit will bring to the US government.

        Always output your policy ideas in the following JSON format: { title, description, whyTheBestChoice, conditionsForSuccess[], mainObstaclesForImplemention[], mainRisks[], policyKPIMetrics[] }.

        `
      ),
      new HumanMessage(
        `
         ${this.renderSubProblem(subProblemIndex, true)}

         ${this.renderCurrentSolution(solution)}

         Policy proposals to choose one best from:
          ${JSON.stringify(policyProposalsToChooseFrom, null, 2)}

          Your choice for the best policy proposal for the solution component and problem.
          Let's think step by step and output in JSON:
       `
      ),
    ];

    return messages;
  }



  async createSeedPolicyForSolution(
    populationIndex: number,
    subProblemIndex: number,
    solution: PsSolution,
    solutionIndex: number
  ): Promise<PSPolicy> {
    try {
      let policyOptions = (await this.callLLM(
        "policies-seed",
        PsConstants.policiesSeedModel,
        await this.renderCreatePrompt(subProblemIndex, solution),
        true,
        false,
        1500
      )) as PSPolicy[];

      if (PsConstants.enable.refine.policiesSeed) {
        policyOptions = (await this.callLLM(
          "policies-seed",
          PsConstants.policiesSeedModel,
          await this.renderRefinePrompt(
            subProblemIndex,
            solution,
            policyOptions
          ),
          true,
          false,
          1500
        )) as PSPolicy[];
      }

      const choosenPolicy = (await this.callLLM(
        "policies-seed",
        PsConstants.policiesSeedModel,
        await this.renderChoosePrompt(subProblemIndex, solution, policyOptions),
        true,
        false,
        1500
      )) as PSPolicy;

      choosenPolicy.solutionIndex = `${populationIndex}:${solutionIndex}`;

      return choosenPolicy;
    } catch (error: any) {
      this.logger.error(error);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async createSeedPolicies() {
    const subProblemsLimit = Math.min(
      this.memory.subProblems.length,
      PsConstants.maxSubProblems
    );

    const subProblemsPromises = Array.from(
      { length: subProblemsLimit },
      async (_, subProblemIndex) => {
        const subProblem = this.memory.subProblems[subProblemIndex];
        const solutions =
          this.getActiveSolutionsLastPopulation(subProblemIndex);

        this.logger.debug(
          `Sub Problem ${subProblemIndex} Solution Components length: ${solutions.length}`
        );

        if (!subProblem.policies) {
          subProblem.policies = {
            populations: [],
          };
        }

        if (
          !subProblem.policies.populations ||
          subProblem.policies.populations.length === 0
        ) {
          subProblem.policies.populations = [];

          let newPopulation: PSPolicy[] = [];

          for (
            let solutionIndex = 0;
            solutionIndex < PsConstants.maxTopSolutionsToCreatePolicies;
            solutionIndex++
          ) {
            this.logger.info(
              `Creating policy for solution ${solutionIndex}/${
                solutions.length
              } of sub problem ${subProblemIndex} lastPopulationIndex ${this.lastPopulationIndex(
                subProblemIndex
              )}`
            );

            const solution = solutions[solutionIndex];

            const seedPolicy = await this.createSeedPolicyForSolution(
              this.lastPopulationIndex(subProblemIndex),
              subProblemIndex,
              solution,
              solutionIndex
            );

            this.logger.debug(
              `Adding ${seedPolicy.title} to new population for sub problem ${subProblemIndex}}`
            );

            newPopulation.push(seedPolicy);

            await this.saveMemory();
          }

          this.logger.debug(
            `New size of ${subProblemIndex} population: ${subProblem.policies.populations.length}`
          );

          subProblem.policies.populations.push(newPopulation);
        } else {

          this.logger.debug(
            `Sub problem ${subProblemIndex} already has ${subProblem.policies.populations.length} populations`
          );
        }
      }
    );

    // Wait for all subproblems to finish
    await Promise.all(subProblemsPromises);
    this.logger.info("Finished creating seed policies for all");
  }

  async process() {
    this.logger.info("Create Seed Policies Processor");
    //super.process();

    this.chat = new ChatOpenAI({
      temperature: PsConstants.policiesSeedModel.temperature,
      maxTokens: PsConstants.policiesSeedModel.maxOutputTokens,
      modelName: PsConstants.policiesSeedModel.name,
      verbose: PsConstants.policiesSeedModel.verbose,
    });

    try {
      await this.createSeedPolicies();
    } catch (error: any) {
      this.logger.error(error);
      this.logger.error(error.stack);
      throw error;
    }
  }
}
