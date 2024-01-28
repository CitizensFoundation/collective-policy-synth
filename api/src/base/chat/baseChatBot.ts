import { OpenAI } from "openai";
import { Stream } from "openai/streaming.mjs";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import ioredis from "ioredis";

import { PolicySynthAgentBase } from "@policysynth/agents/baseAgent.js";
import { IEngineConstants } from "@policysynth/agents/constants.js";

//TODO: Use tiktoken
const WORDS_TO_TOKENS_MAGIC_CONSTANT = 1.3;

//@ts-ignore
const redis = new ioredis.default(
  process.env.REDIS_MEMORY_URL || "redis://localhost:6379"
);

export class PsBaseChatBot {
  wsClientId: string;
  wsClientSocket: WebSocket;
  openaiClient: OpenAI;
  memory!: PsChatBotMemoryData;
  currentAgent: PolicySynthAgentBase | undefined;
  broadcastingLiveCosts = false;
  liveCostsBroadcastInterval = 1000;
  liveCostsInactivityTimeout = 1000 * 60 * 10;
  redisMemoryKeyPrefix = "chatbot-memory";
  tempeture = 0.7;
  maxTokens = 4000;
  llmModel = "gpt-4-0125-preview";
  persistMemory = false;
  memoryId: string | undefined = undefined;

  liveCostsBroadcastTimeout: NodeJS.Timeout | undefined = undefined;
  liveCostsBoadcastStartAt: Date | undefined;
  lastSentToUserAt: Date | undefined;
  lastBroacastedCosts: number | undefined;

  get redisKey(){
    return `${this.redisMemoryKeyPrefix}-${this.memoryId}`
  }

  loadMemory() {
    return new Promise<PsChatBotMemoryData>(async (resolve, reject) => {
      try {
        const memoryString = await redis.get(
          this.redisKey
        );
        if (memoryString) {
          const memory = JSON.parse(memoryString);
          resolve(memory);
        } else {
          resolve(this.getEmptyMemory());
        }
      } catch (error) {
        console.error("Can't load memory from redis", error);
        resolve(this.getEmptyMemory());
      }
    });
  }

  constructor(
    wsClientId: string,
    wsClients: Map<string, WebSocket>,
    memoryId: string | undefined = undefined
  ) {
    this.wsClientId = wsClientId;
    this.wsClientSocket = wsClients.get(this.wsClientId)!;
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    if (!this.wsClientSocket) {
      console.error(
        `WS Client ${this.wsClientId} not found in streamWebSocketResponses`
      );
    }
    this.setupMemory(memoryId);
  }

  async setupMemory(memoryId: string | undefined = undefined) {
    if (memoryId) {
      this.memoryId = memoryId;
      this.memory = await this.loadMemory();
    }
    this.memoryId = uuidv4();
    this.memory = this.getEmptyMemory();
    this.sendMemoryId();
  }

  async getLoadedMemory() {
    return await this.loadMemory();
  }

