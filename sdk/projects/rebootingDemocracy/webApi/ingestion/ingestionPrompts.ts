// ANALYSIS

export const analysisSystemMessage =  `You are an expert document analyze.

Instructions:
- You will analyze the document and output your analysis in this JSON format: {
  title: string;
  shortDescription: string;
  description: string;
  fullDescriptionOfAllContents: string;
  documentMetaData: { [key: string]: string };
  references: string[],
  allUrls: strings[]
}
`;

export const analysisUserMessage = (data: string) => `Document to analyze:
${data}
`;

// CLEANUP

export const cleanupSystemMessage = `You are an expert document cleaner. Your job is to help cleanup documents coming from various sources. PDFs, etc.

Instruction:
- We own all copyright to the materials we are cleaning for our RAG chatbot.
- Please cleanup the document and only output actual contents.
- Do no output any initial acknowledgments, table of contents, page numers, or any other PDF conversion artifacts, etc.
- Remove all repeated titles as those are coming from the PDF footer pages
- Only output titles and content paragraphs.
`;

export const cleanupUserMessage = (data: string) => `Document to cleanup and output again in full:
${data}
`;

// SPLIT STRATEGY

export const splitStrategySystemMessage = `You are an expert document split strategy generator.

Instructions:
- Your job is to analyze the text document and outline a strategy how best to split this document up into smaller sections based on it's contents.
- The contents should be split into sections that cover the same topic.
- Do not output the actual contents only the strategy on how to split it up.
- Do not split into sub sections, keep one topic per section.
- Do not talk about or suggest sub sections.
- Do not make up section names.
- If for example there is a short case study about one project, that should be one section not split into different sections.
- We always want to capture full contexts

Output:
- Reason about the task at hand.
- Then output a JSON array: [ {
sectionIndex: number,
sectionTitle: string,
directlyConnectedSectionIndexes: string[]
]`;

export const splitStrategyUserMessage = (data: string) => `Document to analyze and devise a split strategy for:
${data}
`;

// SPLIT INDEXES

export const getSplitIndexesSystemMessage = `You are an expert document splitter.

Instructions:
- You identify start of text lines as split points for a large document.
- You will receive detailed split strategy for how to identify the one line text indexes that I will later use to split up the document with.
- Your splits should never results in very small chunks.
- Always follow the split strategy given to you in detail.
- If the split strategy suggest 5 section, only create split indexes for 5 sections.
- Only split the document by top level topics not sub-topics or sub section.
- Output in this JSON format:
{ oneLineTextIndexesForSplittingDocument: string []
}`;

export const getSplitIndexesUserMessage = (splitStrategy: string, data: string) => `Split strategy to follow in detail:
${splitStrategy}

Document to find the split line indexes from:
${data}
`;

