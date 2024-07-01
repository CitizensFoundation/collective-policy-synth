import { initializeModels, models } from "../dbModels/index.js";

import { User } from "../dbModels/ypUser.js";
import { Group } from "../dbModels/ypGroup.js";
import { PsAgentClass } from "../dbModels/agentClass.js";
import { PsAiModel } from "../dbModels/aiModel.js";
import { connectToDatabase } from "../dbModels/sequelize.js";
import { PsAiModelType } from "../aiModelTypes.js";

await connectToDatabase();
await initializeModels();

const user = await User.create({ email: "example@example.com", name: "Example User" });

const anthropicSonnetConfig: PsAiModelConfiguration = {
  type: PsAiModelType.Text,
  provider: "anthropic",
  prices: {
    costInTokensPerMillion: 3,
    costOutTokensPerMillion: 15,
    currency: "USD"
  },
  maxTokensOut: 4096,
  defaultTemperature: 0.7,
  model: "claude-3-5-sonnet-20240620",
  active: true
};

const anthropicSonnet = await PsAiModel.create({
  name: "Anthropic Sonnet 3.5",
  organization_id: 1,
  user_id: user.id,
  configuration: anthropicSonnetConfig,
});

const openAiGpt4Config: PsAiModelConfiguration = {
  type: PsAiModelType.Text,
  provider: "openai",
  prices: {
    costInTokensPerMillion: 5,
    costOutTokensPerMillion: 15,
    currency: "USD"
  },
  maxTokensOut: 4096,
  defaultTemperature: 0.7,
  model: "gpt-4o",
  active: true
};

const openAiGpt4 = await PsAiModel.create({
  name: "OpenAI GPT-4o",
  organization_id: 1,
  user_id: user.id,
  configuration: openAiGpt4Config,
});

// Create a group with both AI model API keys
await Group.create({
  name: "Example Group",
  user_id: user.id,
  private_access_configuration: [
    {
      aiModelId: anthropicSonnet.id,
      apiKey: process.env.ANTHROPIC_CLAUDE_API_KEY || "",
    },
    {
      aiModelId: openAiGpt4.id,
      apiKey: process.env.OPENAI_API_KEY || "",
    }
  ]
});

// Create Top-Level Agent Class
const topLevelAgentClassConfig: PsAgentClassAttributesConfiguration = {
  description: "A top-level agent that coordinates other agents",
  queueName: "noqueue",
  imageUrl: "https://yrpri-eu-direct-assets.s3.eu-west-1.amazonaws.com/topLevelAgent.png",
  iconName: "coordinator",
  capabilities: ["process coordination", "task management", "result aggregation"],
  inputJsonInterface: "{}",
  outputJsonInterface: "{}",
  questions: [],
  supportedConnectors: [],
};

await PsAgentClass.create({
  class_base_id: "c375c1fb-58ca-4372-a567-0e02b2c3d479",
  name: "Operations Agent",
  version: 1,
  available: true,
  configuration: topLevelAgentClassConfig,
  user_id: user.id,
});
