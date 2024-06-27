import { BaseSmarterCrowdsourcingAgent } from "../../baseAgent.js";
export declare class SearchWebProcessor extends BaseSmarterCrowdsourcingAgent {
    seenUrls: Map<string, Set<string>>;
    callSearchApi(query: string): Promise<PsSearchResultItem[]>;
    getQueryResults(queriesToSearch: string[], id: string): Promise<{
        searchResults: PsSearchResultItem[];
    }>;
    processSubProblems(searchQueryType: PsWebPageTypes): Promise<void>;
    processEntities(subProblemIndex: number, searchQueryType: PsWebPageTypes): Promise<void>;
    processProblemStatement(searchQueryType: PsWebPageTypes): Promise<void>;
    process(): Promise<void>;
}
//# sourceMappingURL=searchWeb.d.ts.map