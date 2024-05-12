import { PsEngineerBaseProgrammingAgent } from "./baseAgent.js";
export declare class PsEngineerProgrammingImplementationAgent extends PsEngineerBaseProgrammingAgent {
    havePrintedFirstUserDebugMessage: boolean;
    get codingSystemPrompt(): string;
    codingUserPrompt(fileName: string, fileAction: PsEngineerFileActions, currentActions: PsEngineerCodingActionPlanItem[], curentFileToUpdateContents: string | undefined | null, completedActions: PsEngineerCodingActionPlanItem[], futureActions: PsEngineerCodingActionPlanItem[]): string;
    implementFileActions(fileName: string, fileAction: PsEngineerFileActions, completedActions: PsEngineerCodingActionPlanItem[], currentActions: PsEngineerCodingActionPlanItem[], futureActions: PsEngineerCodingActionPlanItem[]): Promise<string>;
    implementCodingActionPlan(actionPlan: PsEngineerCodingActionPlanItem[]): Promise<void>;
    deleteDependency(dependencyName: string): void;
    changeDependency(dependencyName: string, version: string): void;
}
//# sourceMappingURL=implementationAgent.d.ts.map