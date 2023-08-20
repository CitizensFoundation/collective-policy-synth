import { BaseAgent } from "../baseAgent.js";
import { Worker, Job } from "bullmq";
import { CreateSeedPoliciesProcessor } from "./create/createSeedPolicies.js";
import { CreatePolicyImagesProcessor } from "./create/createPolicyImages.js";

export class AgentPolicies extends BaseAgent {
  declare memory: IEngineInnovationMemoryData;

  override async initializeMemory(job: Job) {
    const jobData = job.data as IEngineWorkerData;

    this.memory = {
      redisKey: this.getRedisKey(jobData.groupId),
      groupId: jobData.groupId,
      communityId: jobData.communityId,
      domainId: jobData.domainId,
      currentStage: "policies-seed",
      stages: this.defaultStages,
      timeStart: Date.now(),
      totalCost: 0,
      customInstructions: {
      },
      problemStatement: {
        description: jobData.initialProblemStatement,
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
          }
        },
      },
      subProblems: [],
      currentStageData: undefined,
    } as PSMemoryData;
    await this.saveMemory();
  }

  async setStage(stage: IEngineStageTypes) {
    this.memory.currentStage = stage;
    this.memory.stages[stage].timeStart = Date.now();

    await this.saveMemory();
  }

  async process() {
    switch (this.memory.currentStage) {
      case "policies-seed":
        const createSeedPoliciesProcessor = new CreateSeedPoliciesProcessor(
          this.job,
          this.memory
        );
        await createSeedPoliciesProcessor.process();
        break;
      case "policies-create-images":
        const createPolicyImages = new CreatePolicyImagesProcessor(
          this.job,
          this.memory
        );
        await createPolicyImages.process();
        break;
      default:
      console.log("No stage matched");
    }
  }
}

const agent = new Worker(
  "agent-policies",
  async (job: Job) => {
    console.log(`Agent Policies Processing job ${job.id}`);
    const agent = new AgentPolicies();
    await agent.setup(job);
    await agent.process();
    return job.data;
  },
  { concurrency: parseInt(process.env.AGENT_INNOVATION_CONCURRENCY || "1") }
);

process.on("SIGINT", async () => {
  await agent.close();
});