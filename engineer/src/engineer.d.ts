type PsEngineerAgentTypes =
  | "planner"
  | "webDocResearcher"
  | "webExamplesResearcher"
  | "typescriptCoder"
  | "typescriptCompiler"
  | "codeReviewer"
  | "testWriter"
  | "testWriterReviewer"
  | "tester";

interface PsEngineerProject {
  id?: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "active" | "inactive";
  projectPlan: PsEngineerTask[];
}

interface PsEngineerTask {
  id?: number;
  description: string;
  startDate: string;
  endDate: string;
  status: "completed" | "inProgress" | "notStarted" | "error";
  assignedAgent: PsEngineerAgentTypes;
}

interface PsEngineerAgent {
  systemMessage: string;
  contexts: string[];
  type: PsEngineerAgentTypes;
}

interface PsEngineerContextItem {
  type: "code" | "documentation" | "example";
  title: string;
  content: string;
}

interface PsEngineerPlanningResults {
  typeScriptFilesLikelyToChange: string[];
  otherTypescriptFilesToKeepInContext: string[];
  documentationFilesToKeepInContext: string[];
  likelyRelevantNpmPackageDependencies: string[];
  needsDocumentionsAndExamples: boolean;
}

interface PsEngineerDocsResearch {
  documentPartTitle: string;
  documentPartContent: string;
  possiblyRelevantForNpmModules: string[];
  possiblyRelevantForTypescriptFiles: string[];
  whyIsThisRelevant: string;
}

interface PsEngineerExampleResearch {
  sourceCodeExamplePartTitle: string;
  sourceCodeExamplePartContent: string;
  possiblyRelevantForNpmModules: string[];
  possiblyRelevantForTypescriptFiles: string[];
  whyIsThisRelevant: string;
}

interface PsEngineerMemoryData extends PSMemoryData {
  workspaceFolder: string;
  taskDescription: string;
  taskTitle: string;
  taskInstructions: string;
  actionLog: string[];
  allTypescriptSrcFiles?: string[];
  typeScriptFilesLikelyToChange: string[];
  otherTypescriptFilesToKeepInContext: string[];
  documentationFilesToKeepInContext: string[];
  needsDocumentionsAndExamples?: boolean;
  likelyRelevantNpmPackageDependencies: string[];
  docsContextItems?: string[];
  exampleContextItems?: string[];
}

interface PsTsMorphNewOrUpdatedFunction {
  name: string;
  parameters: { name: string; type: string }[];
  returnType: string;
  statements: string;
}

interface PsTsMorphNewOrUpdatedProperty {
  name: string;
  type: string;
  className: string;
}

interface PsEngineerCodeChange {
  action:
    | "changeFunction"
    | "addFunction"
    | "deleteFunction"
    | "addProperty"
    | "deleteProperty"
    | "changeProperty"
    | "addFile"
    | "deleteFile"
    | "addImport"
    | "deleteImport"
    | "changeImport"
    | "addDependency"
    | "deleteDependency"
    | "changeDependency";
  functionOrPropertyImportDependencyName: string;
  fullCodeToInsertOrChange: PsTsMorphNewFunction | string | undefined;
}