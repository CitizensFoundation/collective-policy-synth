import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import fetch from "node-fetch";
import { IngestionCleanupAgent } from "./cleanupAgent.js";
import { IngestionSplitAgent } from "./splitAgent.js";
import { BaseIngestionAgent } from "./baseAgent.js";
import { ChunkCompressorAgent } from "./chunkCompressorAgent.js";
export class IngestionAgentProcessor extends BaseIngestionAgent {
    dataLayoutPath;
    cachedFiles = [];
    fileMetadataPath = "./ingestion/cache/fileMetadata.json";
    fileMetadata = {};
    initialFileMetadata = {};
    constructor(dataLayoutPath = "file://ingestion/dataLayout.json") {
        super();
        this.dataLayoutPath = dataLayoutPath;
        this.loadFileMetadata()
            .then(() => {
            console.log("Metadata loaded");
        })
            .catch((err) => {
            console.error("Failed to load file metadata:", err);
        });
    }
    async processDataLayout() {
        await this.loadFileMetadata(); // Load existing metadata to compare against
        this.initialFileMetadata = JSON.parse(JSON.stringify(this.fileMetadata)); // Deep copy for initial state comparison
        const dataLayout = await this.readDataLayout();
        await this.downloadAndCache(dataLayout.documentUrls, false);
        await this.processJsonUrls(dataLayout.jsonUrls);
        await this.saveFileMetadata();
        const filesForProcessing = this.getFilesForProcessing();
        this.processFiles(filesForProcessing);
    }
    async processFilePart(fileId, dataPart) {
        const cleanupAgent = new IngestionCleanupAgent();
        const cleanedUpData = await cleanupAgent.clean(dataPart);
        const splitAgent = new IngestionSplitAgent();
        const chunkCompressor = new ChunkCompressorAgent();
        const chunks = await splitAgent.splitDocumentIntoChunks(cleanedUpData);
        for (const [chunkId, chunkData] of Object.entries(chunks)) {
            let chunkCompression = await chunkCompressor.compress(chunkData);
            const compressedData = `${chunkCompression.title} ${chunkCompression.shortDescription} ${chunkCompression.fullCompressedContents}`;
            const metadata = this.fileMetadata[fileId] || {};
            metadata.chunks = metadata.chunks || {};
            metadata.chunks[chunkId] = {
                title: chunkCompression.title,
                shortSummary: chunkCompression.shortDescription,
                fullSummary: chunkCompression.fullCompressedContents,
                isValid: true,
                metaData: chunkCompression.textMetaData,
                fullText: chunkData,
            };
            // Save to weaviate
            console.log(`Chunk ${chunkId} compressed:`, compressedData);
            console.log(JSON.stringify(metadata.chunks[chunkId]), null, 2);
        }
    }
    async processFiles(files) {
        for (const filePath of files) {
            try {
                const data = await fs.readFile(filePath, "utf-8");
                const fileId = this.extractFileIdFromPath(filePath);
                if (!fileId) {
                    console.error(`Cannot extract fileId from path: ${filePath}`);
                    continue;
                }
                // Split file data if it exceeds the max token length
                if (this.getEstimateTokenLength(data) > this.maxFileProcessTokenLength) {
                    const dataParts = this.splitDataForProcessing(data);
                    for (const part of dataParts) {
                        await this.processFilePart(fileId, part); // Process each part of the file
                    }
                }
                else {
                    await this.processFilePart(fileId, data); // Process the entire file as one part
                }
            }
            catch (error) {
                console.error(`Failed to process file ${filePath}:`, error);
            }
        }
        await this.saveFileMetadata();
    }
    extractFileIdFromPath(filePath) {
        const url = Object.values(this.fileMetadata).find((meta) => filePath.includes(meta.key))?.url;
        return url ? this.generateFileId(url) : null;
    }
    getFilesForProcessing() {
        const filesForProcessing = [];
        // Compare current fileMetadata with initialFileMetadata
        for (const [fileId, metadata] of Object.entries(this.fileMetadata)) {
            const initialMetadata = this.initialFileMetadata[fileId];
            // Check if file is new or has been changed
            if (!initialMetadata || initialMetadata.hash !== metadata.hash) {
                filesForProcessing.push(metadata.url); // Add URL to processing list; adjust as needed
            }
        }
        return filesForProcessing;
    }
    updateCachedFilesAndMetadata(fileName, url, data) {
        const key = this.generateFileId(url);
        const hash = this.computeHash(data);
        if (!this.cachedFiles.includes(fileName)) {
            this.cachedFiles.push(fileName);
        }
        this.fileMetadata[key] = {
            key, // Include the unique key in metadata
            url,
            lastModified: new Date().toISOString(),
            size: data.length,
            hash,
        };
        console.log(`Cached file ${fileName}`);
    }
    async readDataLayout() {
        let dataLayout;
        if (this.dataLayoutPath.startsWith("file://")) {
            const filePath = this.dataLayoutPath.replace("file://", "");
            const data = await fs.readFile(filePath, "utf-8");
            dataLayout = JSON.parse(data);
        }
        else {
            try {
                const response = await fetch(this.dataLayoutPath);
                dataLayout = (await response.json());
            }
            catch (error) {
                throw new Error(`Failed to read data layout from ${this.dataLayoutPath}: ${error}`);
            }
        }
        return dataLayout;
    }
    async downloadAndCache(urls, isJsonData) {
        for (const url of urls) {
            try {
                const fileId = this.generateFileId(url);
                const response = await fetch(url, { method: "HEAD" });
                if (!response.ok) {
                    throw new Error(`HEAD request failed with status ${response.status} for URL ${url}`);
                }
                const lastModified = response.headers.get("Last-Modified") ?? new Date().toISOString();
                const contentLength = parseInt(response.headers.get("Content-Length") ?? "0", 10);
                const existingMetadata = this.fileMetadata[fileId];
                if (!existingMetadata || existingMetadata.lastModified !== lastModified || existingMetadata.size !== contentLength) {
                    try {
                        const contentResponse = await fetch(url);
                        if (!contentResponse.ok) {
                            throw new Error(`Content fetch failed with status ${contentResponse.status} for URL ${url}`);
                        }
                        const arrayBuffer = await contentResponse.arrayBuffer();
                        const data = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer
                        const fileName = this.getFileName(url, isJsonData);
                        // Ensure the directory exists
                        await fs.mkdir(path.dirname(fileName), { recursive: true });
                        // Write the file
                        await fs.writeFile(fileName, data);
                        // Update metadata and cachedFiles list
                        this.updateCachedFilesAndMetadata(fileName, url, data);
                    }
                    catch (error) {
                        console.error(`Failed to download content for URL ${url}:`, error.message);
                        // Optionally, log the error to a file or handle it as needed
                    }
                }
            }
            catch (error) {
                console.error(`Failed to process URL ${url}:`, error.message);
                // Optionally, log the error to a file or handle it as needed
            }
        }
        // Save the updated metadata to disk
        await this.saveFileMetadata();
    }
    async processJsonUrls(urls) {
        for (const url of urls) {
            const response = await fetch(url);
            const jsonData = await response.json();
            const folderHash = crypto.createHash("md5").update(url).digest("hex");
            const folderPath = `./ingestion/cache/${folderHash}`;
            await fs.mkdir(folderPath, { recursive: true });
            const jsonFilePath = `${folderPath}/data.json`;
            await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
            this.cachedFiles.push(jsonFilePath); // Track cached JSON file
            const urlsToFetch = this.getExternalUrlsFromJson(jsonData);
            await this.downloadAndCache(urlsToFetch, true); // Download and cache content from URLs found in JSON
        }
    }
    async loadFileMetadata() {
        try {
            const metadataJson = await fs.readFile(this.fileMetadataPath, "utf-8");
            this.fileMetadata = JSON.parse(metadataJson);
        }
        catch (error) {
            console.log("No existing metadata found, starting fresh.");
            this.fileMetadata = {};
        }
    }
    async saveFileMetadata() {
        await fs.writeFile(this.fileMetadataPath, JSON.stringify(this.fileMetadata, null, 2));
    }
}
