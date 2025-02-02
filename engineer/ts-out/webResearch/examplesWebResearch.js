import { PsEngineerBaseWebResearchAgent } from "./baseResearchAgent.js";
export class PsEngineerExamplesWebResearchAgent extends PsEngineerBaseWebResearchAgent {
    searchInstructions = "Extract typescript source code examples from web pages for a the task given by the user and npm modules. Always output with full context or instructions, if any, in markdown.";
    scanType = "codeExamples";
    rankingInstructions = "Rank the source code examples based on relevance to the task.";
    scanningSystemPrompt = "Extract typescript source code examples from <TextContext> for a the task given by the user and npm modules.";
}
//# sourceMappingURL=examplesWebResearch.js.map