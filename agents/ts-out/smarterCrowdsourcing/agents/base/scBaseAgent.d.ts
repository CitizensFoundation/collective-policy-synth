import { Job } from "bullmq";
import { PolicySynthOperationsAgent } from "../../../base/operationsAgent.js";
import { PsAgent } from "../../../dbModels/agent.js";
export declare abstract class BaseSmarterCrowdsourcingAgent extends PolicySynthOperationsAgent {
    memory: PsSmarterCrowdsourcingMemoryData;
    job: Job;
    currentSubProblemIndex: number | undefined;
    constructor(agent: PsAgent, memory: PsAgentMemoryData | undefined, startProgress: number, endProgress: number);
    static getConfigurationQuestions(): YpStructuredQuestionData[];
    static getMainConfigurationSettings(): YpStructuredQuestionData[];
    static getExtraConfigurationQuestions(): YpStructuredQuestionData[];
    static getMainCommonConfigurationSettings(): YpStructuredQuestionData[];
    get secondaryColors(): any;
    get problemStatementDescription(): string;
    get rankSubProblemsInstructions(): string;
    get directRootCauseUrlsToScan(): string[];
    get subProblemClientColors(): any;
    get subProblemColors(): any;
    static getExtraCommonConfigurationQuestions(): YpStructuredQuestionData[];
    get generateInLanguage(): string;
    get maxSubProblems(): number;
    get maxNumberGeneratedOfEntities(): number;
    get maxStabilityRetryCount(): number;
    get rankingLLMmaxRetryCount(): number;
    get maxTopEntitiesToSearch(): number;
    get maxTopEntitiesToRender(): number;
    get maxTopQueriesToSearchPerType(): number;
    get mainSearchRetryCount(): number;
    get maxDalleRetryCount(): number;
    get maxTopWebPagesToGet(): number;
    get maxBingSearchResults(): number;
    get maxTopProsConsUsedForRating(): number;
    get maxNumberGeneratedProsConsForSolution(): number;
    get minSleepBeforeBrowserRequest(): number;
    get maxAdditionalRandomSleepBeforeBrowserRequest(): number;
    get numberOfSearchTypes(): number;
    get webPageNavTimeout(): number;
    get currentUserAgent(): string;
    get tokenInLimit(): number;
    get maxTopRootCauseQueriesToSearchPerType(): number;
    get maxRootCausePercentOfSearchResultWebPagesToGet(): number;
    get maxRootCausesToUseForRatingRootCauses(): number;
    get topWebPagesToGetForRefineRootCausesScan(): number;
    get subProblemsRankingMinNumberOfMatches(): number;
    get rootCauseFieldTypes(): never[];
    get createEntitiesRefinedEnabled(): boolean;
    get createSubProblemsRefineEnabled(): boolean;
    get topItemsToKeepForTopicClusterPruning(): number;
    get maxTopSearchQueriesForSolutionCreation(): number;
    get maxPercentOfSolutionsWebPagesToGet(): number;
    get createSolutionsNotUsingTopSearchQueriesChance(): number;
    get createSolutionsWebSolutionsTopChance(): number;
    get createSolutionsWebSolutionsTopThreeChance(): number;
    get createSolutionsWebSolutionsTopSevenChance(): number;
    get createSolutionsVectorSearchAcrossAllProblemsChance(): number;
    get useRandomTopFromVectorSearchResultsLimits(): number;
    get createSolutionsSearchQueriesUseMainProblemSearchQueriesChance(): number;
    get createSolutionsSearchQueriesUseOtherSubProblemSearchQueriesChance(): number;
    get createSolutionsSearchQueriesUseSubProblemSearchQueriesChance(): number;
    get createSolutionsRefineEnabled(): boolean;
    get createProsConsRefinedEnabled(): boolean;
    get evolutionPopulationSize(): number;
    get evolutionLimitTopTopicClusterElitesToEloRating(): number;
    get evolutionKeepElitePercent(): number;
    get evolutionRandomImmigrationPercent(): number;
    get evolutionMutationOffspringPercent(): number;
    get evolutionCrossoverPercent(): number;
    get evolutionLowMutationRate(): number;
    get evolutionMediumMutationRate(): number;
    get evolutionHighMutationRate(): number;
    get evolutionSelectParentTournamentSize(): number;
    get evolutionCrossoverMutationPercent(): number;
    get maxTopSolutionsToCreatePolicies(): number;
    get maxTopPoliciesToProcess(): number;
    get maxEvidenceToUseForRatingEvidence(): number;
    get policyEvidenceFieldTypes(): string[];
    get maxTopEvidenceQueriesToSearchPerType(): number;
    get maxPercentOfEloMatched(): number;
    get minimumNumberOfPairwiseVotesForPopulation(): number;
    get maxNumberOfPairwiseRankingPrompts(): number;
    get customInstructionsRankSolutions(): string;
    simplifyEvidenceType(evidenceType: string): string;
    simplifyRootCauseType(rootCauseType: string): string;
    getProCons(prosCons: PsProCon[] | undefined): string[];
    lastPopulationIndex(subProblemIndex: number): number;
    renderSubProblem(subProblemIndex: number, useProblemAsHeader?: boolean): string;
    renderSubProblemSimple(subProblemIndex: number): string;
    getActiveSolutionsLastPopulation(subProblemIndex: number): PsSolution[];
    getActiveSolutionsFromPopulation(subProblemIndex: number, populationIndex: number): PsSolution[];
    numberOfPopulations(subProblemIndex: number): number;
    renderSubProblems(): string;
    renderEntity(subProblemIndex: number, entityIndex: number): string;
    renderProblemStatement(): string;
    renderProblemStatementSubProblemsAndEntities(index: number, includeMainProblemStatement?: boolean): string;
    renderEntityPosNegReasons(item: PsAffectedEntity): string;
}
//# sourceMappingURL=scBaseAgent.d.ts.map