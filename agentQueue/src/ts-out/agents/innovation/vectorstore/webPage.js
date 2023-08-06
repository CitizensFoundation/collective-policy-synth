import weaviate from "weaviate-ts-client";
import { Base } from "../../../base.js";
import { IEngineConstants } from "../../../constants.js";
import fs from "fs/promises";
export class WebPageVectorStore extends Base {
    //@ts-ignore
    static client = weaviate.client({
        scheme: process.env.WEAVIATE_HTTP_SCHEME || "http",
        host: process.env.WEAVIATE_HOST || "localhost:8080",
    });
    async addSchema() {
        let classObj;
        try {
            const data = await fs.readFile("./schemas/webPage.json", "utf8");
            classObj = JSON.parse(data);
        }
        catch (err) {
            console.error(`Error reading file from disk: ${err}`);
            return;
        }
        try {
            const res = await WebPageVectorStore.client.schema
                .classCreator()
                .withClass(classObj)
                .do();
            console.log(res);
        }
        catch (err) {
            console.error(`Error creating schema: ${err}`);
        }
    }
    async showScheme() {
        try {
            const res = await WebPageVectorStore.client.schema.getter().do();
            console.log(JSON.stringify(res, null, 2));
        }
        catch (err) {
            console.error(`Error creating schema: ${err}`);
        }
    }
    async deleteScheme() {
        try {
            const res = await WebPageVectorStore.client.schema
                .classDeleter()
                .withClassName("WebPage")
                .do();
            console.log(res);
        }
        catch (err) {
            console.error(`Error creating schema: ${err}`);
        }
    }
    async testQuery() {
        const where = [];
        where.push({
            path: ["len(solutionsIdentifiedInTextContext)"],
            operator: "GreaterThan",
            valueInt: 0,
        });
        const res = await WebPageVectorStore.client.graphql
            .get()
            .withClassName("WebPage")
            .withWhere({
            operator: "And",
            operands: where,
        })
            .withFields("summary groupId entityId subProblemIndex relevanceToProblem \
        solutionsIdentifiedInTextContext mostRelevantParagraphs contacts tags entities \
        _additional { distance }")
            .withNearText({ concepts: ["democracy"] })
            .withLimit(100)
            .do();
        console.log(JSON.stringify(res, null, 2));
        return res;
    }
    async postWebPage(webPageAnalysis) {
        return new Promise((resolve, reject) => {
            WebPageVectorStore.client.data
                .creator()
                .withClassName("WebPage")
                .withProperties(webPageAnalysis)
                .do()
                .then((res) => {
                this.logger.info(`Weaviate: Have saved web page ${webPageAnalysis.url}`);
                resolve(res);
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
    async updateWebPage(id, webPageAnalysis) {
        return new Promise((resolve, reject) => {
            WebPageVectorStore.client.data
                .updater()
                .withId(id)
                .withClassName("WebPage")
                .withProperties(webPageAnalysis)
                .do()
                .then((res) => {
                this.logger.info(`Weaviate: Have updated web page ${webPageAnalysis.url}`);
                resolve(res);
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
    async updateWebSolutions(id, webSolutions) {
        return new Promise((resolve, reject) => {
            WebPageVectorStore.client.data
                .merger()
                .withId(id)
                .withClassName("WebPage")
                .withProperties({
                solutionsIdentifiedInTextContext: webSolutions,
            })
                .do()
                .then((res) => {
                this.logger.info(`Weaviate: Have updated web solutions for ${id}`);
                resolve(res);
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
    async getWebPage(id) {
        return new Promise((resolve, reject) => {
            WebPageVectorStore.client.data
                .getterById()
                .withId(id)
                .withClassName("WebPage")
                .do()
                .then((res) => {
                this.logger.info(`Weaviate: Have got web page ${id}`);
                const webData = res
                    .properties;
                resolve(webData);
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
    async getWebPagesForProcessing(groupId, subProblemIndex, entityIndex, cursor, batchSize = 10, solutionCountLimit = 7) {
        const where = [
            {
                path: ["groupId"],
                operator: "Equal",
                valueInt: groupId,
            },
        ];
        if (subProblemIndex) {
            where.push({
                path: ["subProblemIndex"],
                operator: "Equal",
                valueInt: subProblemIndex,
            });
        }
        else {
            //TODO: Enable when null index has been merged into schema
            /*where.push({
              path: ["subProblemIndex"],
              operator: "IsNull",
              valueBoolean: true,
            });*/
        }
        if (entityIndex) {
            where.push({
                path: ["entityIndex"],
                operator: "Equal",
                valueInt: entityIndex,
            });
        }
        else {
            /*where.push({
              path: ["entityIndex"],
              operator: "IsNull",
              valueBoolean: true,
            });*/
        }
        where.push({
            path: ["len(solutionsIdentifiedInTextContext)"],
            operator: "GreaterThan",
            valueInt: solutionCountLimit,
        });
        let query;
        try {
            query = WebPageVectorStore.client.graphql
                .get()
                .withClassName("WebPage")
                .withLimit(batchSize)
                .withWhere({
                operator: "And",
                operands: where,
            })
                .withFields("searchType groupId entityId subProblemIndex summary relevanceToProblem \
          solutionsIdentifiedInTextContext url mostRelevantParagraphs tags entities contacts \
          _additional { distance }");
            return await query.withAfter(cursor).do();
        }
        catch (err) {
            throw err;
        }
    }
    async webPageExist(groupId, url, searchType, subProblemIndex, entityIndex) {
        //TODO: Fix any here
        const where = [];
        where.push({
            path: ["groupId"],
            operator: "Equal",
            valueInt: groupId,
        });
        where.push({
            path: ["url"],
            operator: "Equal",
            valueString: url,
        });
        where.push({
            path: ["searchType"],
            operator: "Equal",
            valueString: searchType,
        });
        if (subProblemIndex !== undefined) {
            where.push({
                path: ["subProblemIndex"],
                operator: "Equal",
                valueInt: subProblemIndex,
            });
        }
        if (entityIndex !== undefined) {
            where.push({
                path: ["entityIndex"],
                operator: "Equal",
                valueInt: entityIndex,
            });
        }
        let results;
        try {
            results = await WebPageVectorStore.client.graphql
                .get()
                .withClassName("WebPage")
                .withLimit(20)
                .withWhere({
                operator: "And",
                operands: where,
            })
                .withFields("searchType subProblemIndex summary relevanceToProblem \
          solutionsIdentifiedInTextContext url mostRelevantParagraphs tags entities \
          _additional { distance }")
                .do();
            const resultPages = results.data.Get["WebPage"];
            if (resultPages.length > 0) {
                let allSubProblems = true;
                let allEntities = true;
                resultPages.forEach((page) => {
                    if (page.subProblemIndex === undefined) {
                        allSubProblems = false;
                    }
                    if (page.entityIndex === undefined) {
                        allEntities = false;
                    }
                });
                if (subProblemIndex === undefined) {
                    if (!allSubProblems) {
                        return true;
                    }
                }
                if (entityIndex === undefined && subProblemIndex !== undefined) {
                    if (!allEntities) {
                        return true;
                    }
                }
                if (subProblemIndex !== undefined && entityIndex !== undefined) {
                    return true;
                }
            }
            return false;
        }
        catch (err) {
            throw err;
        }
    }
    async searchWebPages(query, groupId, subProblemIndex, searchType, filterOutEmptySolutions = true) {
        //TODO: Fix any here
        const where = [];
        if (groupId) {
            where.push({
                path: ["groupId"],
                operator: "Equal",
                valueInt: groupId,
            });
        }
        if (subProblemIndex) {
            where.push({
                path: ["subProblemIndex"],
                operator: "Equal",
                valueInt: subProblemIndex,
            });
        }
        if (searchType) {
            where.push({
                path: ["searchType"],
                operator: "Equal",
                valueString: searchType,
            });
        }
        if (filterOutEmptySolutions) {
            where.push({
                path: ["len(solutionsIdentifiedInTextContext)"],
                operator: "GreaterThan",
                valueInt: 0,
            });
        }
        let results;
        try {
            results = await WebPageVectorStore.client.graphql
                .get()
                .withClassName("WebPage")
                .withNearText({ concepts: [query] })
                .withLimit(IEngineConstants.limits.webPageVectorResultsForNewSolutions)
                .withWhere({
                operator: "And",
                operands: where,
            })
                .withFields("searchType subProblemIndex summary relevanceToProblem \
          solutionsIdentifiedInTextContext url mostRelevantParagraphs tags entities \
          _additional { distance }")
                .do();
        }
        catch (err) {
            throw err;
        }
        return results;
    }
}
