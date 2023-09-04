import express from "express";
import axios from "axios";
import { createClient, } from "redis";
import { EvidenceWebPageVectorStore } from "../../agentQueue/src/agents/vectorstore/evidenceWebPage.js";
let redisClient;
if (process.env.REDIS_URL) {
    redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
            tls: true,
        },
    });
}
else {
    redisClient = createClient({
        url: "redis://localhost:6379",
    });
}
const memoryCache = {};
export class ProjectsController {
    path = "/api/projects";
    router = express.Router();
    evidenceWebPageVectorStore = new EvidenceWebPageVectorStore();
    constructor() {
        this.intializeRoutes();
    }
    async intializeRoutes() {
        this.router.get(this.path + "/:id/:forceBackupReloadId", this.getProject);
        this.router.get(this.path + "/:id", this.getProject);
        this.router.get(this.path + "/:id/:subProblemIndex/:policyIndex/rawEvidence", this.getRawEvidence);
        await redisClient.connect();
    }
    getRawEvidence = async (req, res) => {
        let projectData;
        /*const results =
        await this.evidenceWebPageVectorStore.getTopWebPagesForProcessing(
          req.params.id,
          req.params.subProblemIndex,
          searchType,
          req.params.policyTitle,
          limit,
          offset
        );*/
    };
    getProject = async (req, res) => {
        let projectData;
        console.error(`req.params.forceBackupReloadId: ${req.params.forceBackupReloadId}`);
        console.log(`Getting project data for ${req.params.id}`);
        const temporaryPasswordKey = `TEMP_PROJECT_${req.params.id}_PASSWORD`;
        const backupMemoryUrlKey = `BACKUP_PROJECT_URL_${req.params.id}`;
        if (process.env[temporaryPasswordKey] && !req.query.trm) {
            return res.send({
                needsTrm: true
            });
        }
        else if (process.env[temporaryPasswordKey] && req.query.trm) {
            if (req.query.trm !== process.env[temporaryPasswordKey]) {
                return res.send({
                    needsTrm: true
                });
            }
        }
        const filteredRedisCacheKey = `st_mem_filtered_v4:${req.params.id}:id`;
        if (process.env.NODE_ENV === "production" &&
            !req.params.forceBackupReloadId) {
            try {
                // Try to get from memory cache first
                if (memoryCache[filteredRedisCacheKey]) {
                    console.log("Using memory cache data");
                    return res.send(memoryCache[filteredRedisCacheKey].data);
                }
                const cachedData = await redisClient.get(filteredRedisCacheKey);
                if (cachedData) {
                    console.log("Using cached Redis data");
                    return res.send(JSON.parse(cachedData));
                }
            }
            catch (err) {
                console.error(err);
            }
        }
        if (!req.params.forceBackupReloadId) {
            try {
                const data = await redisClient.get(`st_mem:${req.params.id}:id`);
                projectData = data ? JSON.parse(data) : null;
            }
            catch (err) {
                console.error(err);
            }
        }
        if (!projectData && process.env[backupMemoryUrlKey]) {
            try {
                console.log(`Attempting to fetch data from backup URL: ${process.env[backupMemoryUrlKey]}`); // Log statement added
                const response = await axios.get(process.env[backupMemoryUrlKey]);
                projectData = response.data;
                await redisClient.set(`st_mem:${req.params.id}:id`, JSON.stringify(projectData));
            }
            catch (err) {
                console.error(err);
                return res.sendStatus(500);
            }
        }
        if (!projectData) {
            return res.sendStatus(404);
        }
        if (projectData.subProblems) {
            projectData.subProblems.forEach((subProblem) => {
                if (subProblem.solutions) {
                    subProblem.solutions.populations =
                        subProblem.solutions.populations.map((population) => population.filter((solution) => !solution.reaped));
                }
            });
        }
        const filterSearchResults = (searchResults) => {
            if (searchResults && searchResults.pages) {
                for (const key in searchResults.pages) {
                    searchResults.pages[key] = searchResults.pages[key].map((result) => ({
                        url: result.url || result.link,
                        title: result.title,
                        //@ts-ignore
                        description: result.description || result.snippet,
                    }));
                }
            }
            return searchResults;
        };
        if (projectData.problemStatement) {
            projectData.problemStatement.searchResults = filterSearchResults(projectData.problemStatement.searchResults);
        }
        if (projectData.subProblems) {
            projectData.subProblems.forEach((subProblem) => {
                subProblem.searchResults = filterSearchResults(subProblem.searchResults);
                if (subProblem.searchResults) {
                    //@ts-ignore
                    delete subProblem.searchResults.knowledgeGraph;
                }
            });
        }
        if (false && process.env.NODE_ENV === "production") {
            try {
                await redisClient.set(filteredRedisCacheKey, JSON.stringify({
                    isAdmin: true,
                    name: "Policy Synth - Democracy",
                    currentMemory: projectData,
                    configuration: {},
                }), {
                    EX: 60,
                });
                console.log("Caching memory data to redis");
            }
            catch (err) {
                console.error(err);
            }
        }
        const response = {
            isAdmin: true,
            name: "Policy Synth - Save Democracy!",
            currentMemory: projectData,
            configuration: {},
        };
        // Add to memory cache
        memoryCache[filteredRedisCacheKey] = {
            data: response,
            timer: setTimeout(() => {
                console.log("Deleting memory cache data");
                delete memoryCache[filteredRedisCacheKey];
            }, 60 * 60 * 1000),
        };
        console.log("Caching data to memory");
        return res.send(response);
    };
}