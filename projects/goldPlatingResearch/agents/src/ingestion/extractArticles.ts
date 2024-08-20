import { PolicySynthAgent } from "@policysynth/agents/base/agent.js";
import { PsAgent } from "@policysynth/agents/dbModels/agent.js";
import {
  PsAiModelType,
  PsAiModelSize,
} from "@policysynth/agents/aiModelTypes.js";
import {IcelandicLawXmlAgent} from './icelandicLaw.js';


export class ArticleExtractionAgent extends PolicySynthAgent {
  declare memory: GoldPlatingMemoryData;

  modelSize: PsAiModelSize = PsAiModelSize.Medium;
  maxModelTokensOut = 15192;
  modelTemperature = 0.0;

  maxExtractionRetries: number = 3;
  maxValidationRetries: number = 3;

  constructor(
    agent: PsAgent,
    memory: GoldPlatingMemoryData,
    startProgress: number,
    endProgress: number
  ) {
    super(agent, memory, startProgress, endProgress);
  }

  async processItem(
    text: string,
    type: "law" | "regulation" | "lawSupportArticle",
    xmlUrl?: string
  ): Promise<LawArticle[] | RegulationArticle[]> {
    await this.updateRangedProgress(
      0,
      `Starting article extraction for ${type}`
    );

    try {
      let validatedArticles;
      if (type=="law" && xmlUrl && xmlUrl.endsWith(".xml")) {
        const icelandicLawXmlAgent = new IcelandicLawXmlAgent(this.agent, this.memory, 0,20);
        validatedArticles = await icelandicLawXmlAgent.processItem(xmlUrl);
      } else {
        const lastArticleNumber = await this.getLastArticleNumber(text, type);
        const extractedArticles = await this.extractArticles(
          text,
          type,
          lastArticleNumber
        );

        /*const validatedArticles = await this.validateExtractedArticles(
          text,
          extractedArticles,
          type
        );*/

        validatedArticles = extractedArticles;
      }

      await this.updateRangedProgress(
        100,
        `Article extraction completed for ${type}`
      );
      return validatedArticles || [];
    } catch (error) {
      this.logger.error(`Error during article extraction: ${error}`);
      throw error;
    }
  }

  private async getLastArticleNumber(
    text: string,
    type: "law" | "regulation" | "lawSupportArticle"
  ): Promise<number> {
    let lookForText;
    if (type == "law") {
      lookForText = "N. gr.";
    } else if (type == "regulation") {
      lookForText = "N.";
    } else if (type == "lawSupportArticle") {
      lookForText = "Um N. gr.";
    } else {
      throw new Error(`Invalid type: ${type}`);
    }

    const systemPrompt = `Analyze the following ${type} text and identify the number of the last article. Look for the last instance of article number in this format ${lookForText}.
    Return a JSON markdown object with the format:
    \`\`\`json
    {
      "lastArticleNumber": <number>
    }
    \`\`\`

    Only output the JSON object without any other explanations.`;
    const userPrompt = `${type} to analyize for last article number, your JSON markdown format output:\n${text}`;

    const result = (await this.callModel(
      PsAiModelType.Text,
      PsAiModelSize.Medium,
      [
        this.createSystemMessage(systemPrompt),
        this.createHumanMessage(userPrompt),
      ],
      true
    )) as { lastArticleNumber: number };

    if (
      typeof result.lastArticleNumber !== "number" ||
      result.lastArticleNumber <= 0
    ) {
      throw new Error(
        `Invalid last article number: ${result.lastArticleNumber}`
      );
    }

    this.logger.debug(`Last article number: ${result.lastArticleNumber}`);

    return result.lastArticleNumber;
  }

  getArticleTextNumber(
    type: "law" | "regulation" | "lawSupportArticle",
    articleNumber: number
  ): string {
    if (type === "law") {
      return `${articleNumber}. gr.`;
    } else if (type === "regulation") {
      return `${articleNumber}.`;
    } else if (type === "lawSupportArticle") {
      return `Um ${articleNumber}. gr.`;
    } else {
      throw new Error(`Invalid type: ${type}`);
    }
  }