  sendMemoryId() {
    const botMessage = {
      sender: "bot",
      type: "memoryIdCreated",
      message: this.memoryId
    } as PsAiChatWsMessage;

    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  async saveMemory() {
    if (this.memory) {
      try {
        await redis.set(this.redisKey, JSON.stringify(this.memory));
        console.log(`Saved memory to redis: ${this.redisKey}`)
      } catch (error) {
        console.log("Can't save memory to redis", error);
      }
    } else {
      console.error("Memory is not initialized");
    }
  }

  renderSystemPrompt() {
    return `Please tell the user to replace this system prompt in a fun and friendly way. Encourage them to have a nice day. Lots of emojis`;
  }

  sendToClient(sender: string, message: string, type = "stream") {
    this.wsClientSocket.send(
      JSON.stringify({
        sender,
        type: type,
        message,
      })
    );
    this.lastSentToUserAt = new Date();
  }

  sendAgentStart(name: string, hasNoStreaming = true) {
    const botMessage = {
      sender: "bot",
      type: "agentStart",
      data: {
        name: name,
        noStreaming: hasNoStreaming,
      } as PsAgentStartWsOptions,
    } as PsAiChatWsMessage;
    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  sendAgentCompleted(
    name: string,
    lastAgent = false,
    error: string | undefined = undefined
  ) {
    const botMessage = {
      sender: "bot",
      type: "agentCompleted",
      data: {
        name: name,
        results: {
          isValid: true,
          validationErrors: error,
          lastAgent: lastAgent,
        } as PsValidationAgentResult,
      } as PsAgentCompletedWsOptions,
    } as PsAiChatWsMessage;

    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  sendAgentUpdate(message: string) {
    const botMessage = {
      sender: "bot",
      type: "agentUpdated",
      message: message,
    } as PsAiChatWsMessage;

    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  startBroadcastingLiveCosts() {
    this.stopBroadcastingLiveCosts();
    this.liveCostsBoadcastStartAt = new Date();
    this.lastBroacastedCosts = undefined;

    this.broadcastingLiveCosts = true;
    this.broadCastLiveCosts();
  }

  broadCastLiveCosts() {
    if (this.broadcastingLiveCosts) {
      if (this.currentAgent && this.currentAgent.fullLLMCostsForMemory) {
        if (
          this.lastBroacastedCosts != this.currentAgent.fullLLMCostsForMemory
        ) {
          console.log(
            `Broadcasting live costs: ${this.currentAgent.fullLLMCostsForMemory}`
          );
          const botMessage = {
            sender: "bot",
            type: "liveLlmCosts",
            data: this.currentAgent.fullLLMCostsForMemory,
          } as PsAiChatWsMessage;
          this.wsClientSocket.send(JSON.stringify(botMessage));
          this.lastBroacastedCosts = this.currentAgent.fullLLMCostsForMemory;
        }
      }
      let timePassedSinceBroadcastStartActivity = 0;
      if (this.liveCostsBoadcastStartAt && this.lastSentToUserAt) {
        timePassedSinceBroadcastStartActivity =
          this.lastSentToUserAt.getTime() -
          this.liveCostsBoadcastStartAt.getTime();
      }

      if (
        timePassedSinceBroadcastStartActivity < this.liveCostsInactivityTimeout
      ) {
        this.liveCostsBroadcastTimeout = setTimeout(() => {
          this.broadCastLiveCosts();
        }, this.liveCostsBroadcastInterval);
      }
    } else {
      this.stopBroadcastingLiveCosts();
    }
  }

  stopBroadcastingLiveCosts() {
    if (this.liveCostsBroadcastTimeout) {
      clearTimeout(this.liveCostsBroadcastTimeout);
    }
    this.broadcastingLiveCosts = false;
    console.log("Stopped broadcasting live costs");
  }

  get emptyChatBotStagesData() {
    return {
      "chatbot-conversation": {
        tokensInCost: 0,
        tokensOutCost: 0,
        tokensIn: 0,
        tokensOut: 0,
      } as IEngineInnovationStagesData,
    } as Record<PSChatBotMemoryStageTypes, IEngineInnovationStagesData>;
  }

  getEmptyMemory() {
    return {
      redisKey: this.redisKey,
      currentStage: "chatbot-conversation",
      stages: {
        ...PolicySynthAgentBase.emptyDefaultStages,
        ...this.emptyChatBotStagesData,
      },
      timeStart: Date.now(),
      chatLog: [],
      groupId: 1,
      communityId: 1,
      domainId: 1,
      totalCost: 0,
      customInstructions: {},
      problemStatement: {
        description: "",
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
      },
      subProblems: [],
    } as PsChatBotMemoryData;
  }

  async streamWebSocketResponses(
    //@ts-ignore
    stream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
  ) {
    return new Promise<void>(async (resolve, reject) => {
      this.sendToClient("bot", "", "start");
      try {
        let botMessage = "";
        for await (const part of stream) {
          this.sendToClient("bot", part.choices[0].delta.content!);
          botMessage += part.choices[0].delta.content!;
          this.addToExternalSolutionsMemoryCosts(
            part.choices[0].delta.content!,
            "out"
          );
          if (part.choices[0].finish_reason == "stop") {
            this.memory.chatLog!.push(
              {
                sender: "bot",
                message: botMessage,
              } as PsSimpleChatLog
            );

            await this.saveMemoryIfNeeded();
          }
        }
      } catch (error) {
        console.error(error);
        this.sendToClient(
          "bot",
          "There has been an error, please retry",
          "error"
        );
        reject();
      } finally {
        this.sendToClient("bot", "", "end");
      }
      resolve();
    });
  }

  getTokenCosts(estimateTokens: number, type: "in" | "out") {
    if (type == "in") {
      return (
        IEngineConstants.analyseExternalSolutionsModel.inTokenCostUSD *
        estimateTokens
      );
    } else {
      return (
        IEngineConstants.analyseExternalSolutionsModel.outTokenCostUSD *
        estimateTokens
      );
    }
  }

  addToExternalSolutionsMemoryCosts(text: string, type: "in" | "out") {
    if (text) {
      const parts = text.split(" ").filter((part) => part != "");
      const estimateTokens = parts.length * WORDS_TO_TOKENS_MAGIC_CONSTANT;

      if (this.currentAgent && this.currentAgent.memory) {
        if (type == "in") {
          if (
            this.memory.stages["chatbot-conversation"].tokensInCost ===
              undefined ||
            this.memory.stages["chatbot-conversation"].tokensIn === undefined
          ) {
            this.memory.stages["chatbot-conversation"].tokensInCost = 0;
            this.memory.stages["chatbot-conversation"].tokensIn = 0;
          }
          this.memory.stages["chatbot-conversation"].tokensIn += estimateTokens;
          this.memory.stages["chatbot-conversation"].tokensInCost +=
            this.getTokenCosts(estimateTokens, type);
        } else {
          if (
            this.memory.stages["chatbot-conversation"].tokensOutCost ===
              undefined ||
            this.memory.stages["chatbot-conversation"].tokensOut === undefined
          ) {
            this.memory.stages["chatbot-conversation"].tokensOutCost = 0;
            this.memory.stages["chatbot-conversation"].tokensOut = 0;
          }
          this.memory.stages["chatbot-conversation"].tokensOut +=
            estimateTokens;
          this.memory.stages["chatbot-conversation"].tokensOutCost +=
            this.getTokenCosts(estimateTokens, type);
        }
      } else {
        console.warn(
          `No current agent or memory found to add external solutions costs`
        );
      }
    } else {
      console.warn(`No text found to add external solutions costs`);
    }
  }

  async saveMemoryIfNeeded() {
    if (this.persistMemory) {
      await this.saveMemory();
    }
  }

  async setChatLog(chatLog: PsSimpleChatLog[]) {
    this.memory.chatLog = chatLog;

    await this.saveMemoryIfNeeded();
  }

  conversation = async (chatLog: PsSimpleChatLog[]) => {
    this.setChatLog(chatLog);

    let messages: any[] = chatLog.map((message: PsSimpleChatLog) => {
      return {
        role: message.sender,
        content: message.message,
      };
    });

    const systemMessage = {
      role: "system",
      content: this.renderSystemPrompt(),
    };

    messages.unshift(systemMessage);

    const stream = await this.openaiClient.chat.completions.create({
      model: this.llmModel,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.tempeture,
      stream: true,
    });

    this.streamWebSocketResponses(stream);
  };
}
