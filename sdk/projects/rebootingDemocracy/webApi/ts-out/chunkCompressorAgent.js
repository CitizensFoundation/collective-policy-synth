import { BaseIngestionAgent } from "./baseAgent.js";
import { IEngineConstants } from "./constants.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
export class ChunkCompressorAgent extends BaseIngestionAgent {
    maxCompressionRetries = 5;
    completionValidationSuccessMessage = "All content present in compressed text.";
    correctnessValidationSuccessMessage = "All content correct in compressed text.";
    hallucinationValidationSuccessMessage = "No additional content in compressed text.";
    halluciantionValidationSystemMessage = new SystemMessage(`You are an detailed oriented text comparison agent.

Instructions:
- Identify anything in the compressed text that is not in the uncompressed text.
- The compressed text should not include anything not in the uncompressed text
- If there is no additional text in in the uncompressed text, then output, and nothing else: No additional content in compressed text.
`);
    correctnessValidationSystemMessage = new SystemMessage(`You are an detailed oriented text comparison agent.

Instructions:
- Identify
-- concepts
-- ideas
-- names
-- places
... that are incorrect in the compressed text.
- The compressed text of course has less detail and that is fine
- If all the compressed text is correct, output: All content correct in compressed text.
`);
    completionValidationSystemMessage = new SystemMessage(`You are an detailed oriented text comparison agent.

Instructions:
- Identify
-- concepts
-- ideas
-- names
-- places
... that are not at all in the compressed text but are in the uncompressed text.
- The compressed text of course has less detail but should still have all the contents.
- If all the content is in the compressed text then output, and nothing else: All content present in compressed text.
`);
    validationUserMessage = (uncompressed, compressed) => new HumanMessage(`<UNCOMPRESSED_TEXT>${uncompressed}</UNCOMPRESSED_TEXT>

<COMPRESSED_TEXT>${compressed}</COMPRESSED_TEXT>

Think step by step and output your analysis here:
`);
    compressionSystemMessage = new SystemMessage(`You are an expert text analyzer and compressor.

Instructions:
- You will analyze the text for metadata
- You will compress the text to a title, shortDescription and all content compressed
- For the fullCompressedContents make it as short as possible but do not leave anything out, keep all names, places and events.

Output:
- Output your analysis and compressed text in this JSON format: {
  title: string;
  shortDescription: string;
  fullCompressedContents: string;
  textMetaData: { [key: string]: string };
}`);
    compressionUserMessage = (data, retryCount) => new HumanMessage(`Document to analyze and compress:
${retryCount > 1
        ? "MAKE SURE TO INCLUDE ALL THE CONTENT AND DETAILS FROM THE ORIGINAL CONTENT"
        : ""}${data}
`);
    async compress(uncompressedData) {
        this.resetLlmTemperature();
        let chunkCompression;
        let validated = false;
        let retryCount = 0;
        while (!validated && retryCount < this.maxCompressionRetries) {
            chunkCompression = (await this.callLLM("ingestion-agent", IEngineConstants.ingestionModel, this.getFirstMessages(this.compressionSystemMessage, this.compressionUserMessage(uncompressedData, retryCount))));
            validated = await this.validateChunkSummary(uncompressedData, chunkCompression.fullCompressedContents);
            retryCount++;
            if (retryCount > 2) {
                this.randomizeLlmTemperature();
            }
        }
        if (validated && chunkCompression) {
            return chunkCompression;
        }
        else {
            throw new Error("Chunk summary validation failed");
        }
    }
    async validateChunkSummary(uncompressed, compressed) {
        const validations = await Promise.all([
            this.callLLM("ingestion-agent", IEngineConstants.ingestionModel, this.getFirstMessages(this.completionValidationSystemMessage, this.validationUserMessage(uncompressed, compressed)), false),
            this.callLLM("ingestion-agent", IEngineConstants.ingestionModel, this.getFirstMessages(this.correctnessValidationSystemMessage, this.validationUserMessage(uncompressed, compressed)), false),
            this.callLLM("ingestion-agent", IEngineConstants.ingestionModel, this.getFirstMessages(this.halluciantionValidationSystemMessage, this.validationUserMessage(compressed, uncompressed)), false),
        ]);
        const [completionValidation, correctnessValidation, hallucinationValidation,] = validations.map((response) => response);
        if (completionValidation === this.completionValidationSuccessMessage &&
            correctnessValidation === this.correctnessValidationSuccessMessage &&
            hallucinationValidation === this.hallucinationValidationSuccessMessage) {
            return true;
        }
        else {
            if (completionValidation !== this.completionValidationSuccessMessage) {
                console.warn(`Chunk summary completionValidation failed: ${completionValidation}`);
            }
            if (correctnessValidation !== this.correctnessValidationSuccessMessage) {
                console.warn(`Chunk summary correctnessValidation failed: ${correctnessValidation}`);
            }
            if (hallucinationValidation !== this.hallucinationValidationSuccessMessage) {
                console.warn(`Chunk summary hallucinationValidation failed: ${hallucinationValidation}`);
            }
            return false;
        }
    }
}
