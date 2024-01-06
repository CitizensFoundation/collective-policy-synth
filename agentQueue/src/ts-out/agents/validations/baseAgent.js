import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Base } from "../../base.js";
import { IEngineConstants } from "../../constants.js";
import { ChatOpenAI } from "langchain/chat_models/openai";
export class PsBaseValidationAgent extends Base {
    name;
    agentMemory;
    nextAgent;
    validationErrors;
    systemMessage;
    userMessage;
    streamingCallbacks;
    constructor(name, agentMemory, systemMessage, userMessage, streamingCallbacks, nextAgent) {
        super();
        this.name = name;
        this.nextAgent = nextAgent;
        this.agentMemory = agentMemory;
        this.systemMessage = systemMessage;
        this.userMessage = userMessage;
        this.streamingCallbacks = streamingCallbacks;
        this.chat = new ChatOpenAI({
            temperature: IEngineConstants.validationModel.temperature,
            maxTokens: IEngineConstants.validationModel.maxOutputTokens,
            modelName: IEngineConstants.validationModel.name,
            verbose: IEngineConstants.validationModel.verbose,
            streaming: true
        });
    }
    async renderPrompt() {
        return [
            new SystemMessage(this.systemMessage),
            new HumanMessage(this.userMessage),
        ];
    }
    async runValidationLLM() {
        const llmResponse = await this.callLLM("validation-agent", IEngineConstants.validationModel, await this.renderPrompt(), true, false, 120, this.streamingCallbacks);
        if (!llmResponse) {
            throw new Error("LLM response is undefined");
        }
        else {
            return llmResponse;
        }
    }
    async execute(input) {
        await this.beforeExecute(input);
        const result = await this.performExecute();
        console.log(`Results: ${result.isValid} ${JSON.stringify(result.validationErrors)}`);
        result.nextAgent = result.nextAgent || this.nextAgent;
        await this.afterExecute(input, result);
        return result;
    }
    beforeExecute(input) {
        return Promise.resolve();
    }
    async performExecute() {
        return await this.runValidationLLM();
    }
    afterExecute(input, result) {
        return Promise.resolve();
    }
}
