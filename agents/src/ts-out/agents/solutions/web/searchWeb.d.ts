import { BaseProcessor } from "../../baseProcessor.js";
export declare class SearchWebProcessor extends BaseProcessor {
    seenUrls: Map<string, Set<string>>;
    callSearchApi(query: string): Promise<IEngineSearchResultItem[]>;
    getQueryResults(queriesToSearch: string[], id: string): Promise<{
        searchResults: IEngineSearchResultItem[];
    }>;
    processSubProblems(searchQueryType: IEngineWebPageTypes): Promise<void>;
    processEntities(subProblemIndex: number, searchQueryType: IEngineWebPageTypes): Promise<void>;
    processProblemStatement(searchQueryType: IEngineWebPageTypes): Promise<void>;
    process(): Promise<void>;
}
//# sourceMappingURL=searchWeb.d.ts.map