  private async extractArticles(
    text: string,
    type: "law" | "regulation" | "lawSupportArticle",
    lastArticleNumber: number
  ): Promise<(LawArticle | RegulationArticle)[]> {
    const articles: (LawArticle | RegulationArticle)[] = [];

    for (let i = 1; i <= lastArticleNumber; i++) {
      let articleNumberText = this.getArticleTextNumber(type, i);
      let nextArticleNumberText;

      if (i < lastArticleNumber) {
        nextArticleNumberText = this.getArticleTextNumber(type, i + 1);
      }

      const article = await this.extractSingleArticle(
        text,
        type,
        i,
        articleNumberText,
        nextArticleNumberText
      );
      if (article) {
        articles.push(article);
        this.logger.debug(
          `Extracted article ${i}:\n${JSON.stringify(article, null, 2)}`
        );
      } else {
        this.logger.error(`Failed to extract article ${i}`);
      }
      await this.updateRangedProgress(
        (i / lastArticleNumber) * 50, // Use only 50% of the progress for extraction
        `Extracting article ${i} of ${lastArticleNumber}`
      );
    }

    return articles;
  }

  private async extractSingleArticle(
    text: string,
    type: "law" | "regulation" | "lawSupportArticle",
    articleNumber: number,
    articleNumberText: string,
    nextArticleNumberText?: string
  ): Promise<LawArticle | RegulationArticle | null> {
    let retryCount = 0;
    while (retryCount < this.maxExtractionRetries) {
      try {
        const articleText = await this.callExtractionModel(
          text,
          type,
          articleNumberText,
          nextArticleNumberText
        );

        this.logger.debug(
          `Extracted article ${articleNumberText}:\n${articleText}`
        );

        const result = {
          number: articleNumber,
          text: articleText,
        };

        if (this.isValidExtractionResult(result)) {
          return result;
        }
      } catch (error) {
        this.logger.warn(`Error extracting article ${articleNumber}: ${error}`);
      }
      retryCount++;
      this.logger.warn(
        `Extraction failed for article ${articleNumber}, retrying (${retryCount}/${this.maxExtractionRetries})`
      );
    }
    this.logger.error(
      `Failed to extract article ${articleNumber} after ${this.maxExtractionRetries} attempts`
    );
    return null;
  }

  private async callExtractionModel(
    text: string,
    type: "law" | "regulation" | "lawSupportArticle",
    articleNumber: string,
    nextArticleNumberText?: string
  ): Promise<string> {
    const systemPrompt = `Extract the an article from the ${type} text.
    The user will provide you with the article number in the format: ${articleNumber}, only extract that article exactly as it appears in the ${type} text.
    ${
      nextArticleNumberText
        ? `The law article might reference other laws by numbers in the same reference format but you must extract fully until the next ${type} article: ${nextArticleNumberText}`
        : ""
    }
    Output the extracted article exactly as it appears in the <${type}TextToExtractFrom> text, word for word without any expainations before or after.
    ${
      type == "lawSupportArticle"
        ? `The support text articles start after the main law articles in ths provided text, so only look for the ${articleNumber} lawSupportArticle after the word 'Greinargerð' appears in the document`
        : ""
    }
    `;

    const userPrompt = `<${type}TextToExtractFrom>${text}</${type}TextToExtractFrom>

    <articleNumberToExtract>${articleNumber}</articleNumberToExtract>
    ${
      nextArticleNumberText
        ? `<extractUntilThisNextArticleStart>${nextArticleNumberText}</extractUntilThisNextArticleStart>`
        : ""
    }

    Your fully extracted ${type} article in text format:
    `;

    return (await this.callModel(
      PsAiModelType.Text,
      PsAiModelSize.Medium,
      [
        this.createSystemMessage(systemPrompt),
        this.createHumanMessage(userPrompt),
      ],
      false
    )) as string;
  }

