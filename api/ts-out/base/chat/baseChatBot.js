import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";
import ioredis from "ioredis";
//TODO: Use tiktoken
const WORDS_TO_TOKENS_MAGIC_CONSTANT = 1.3;
//@ts-ignore
const redis = new ioredis.default(process.env.REDIS_AGENT_URL || "redis://localhost:6379");
export class PsBaseChatBot {
    wsClientId;
    wsClientSocket;
    openaiClient;
    memory;
    static redisMemoryKeyPrefix = "ps-chatbot-memory";
    tempeture = 0.7;
    maxTokens = 4000;
    llmModel = "gpt-4o";
    persistMemory = false;
    memoryId = undefined;
    lastSentToUserAt;
    get redisKey() {
        return `${PsBaseChatBot.redisMemoryKeyPrefix}-${this.memoryId}`;
    }
    static loadMemoryFromRedis(memoryId) {
        return new Promise(async (resolve, reject) => {
            try {
                const memoryString = await redis.get(`${PsBaseChatBot.redisMemoryKeyPrefix}-${memoryId}`);
                if (memoryString) {
                    const memory = JSON.parse(memoryString);
                    resolve(memory);
                }
                else {
                    resolve(undefined);
                }
            }
            catch (error) {
                console.error("Can't load memory from redis", error);
                resolve(undefined);
            }
        });
    }
    loadMemory() {
        return new Promise(async (resolve, reject) => {
            try {
                const memoryString = await redis.get(this.redisKey);
                if (memoryString) {
                    const memory = JSON.parse(memoryString);
                    resolve(memory);
                }
                else {
                    resolve(this.getEmptyMemory());
                }
            }
            catch (error) {
                console.error("Can't load memory from redis", error);
                resolve(this.getEmptyMemory());
            }
        });
    }
    constructor(wsClientId, wsClients, memoryId = undefined) {
        this.wsClientId = wsClientId;
        this.wsClientSocket = wsClients.get(this.wsClientId);
        this.openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        if (!this.wsClientSocket) {
            console.error(`WS Client ${this.wsClientId} not found in streamWebSocketResponses`);
        }
        this.setupMemory(memoryId);
    }
    async setupMemory(memoryId = undefined) {
        if (memoryId) {
            this.memoryId = memoryId;
            this.memory = await this.loadMemory();
        }
        else {
            this.memoryId = uuidv4();
            this.memory = this.getEmptyMemory();
            if (this.wsClientSocket) {
                this.sendMemoryId();
            }
            else {
                console.error("No wsClientSocket found");
            }
        }
    }
    async getLoadedMemory() {
        return await this.loadMemory();
    }
    sendMemoryId() {
        const botMessage = {
            sender: "bot",
            type: "memoryIdCreated",
            data: this.memoryId,
        };
        if (this.wsClientSocket) {
            this.wsClientSocket.send(JSON.stringify(botMessage));
        }
        else {
            console.error("No wsClientSocket found");
        }
    }
    async saveMemory() {
        if (this.memory) {
            try {
                await redis.set(this.redisKey, JSON.stringify(this.memory));
                console.log(`Saved memory to redis: ${this.redisKey}`);
            }
            catch (error) {
                console.log("Can't save memory to redis", error);
            }
        }
        else {
            console.error("Memory is not initialized");
        }
    }
    renderSystemPrompt() {
        return `Please tell the user to replace this system prompt in a fun and friendly way. Encourage them to have a nice day. Lots of emojis`;
    }
    sendAgentStart(name, hasNoStreaming = true) {
        const botMessage = {
            sender: "bot",
            type: "agentStart",
            data: {
                name: name,
                noStreaming: hasNoStreaming,
            },
        };
        if (this.wsClientSocket) {
            this.wsClientSocket.send(JSON.stringify(botMessage));
        }
        else {
            console.error("No wsClientSocket found");
        }
    }
    sendAgentCompleted(name, lastAgent = false, error = undefined) {
        const botMessage = {
            sender: "bot",
            type: "agentCompleted",
            data: {
                name: name,
                results: {
                    isValid: true,
                    validationErrors: error,
                    lastAgent: lastAgent,
                },
            },
        };
        if (this.wsClientSocket) {
            this.wsClientSocket.send(JSON.stringify(botMessage));
        }
        else {
            console.error("No wsClientSocket found");
        }
    }
    sendAgentUpdate(message) {
        const botMessage = {
            sender: "bot",
            type: "agentUpdated",
            message: message,
        };
        if (this.wsClientSocket) {
            this.wsClientSocket.send(JSON.stringify(botMessage));
        }
        else {
            console.error("No wsClientSocket found");
        }
    }
    get emptyChatBotStagesData() {
        return {};
    }
    getEmptyMemory() {
        return {
            redisKey: this.redisKey,
            chatLog: [],
        };
    }
    sendToClient(sender, message, type = "stream") {
        this.wsClientSocket.send(JSON.stringify({
            sender,
            type: type,
            message,
        }));
        this.lastSentToUserAt = new Date();
    }
    async streamWebSocketResponses(stream) {
        return new Promise(async (resolve, reject) => {
            this.sendToClient("bot", "", "start");
            try {
                let botMessage = "";
                for await (const part of stream) {
                    this.sendToClient("bot", part.choices[0].delta.content);
                    botMessage += part.choices[0].delta.content;
                    if (part.choices[0].finish_reason == "stop") {
                        this.memory.chatLog.push({
                            sender: "bot",
                            message: botMessage,
                        });
                        await this.saveMemoryIfNeeded();
                    }
                }
            }
            catch (error) {
                console.error(error);
                this.sendToClient("bot", "There has been an error, please retry", "error");
                reject();
            }
            finally {
                this.sendToClient("bot", "", "end");
            }
            resolve();
        });
    }
    async saveMemoryIfNeeded() {
        if (this.persistMemory) {
            await this.saveMemory();
        }
    }
    async setChatLog(chatLog) {
        this.memory.chatLog = chatLog;
        await this.saveMemoryIfNeeded();
    }
    conversation = async (chatLog) => {
        this.setChatLog(chatLog);
        let messages = chatLog.map((message) => {
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
//# sourceMappingURL=baseChatBot.js.map