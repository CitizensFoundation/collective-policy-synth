import fs from "fs";
import path from "path";

import {
  PsAiModelType,
  PsAiModelSize,
} from "@policysynth/agents/aiModelTypes.js";
import { PsAgent } from "@policysynth/agents/dbModels/agent.js";
import { PsEngineerAgentBase } from "../agentBase.js";

export class PsEngineerInitialAnalyzer extends PsEngineerAgentBase {
  declare memory: PsEngineerMemoryData;

  override get maxModelTokensOut(): number {
    return 80000;
  }

  override get modelTemperature(): number {
    return 0.0;
  }

  override get reasoningEffort(): "low" | "medium" | "high" {
    return "high";
  }

  constructor(
    agent: PsAgent,
    memory: PsEngineerMemoryData,
    startProgress: number,
    endProgress: number
  ) {
    super(agent, memory, startProgress, endProgress);
    this.memory = memory;
  }

  readNpmDependencies() {
    const packageJsonPath = path.join(
      this.memory.workspaceFolder,
      "package.json"
    );
    const packageJsonData = fs.readFileSync(packageJsonPath, "utf8");
    const packageJsonObj = JSON.parse(packageJsonData);
    return packageJsonObj.dependencies;
  }

  ///////////////////////////////////
  // 1) Less Restrictive Prompt
  ///////////////////////////////////
  get analyzeSystemPrompt() {
    return `
<ImportantInstructions>
  1. You will receive the user’s coding task title, description, and instructions.
  2. You will see all existing TypeScript files. Output any that could possibly relate to or be impacted by the user's task.
     - This does NOT mean you are sure they will be changed; only that they could plausibly need changes or referencing.
  3. You will see a list of all npm dependencies. Output which are likely relevant.
  4. You will see all possible documentation files. Output which might be helpful.
  5. You will also see all possible TypeScript definition files.
     - If they could conceivably be relevant, list them.
  6. Output a JSON object matching the schema below (be flexible and inclusive rather than exclusive):
     {
       "existingTypeScriptFilesThatCouldPossiblyChangeForFurtherInvestigation": string[];
       "otherUsefulTypescriptCodeFilesThatCouldBeRelevant": string[];
       "usefulTypescriptDefinitionFilesThatCouldBeRelevant": string[];
       "documentationFilesThatCouldBeRelevant": string[];
       "likelyRelevantNpmPackageDependencies": string[];
       "needsDocumentationAndExamples": boolean;
     }
</ImportantInstructions>
`;
  }

  analyzeUserPrompt(
    allNpmPackageDependencies: string[],
    allDocumentationFiles: string[]
  ) {
    const allTypescriptDefFiles = this.memory.allTypescriptSrcFiles?.filter(
      (file) => file.endsWith(".d.ts")
    );
    const allTypescriptCodeFiles = this.memory.allTypescriptSrcFiles?.filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".d.ts")
    );

    return `
<AllNpmPackageDependencies>
${JSON.stringify(allNpmPackageDependencies, null, 2)}
</AllNpmPackageDependencies>

<AllDocumentationFiles>
${allDocumentationFiles.join("\n")}
</AllDocumentationFiles>

${
  allTypescriptDefFiles
    ? `<AllDefinitionTypescriptFiles>
${allTypescriptDefFiles.join("\n")}
</AllDefinitionTypescriptFiles>`
    : ""
}

${
  allTypescriptCodeFiles
    ? `<AllCodeTypescriptFiles>
