
import Anthropic from "@anthropic-ai/sdk";
import { BaseChatModel } from "./baseChatModel.js";
import { encoding_for_model, TiktokenModel } from "tiktoken";

export class ClaudeChat extends BaseChatModel {
  private client: Anthropic;

  constructor(config: PsAiModelConfig) {
    const { apiKey, modelName = "claude-3-opus-20240229", maxTokensOut = 4096 } = config;
    super(modelName, maxTokensOut);
    this.client = new Anthropic({ apiKey });
  }

  async generate(
    messages: PsModelMessage[],
    streaming?: boolean,
    streamingCallback?: Function
  ): Promise<any> {
    const formattedMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.message,
    }));

    if (streaming) {
      const stream = await this.client.messages.create({
        max_tokens: this.maxTokensOut,
        messages: formattedMessages,
        model: this.modelName,
        stream: true,
      });

      for await (const messageStreamEvent of stream) {
        if (streamingCallback) {
          streamingCallback(messageStreamEvent);
        }
      }
    } else {
      const response = await this.client.messages.create({
        max_tokens: this.maxTokensOut,
        messages: formattedMessages,
        model: this.modelName,
      });

      return response;
    }
  }

  async getNumTokensFromMessages(messages: PsModelMessage[]): Promise<number> {
    const encoding = encoding_for_model(this.modelName as TiktokenModel);
    const formattedMessages = messages.map((msg) => msg.message).join(" ");
    const tokenCount = encoding.encode(formattedMessages).length;
    return Promise.resolve(tokenCount);
  }
}

export default ClaudeChat;