  private isValidExtractionResult(
    result: any
  ): result is LawArticle | RegulationArticle {
    return (
      typeof result === "object" &&
      typeof result.number === "number" &&
      typeof result.text === "string" &&
      result.text.trim().length > 0
    );
  }

  private async validateExtractedArticles(
    originalText: string,
    extractedArticles: (LawArticle | RegulationArticle)[],
    type: "law" | "regulation" | "lawSupportArticle"
  ): Promise<(LawArticle | RegulationArticle)[]> {
    let validationRetries = 0;
    while (validationRetries < this.maxValidationRetries) {
      const systemPrompt = `You are an expert validator for legal documents. Your task is to compare extracted articles with the original text and verify their accuracy and completeness. Follow these steps:

1. Analyze the original text and the extracted articles.
2. Check if all articles from the original text are present in the extracted articles.
3. Verify that the content of each extracted article matches the corresponding article in the original text.
4. If any discrepancies are found, identify missing or incorrect articles.
5. Return a JSON markdown object with the following format:
   {
     "valid": boolean,
     "missingArticles": string[] (optional),
     "incorrectArticles": string[] (optional)
   }
6. Only output JSON without any other explainations
7. If everything is correct, set "valid" to true and omit the other fields.
8. If discrepancies are found, set "valid" to false and include the relevant "missingArticles" and/or "incorrectArticles" arrays.`;

      const userPrompt = `Validate the following extracted articles against the original ${type} text:

Original ${type} text:
${originalText}...

Extracted articles:
${JSON.stringify(extractedArticles, null, 2)}

Please provide your validation result in JSON format:`;

      const validationResult = (await this.callModel(
        PsAiModelType.Text,
        PsAiModelSize.Medium,
        [
          this.createSystemMessage(systemPrompt),
          this.createHumanMessage(userPrompt),
        ],
        true
      )) as {
        valid: boolean;
        missingArticles?: string[];
        incorrectArticles?: string[];
      };

      if (validationResult.valid) {
        this.logger.info("Validation successful. No discrepancies found.");
        return extractedArticles;
      }

      this.logger.warn("Validation failed. Attempting to fix discrepancies.");
      console.warn("Validation failed. Discrepancies found:", validationResult);

      // Attempt to fix discrepancies
      if (validationResult.missingArticles) {
        for (let i = 0; i > validationResult.missingArticles.length; i++) {
          const articleNumber = validationResult.missingArticles[i];
          const missingArticle = await this.extractSingleArticle(
            originalText,
            type,
            parseInt(articleNumber),
            articleNumber
          );
          if (missingArticle) {
            extractedArticles.push(missingArticle);
            this.logger.debug(`Added missing article ${articleNumber}`);
          }
        }
      }

      if (validationResult.incorrectArticles) {
        for (let i = 0; i > validationResult.incorrectArticles.length; i++) {
          const articleNumber = validationResult.incorrectArticles[i];
          const index = extractedArticles.findIndex(
            (a) => a.number === parseInt(articleNumber)
          );
          if (index !== -1) {
            const correctedArticle = await this.extractSingleArticle(
              originalText,
              type,
              parseInt(articleNumber),
              articleNumber
            );
            if (correctedArticle) {
              extractedArticles[index] = correctedArticle;
              this.logger.debug(`Corrected article ${articleNumber}`);
            }
          }
        }
      }

      validationRetries++;
      this.logger.debug(`Validation attempt ${validationRetries}`);
      await this.updateRangedProgress(
        50 + (validationRetries / this.maxValidationRetries) * 50, // Use remaining 50% of progress for validation
        `Validation attempt ${validationRetries + 1}`
      );
    }

    this.logger.error(
      "Validation failed after maximum retries. Returning current results."
    );
    return extractedArticles;
  }
}