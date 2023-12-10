import { OpenAI } from "openai";
import { hrtime } from "process";
import { v4 as uuidv4 } from "uuid";

const DEBUGGING = true;

const config = {
  apiKey: process.env.OPENAI_KEY,
};

export const renderSystemPrompt = (causeToExmine: LtpCurrentRealityTreeDataNode | undefined = undefined) => {
  const prompt = `
    You are a helpful Logical Thinking Process assistant. We're working on Current Reality Trees.

    We will work step by step and down the Current Reality Tree, now we are

    ${ causeToExmine!=undefined ? `
      Please output 7 direct causes of the cause we are examining.
    `: `
      Please output 7 direct causes of the "Undesireable Effect" and analyse the "Possible Raw Unclassified Causes" for ideas.
    `}

    Please output each direct cause in JSON without any explanation:
      { directCauseDescription, isDirectCause<bool>, isLikelyARootCauseOfUDE<bool>, confidenceLevel<int> }
  `;

  return prompt;
};

export const renderUserPrompt = (
  currentRealityTree: LtpCurrentRealityTreeData,
  causeToExmine: LtpCurrentRealityTreeDataNode | undefined = undefined,
  parentNodes: LtpCurrentRealityTreeDataNode[] | undefined = undefined
) => {
  return `Context: ${currentRealityTree.context}
          Undesirable Effect: ${currentRealityTree.undesirableEffects[0]}
          Possible Raw Unclassified Causes: ${currentRealityTree.rawPossibleCauses || "None found, please figure it out yourself."}

          ${
            parentNodes
              ? parentNodes.map(
                  (node, index) => `
            ${index === 0 ? `Direct` : `Intermediate`} Cause:
            ${node.cause}

          `
                )
              : ""
          }

          ${
            causeToExmine
              ? `
            Cause to Examine: ${causeToExmine.cause}

            Output the possible Direct Causes of the cause we are examining here in JSON:
          `
              : `
            Possible Direct Causes JSON Output:
           `
          }

          `;
};

export const filterTopCauses = (
  parsedMessages: CrtPromptJson[]
): CrtPromptJson[] => {
  const directCauses = parsedMessages.filter(
    (message) => message.isDirectCause
  );
  const sortedMessages = directCauses.sort(
    (a, b) => b.confidenceLevel - a.confidenceLevel
  );
  const top3Messages = sortedMessages.slice(0, 3);
  return top3Messages;
};

export const convertToNodes = (
  topCauses: CrtPromptJson[]
): LtpCurrentRealityTreeDataNode[] => {
  return topCauses.map((cause) => {
    return {
      id: uuidv4(),
      cause: cause.directCauseDescription,
      isRootCause: cause.isLikelyARootCauseOfUDE,
      isLogicValidated: false,
    };
  });
};

export const getParentNodes = (
  crt: LtpCurrentRealityTreeData,
  currentparentNode: LtpCurrentRealityTreeDataNode
): LtpCurrentRealityTreeDataNode[] | undefined => {
  [];
  let parentNodes: LtpCurrentRealityTreeDataNode[] | undefined = [];
  let currentNode = currentparentNode;
  while (currentNode) {
    parentNodes.push(currentNode);
    currentNode = crt.nodes.find((node) => {
      return (
        node.andChildren?.find(
          (child: LtpCurrentRealityTreeDataNode) => child.id === currentNode.id
        ) ||
        node.orChildren?.find(
          (child: LtpCurrentRealityTreeDataNode) => child.id === currentNode.id
        )
      );
    })!;
  }

  if (parentNodes.length < 2) {
    parentNodes = undefined;
  } else {
    // Slice away the currentparentNode from the parentNodes
    parentNodes = parentNodes.slice(1);
  }

  return parentNodes;
};

export const identifyCauses = async (
  crt: LtpCurrentRealityTreeData,
  currentparentNode: LtpCurrentRealityTreeDataNode | undefined = undefined
) => {
  let parentNodes: LtpCurrentRealityTreeDataNode[] | undefined = undefined;

  if (currentparentNode) {
    parentNodes = getParentNodes(crt, currentparentNode);
  }

  const openai = new OpenAI(config);
  if (DEBUGGING) {
    console.log("DEBGUGGING: currentparentNode", JSON.stringify(currentparentNode, null, 2));
    console.log("DEBGUGGING: parentNodes", JSON.stringify(parentNodes, null, 2));
    console.log("DEBUGGING: crt", JSON.stringify(crt, null, 2));
    console.log("=====================")
    console.log(renderSystemPrompt(currentparentNode))
    console.log("---------------------")
    console.log(renderUserPrompt(crt, currentparentNode, parentNodes))
    console.log("=====================")
  }
  const response = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      { role: "system", content: renderSystemPrompt(currentparentNode) },
      {
        role: "user",
        content: renderUserPrompt(crt, currentparentNode, parentNodes),
      },
    ],
    max_tokens: 2048,
    temperature: 0.7,
  });

  let rawMessage = response.choices[0].message.content!;
  if (DEBUGGING) {
    console.log("DEBUGGING: rawMessage", rawMessage);
  }
  rawMessage = rawMessage.trim().replace(/```json/g, "");
  rawMessage = rawMessage.replace(/```/g, "");
  const parsedMessage: CrtPromptJson[] = JSON.parse(rawMessage);

  if (DEBUGGING) {
    console.log("DEBUGGING: parsedMessage", JSON.stringify(parsedMessage, null, 2));
  }

  const topCauses = filterTopCauses(parsedMessage);
  const nodes = convertToNodes(topCauses);

  if (DEBUGGING) {
    console.log("DEBUGGING: final nodes", JSON.stringify(nodes, null, 2));
  }
  return nodes;
};
