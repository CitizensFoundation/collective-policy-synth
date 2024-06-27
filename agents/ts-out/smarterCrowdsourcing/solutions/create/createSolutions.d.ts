import { BaseSmarterCrowdsourcingAgent } from "../../baseAgent.js";
export declare class CreateSolutionsProcessor extends BaseSmarterCrowdsourcingAgent {
    useLanguage: string | undefined;
    renderCreateSystemMessage(): PsModelMessage;
    renderCreatePrompt(subProblemIndex: number, solutionsForInspiration: PsSolution[], alreadyCreatedSolutions?: string | undefined): Promise<PsModelMessage[]>;
    createSolutions(subProblemIndex: number, solutionsForInspiration: PsSolution[], alreadyCreatedSolutions?: string | undefined, stageName?: string): Promise<PsSolution[]>;
    countTokensForString(text: string): Promise<number>;
    getRandomSolutions(subProblemIndex: number, alreadyCreatedSolutions: string | undefined): PsSolution[];
    getRandomItemsFromArray<T>(array: T[], count: number): T[];
    getRandomItemFromArray<T>(array: T[], useTopN?: number | undefined): "" | T;
    createAllSeedSolutions(): Promise<void>;
    process(): Promise<void>;
}
//# sourceMappingURL=createSolutions.d.ts.map