import { BaseProlemSolvingAgent } from "../../baseProblemSolvingAgent.js";
import { HumanMessage, SystemMessage } from "langchain/schema";
export declare class CreateEntitiesProcessor extends BaseProlemSolvingAgent {
    renderRefinePrompt(subProblemIndex: number, results: IEngineAffectedEntity[]): Promise<(HumanMessage | SystemMessage)[]>;
    renderCreatePrompt(subProblemIndex: number): Promise<(HumanMessage | SystemMessage)[]>;
    createEntities(): Promise<void>;
    process(): Promise<void>;
}
//# sourceMappingURL=createEntities.d.ts.map