${allTypescriptCodeFiles.join("\n")}
</AllCodeTypescriptFiles>`
    : ""
}

${
  this.memory.taskTitle
    ? `<TheUserCodingTaskTitle>${this.memory.taskTitle}</TheUserCodingTaskTitle>`
    : ""
}
${
  this.memory.taskDescription
    ? `<TheUserCodingTaskDescription>${this.memory.taskDescription}</TheUserCodingTaskDescription>`
    : ""
}
${
  this.memory.taskInstructions
    ? `<TheUserCodingTaskInstructions>${this.memory.taskInstructions}</TheUserCodingTaskInstructions>`
    : ""
}

TASK: Identify any possibly relevant files and dependencies for further investigation. Then output the JSON according to the schema described above.

Your JSON Output (no extra text, only valid JSON):
`;
  }

  async analyzeFilesForInitialTextReview(
    filePaths: string[],
    fileType: string
  ): Promise<PsInitialCodeAnalysisTextReview[]> {
    this.logger.info(`Performing initial text review for ${fileType} files...`);
    await this.updateRangedProgress(
      undefined,
      `Initial text review for ${fileType} files...`
    );
    const reviews: { fileName: string; initialCodeAnalysisForTask: string }[] = [];
    if (!filePaths || filePaths.length === 0) {
      this.logger.info(`No files to review for ${fileType}.`);
      return reviews;
    }
    const promptSystem = `
<ImportantInstructions>
You are a specialized coding assistant.
For each file provided, analyze its content in the context of the user's coding task.
Provide either a detailed explanation of why the file is relevant to the task, or "Not relevant" if it is not.
</ImportantInstructions>
`;
    const userPromptTemplate = (fileContent: string, fileName: string) => {
      return `
<TheUserCodingTaskInstructions>
${this.memory.taskInstructions || ""}
</TheUserCodingTaskInstructions>

<FileReview filename="${fileName}">
${fileContent}
</FileReview>

Your analysis:
`;
    };

    for (const filePath of filePaths) {
      let fileContent = "";
      try {
        if (fs.existsSync(filePath)) {
          fileContent = fs.readFileSync(filePath, "utf8");
        } else {
          this.logger.warn(`File not found: ${filePath}`);
          continue;
        }
      } catch (error) {
        this.logger.error(`Error reading file ${filePath}:`, error);
        continue;
      }
      const userPrompt = userPromptTemplate(fileContent, filePath);
      this.startTiming();
      let rawResponse: string;
      try {
        rawResponse = await this.callModel(
          PsAiModelType.TextReasoning,
          PsAiModelSize.Small,
          [
            this.createSystemMessage(promptSystem),
            this.createHumanMessage(userPrompt),
          ],
          false
        );
        await this.addTimingResult("InitialTextReview");
      } catch (err) {
        this.logger.error(
          `Error calling model for initial review of file ${filePath}:`,
          err
        );
        continue;
      }

      const review: PsInitialCodeAnalysisTextReview = {
        fileName: filePath,
        initialCodeAnalysisForTask: rawResponse,
      };

      if (rawResponse.trim().toLowerCase().includes("not relevant")) {
        this.memory.rejectedFilesForRelevance.push(review);
      } else {
        this.memory.acceptedFilesForRelevance.push(review);
      }

      reviews.push(review);
    }
    return reviews;
  }

  ///////////////////////////////////
  // 4) NEW: Second pass – merge XML review and finalize analysis
  ///////////////////////////////////
  async finalizeFileAnalysis(
    textReviews: { fileName: string; initialCodeAnalysisForTask: string }[],
    fileType: string
  ): Promise<PsCodeAnalyzeResults[]> {
    this.logger.info(`Finalizing analysis for ${fileType} files...`);
    await this.updateRangedProgress(
      undefined,
      `Finalizing analysis for ${fileType} files...`
    );
    if (!textReviews || textReviews.length === 0) {
      this.logger.info(`No text reviews to finalize for ${fileType}.`);
      return [];
    }

    // Format the text reviews as XML tags.
    let xmlContent = `<InitialTextReviews>\n`;
    for (const review of textReviews) {
      xmlContent += `<Review fileName="${review.fileName}">\n`;
      xmlContent += `  <Analysis>${review.initialCodeAnalysisForTask}</Analysis>\n`;
      xmlContent += `</Review>\n`;
    }
    xmlContent += `</InitialTextReviews>`;

    const promptSystem = `
<ImportantInstructions>
You are a specialized coding assistant.
Given the XML formatted initial text reviews for files, produce a JSON array of objects.
Each object must have:
  "filePath": string (taken from the fileName),
  "relevantFor": "likelyToChangeToImplementTask" | "goodReferenceCodeForTask" | "goodReferenceTypeDefinition" | "goodReferenceDocumentation" | "notRelevant",
  "detailedCodeAnalysisForRelevanceToTask": string.
Only include files that are relevant (i.e. where the Analysis is not "Not relevant").
</ImportantInstructions>

<OutputFormat>:
[
  {
    filePath: string;
    relevantFor: "likelyToChangeToImplementTask" | "goodReferenceCodeForTask" | "goodReferenceTypeDefinition" | "goodReferenceDocumentation" | "notRelevant";
    detailedCodeAnalysisForRelevanceToTask: string;
  }
]
</OutputFormat>
`;

    const userPrompt = `
<FileReviews>
${xmlContent}
</FileReviews>

Your JSON output:
`;

    let rawResponse: string | object;
    try {
      rawResponse = await this.callModel(
        PsAiModelType.TextReasoning,
        PsAiModelSize.Small,
        [
          this.createSystemMessage(promptSystem),
          this.createHumanMessage(userPrompt),
        ],
        true
      );
      await this.addTimingResult("FinalizeFileAnalysis");
    } catch (err) {
      this.logger.error(`Error finalizing file analysis for ${fileType}:`, err);
      return [];
    }

    let finalResults: PsCodeAnalyzeResults[];
    try {
      finalResults =
        typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse;
    } catch (parseError) {
      this.logger.error(
        `Error parsing final analysis response for ${fileType}:`,
        parseError
      );
      return [];
    }

    // Ensure each result has a filePath.
    finalResults = finalResults.map((result: PsCodeAnalyzeResults) => {
      result.filePath = result.filePath || "";
      return result;
    });

    return finalResults;
  }

  /**
   * Reads the specified list of file paths from disk, returning a combined string
   * of the contents for reference. (Used for assembling context in memory.)
   */
  getFilesContents(analysisResults: PsCodeAnalyzeResults[]): string {
    let contentsStr = "";
    analysisResults.forEach((result) => {
      let fileContent = "";
      try {
        if (fs.existsSync(result.filePath)) {
          fileContent = fs.readFileSync(result.filePath, "utf8");
        } else {
          this.logger.warn(`File not found: ${result.filePath}`);
        }
      } catch (err) {
        this.logger.error(`Error reading file ${result.filePath}:`, err);
      }
      contentsStr += `<CodePossiblyRelevant filename="${result.filePath}">
  <AnalysisOnHowItMightBeRelevant>${result.detailedCodeAnalysisForRelevanceToTask}</AnalysisOnHowItMightBeRelevant>
  <Code>${fileContent}</Code>
</CodePossiblyRelevant>
`;
    });
    return contentsStr;
  }

  ///////////////////////////////////
  // MAIN ENTRY POINT
  ///////////////////////////////////
  async analyzeAndSetup() {
    this.logger.info("Analyzing and setting up task...");

    // 1) Gather package deps
    const allNpmPackageDependencies = this.readNpmDependencies();

    // 2) Gather all .md docs
    const getAllDocumentationFiles = (folderPath: string): string[] => {
      const files: string[] = [];
      const items = fs.readdirSync(folderPath);
      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory() && item !== "ts-out" && item !== "node_modules") {
          files.push(...getAllDocumentationFiles(itemPath));
        } else if (path.extname(item) === ".md") {
          files.push(itemPath);
        }
      }
      return files;
    };
    const allDocumentationFiles = getAllDocumentationFiles(
      this.memory.workspaceFolder
    );

    // 3) Ask the LLM which files could *possibly* be relevant.
    this.startTiming();
    const analysisResponse = await this.callModel(
      PsAiModelType.TextReasoning,
      PsAiModelSize.Medium,
      [
        this.createSystemMessage(this.analyzeSystemPrompt),
        this.createHumanMessage(
          this.analyzeUserPrompt(allNpmPackageDependencies, allDocumentationFiles)
        ),
      ],
      false
    );
    await this.addTimingResult("Analyzer Agent");

    // 4) Parse the planning results
    let analysisResults: PsEngineerPlanningResults;
    if (typeof analysisResponse === "string") {
      analysisResults = JSON.parse(analysisResponse);
    } else {
      analysisResults = analysisResponse as PsEngineerPlanningResults;
    }

    // Store the raw results
    this.memory.analysisResults = analysisResults;

    await this.saveMemory();

    const codeFilesMerged: string[] = [
      ...new Set([
        ...(analysisResults.existingTypeScriptFilesThatCouldPossiblyChangeForFurtherInvestigation ||
          []),
        ...(analysisResults.otherUsefulTypescriptCodeFilesThatCouldBeRelevant || []),
      ]),
    ];
    const codeInitialTextReviews = await this.analyzeFilesForInitialTextReview(
      codeFilesMerged,
      "code-files"
    );
    const finalizedCodeAnalysis = await this.finalizeFileAnalysis(
      codeInitialTextReviews,
      "code-files"
    );

    // Separate final results by their relevance type as needed.
    this.memory.existingTypeScriptFilesLikelyToChange = finalizedCodeAnalysis.filter(
      (res) => res.relevantFor === "likelyToChangeToImplementTask"
    );
    this.memory.usefulTypescriptCodeFilesToKeepInContext = finalizedCodeAnalysis.filter(
      (res) => res.relevantFor === "goodReferenceCodeForTask"
    );

    // (b) For TypeScript definition files.
    const defFiles: string[] =
      analysisResults.usefulTypescriptDefinitionFilesThatCouldBeRelevant || [];
    const defInitialTextReviews = await this.analyzeFilesForInitialTextReview(
      defFiles,
      "type-definition"
    );
    const finalizedDefAnalysis = await this.finalizeFileAnalysis(
      defInitialTextReviews,
      "type-definition"
    );
    this.memory.usefulTypescriptDefinitionFilesToKeepInContext = finalizedDefAnalysis;

    // (c) For documentation files.
    const docFiles: string[] =
      analysisResults.documentationFilesThatCouldBeRelevant || [];
    const docInitialTextReviews = await this.analyzeFilesForInitialTextReview(
      docFiles,
      "documentation"
    );
    const finalizedDocAnalysis = await this.finalizeFileAnalysis(
      docInitialTextReviews,
      "documentation"
    );
    this.memory.documentationFilesToKeepInContext = finalizedDocAnalysis;

    // 5) Mark whether we need docs/examples (from initial analysis)
    this.memory.needsDocumentationAndExamples =
      analysisResults.needsDocumentationAndExamples;

    // 6) Optionally gather combined contents for the "likelyToChange" set
    this.memory.existingTypeScriptFilesLikelyToChangeContents = this.getFilesContents(
      this.memory.existingTypeScriptFilesLikelyToChange
    );

    // 7) Save relevant npm deps
    this.memory.likelyRelevantNpmPackageDependencies =
      analysisResults.likelyRelevantNpmPackageDependencies;

    // Log action
    this.memory.actionLog.push(
      `Have done initial analysis.
       Possibly relevant code changed: ${this.memory.existingTypeScriptFilesLikelyToChange.length}
       Possibly relevant code references: ${this.memory.usefulTypescriptCodeFilesToKeepInContext.length}
       Possibly relevant definitions: ${finalizedDefAnalysis.length}.
      `
    );

    await this.saveMemory();
    this.logger.info("Finished analysis and stored results with reasons in memory.");
  }
}
