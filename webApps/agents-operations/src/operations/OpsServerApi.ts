import { YpServerApi } from "@yrpri/webapp/common/YpServerApi";
import { PsOperationsBaseNode } from "./ps-operations-base-node";
import { BaseChatBotServerApi } from "../chatBot/BaseChatBotApi";

export class OpsServerApi extends BaseChatBotServerApi {
  baseAgentsPath = '/agents/';
  constructor(urlPath: string = '/api') {
    super();
    this.baseUrlPath = urlPath;
  }

  public async getAgent(groupId: number): Promise<PsAgentAttributes> {
    return (await this.fetchWrapper(this.baseUrlPath + `${this.baseAgentsPath}${groupId}`,{}, false)) as unknown as PsAgentAttributes;
  }

  public async getCrt(groupId: number): Promise<LtpCurrentRealityTreeData> {
    return (await this.fetchWrapper(this.baseUrlPath + `${this.baseAgentsPath}${groupId}`,{}, false)) as unknown as LtpCurrentRealityTreeData;
  }

  public async createAgent(name: string, agentClassId: number, aiModelId: number, parentAgentId: number, groupId?: number): Promise<PsAgentAttributes> {
    return this.fetchWrapper(
      this.baseUrlPath + this.baseAgentsPath,
      {
        method: 'POST',
        body: JSON.stringify({ name, agentClassId, aiModelId, parentAgentId, groupId }),
      },
      false
    ) as Promise<PsAgentAttributes>;
  }

  public async createConnector(agentId: number, connectorClassId: number, name: string): Promise<PsAgentConnectorAttributes> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${agentId}/connectors`,
      {
        method: 'POST',
        body: JSON.stringify({ connectorClassId, name }),
      },
      false
    ) as Promise<PsAgentConnectorAttributes>;
  }

  public async getActiveAiModels(): Promise<PsAiModelAttributes[]> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}registry/aiModels`,
      {
        method: 'GET',
      },
      false
    ) as Promise<PsAiModelAttributes[]>;
  }

  public async getActiveAgentClasses(): Promise<PsAgentClassAttributes[]> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}registry/agentClasses`,
      {
        method: 'GET',
      },
      false
    ) as Promise<PsAgentClassAttributes[]>;
  }

  public async getActiveConnectorClasses(): Promise<PsAgentConnectorClassAttributes[]> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}registry/connectorClasses`,
      {
        method: 'GET',
      },
      false
    ) as Promise<PsAgentConnectorClassAttributes[]>;
  }

  public createTree(
    crt: LtpCurrentRealityTreeData
  ): Promise<LtpCurrentRealityTreeData> {
    return this.fetchWrapper(
      this.baseUrlPath + `/crt`,
      {
        method: 'POST',
        body: JSON.stringify(crt),
      },
      false
    ) as Promise<LtpCurrentRealityTreeData>;
  }

  public updateNodeChildren(
    treeId: string | number,
    nodeId: string,
    childrenIds: string[]
  ): Promise<void> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${treeId}/updateChildren`,
      {
        method: 'PUT',
        body: JSON.stringify({
          nodeId,
          childrenIds
        }),
      },
      false
    ) as Promise<void>;
  }


  public reviewConfiguration(
    wsClientId: string,
    crt: LtpCurrentRealityTreeData
  ): Promise<string> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}/reviewConfiguration`,
      {
        method: 'PUT',
        body: JSON.stringify({
          context: crt.context,
          undesirableEffects: crt.undesirableEffects,
          wsClientId,
        }),
      },
      false,
      undefined
    ) as Promise<string>;
  }

  public createDirectCauses(
    treeId: string | number,
    parentNodeId: string
  ): Promise<LtpCurrentRealityTreeDataNode[]> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${treeId}/createDirectCauses`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentNodeId,
        }),
      },
      false
    ) as Promise<LtpCurrentRealityTreeDataNode[]>;
  }

  public addDirectCauses(
    treeId: string | number,
    parentNodeId: string,
    causes: string[],
    type: CrtNodeType
  ): Promise<LtpCurrentRealityTreeDataNode[]> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${treeId}/addDirectCauses`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentNodeId,
          causes,
          type
        }),
      },
      false
    ) as Promise<LtpCurrentRealityTreeDataNode[]>;
  }

  public async getAgentCosts(agentId: number): Promise<number> {
    const response = await this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${agentId}/costs`,
      {
        method: 'GET',
      },
      false
    ) as { totalCost: string };
    return parseFloat(response.totalCost);
  }

  public sendGetRefinedCauseQuery(
    crtTreeId: string | number,
    crtNodeId: string,
    chatLog: PsAiChatWsMessage[],
    wsClientId: string,
    effect?: string,
    causes?: string[],
    validationErrors?: string[]
  ): Promise<LtpChatBotCrtMessage> {
    // Filter out all chatMessages with type==thinking
    chatLog = chatLog.filter(chatMessage => chatMessage.type != 'thinking' && chatMessage.type != 'noStreaming');

    const simplifiedChatLog = chatLog.map(chatMessage => {
      return {
        sender: chatMessage.sender == 'bot' ? 'assistant' : 'user',
        message: chatMessage.rawMessage
          ? chatMessage.rawMessage
          : chatMessage.message,
      };
    });

    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${crtTreeId}/getRefinedCauses`,
      {
        method: 'POST',
        body: JSON.stringify({ wsClientId, crtNodeId, chatLog: simplifiedChatLog, effect, causes, validationErrors }),
      },
      false
    ) as Promise<LtpChatBotCrtMessage>;
  }

  public runValidationChain(
    crtTreeId: string | number,
    crtNodeId: string,
    chatLog: PsAiChatWsMessage[],
    wsClientId: string,
    effect: string,
    causes: string[]
  ): Promise<LtpChatBotCrtMessage> {
    // Filter out all chatMessages with type==thinking
    chatLog = chatLog.filter(chatMessage => chatMessage.type != 'thinking' && chatMessage.type != 'noStreaming');

    const simplifiedChatLog = chatLog.map(chatMessage => {
      return {
        sender: chatMessage.sender == 'bot' ? 'assistant' : 'user',
        message: chatMessage.rawMessage
          ? chatMessage.rawMessage
          : chatMessage.message,
      };
    });

    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${crtTreeId}/runValidationChain`,
      {
        method: 'POST',
        body: JSON.stringify({
          wsClientId,
          crtNodeId,
          chatLog: simplifiedChatLog,
          effect,
          causes,
        }),
      },
      false
    ) as Promise<LtpChatBotCrtMessage>;
  }


  public updateNode(
    agentId: number,
    updatedNode: PsAgentAttributes
  ): Promise<void> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${agentId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updatedNode),
      },
      false
    ) as Promise<void>;
  }

  public updateNodeConfiguration(
    agentId: number,
    nodeId: number,
    nodeType: 'agent' | 'connector',
    updatedConfig: any
  ): Promise<void> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${agentId}/${nodeType}/${nodeId}/configuration`,
      {
        method: 'PUT',
        body: JSON.stringify(updatedConfig),
      },
      false
    ) as Promise<void>;
  }

  public async getAgentStatus(agentId: number): Promise<PsAgentStatus> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${agentId}/status`,
      {
        method: 'GET',
      },
      false
    ) as Promise<PsAgentStatus>;
  }

  async controlAgent(agentId: number, action: 'start' | 'pause' | 'stop') {
    return this.fetchWrapper(
      `/api/agents/${agentId}/control`,
      {
        method: 'POST',
        body: JSON.stringify({ action: action }),
      }
    );
  }

  async startAgent(agentId: number) {
    return this.controlAgent(agentId, 'start');
  }

  async pauseAgent(agentId: number) {
    return this.controlAgent(agentId, 'pause');
  }

  async stopAgent(agentId: number) {
    return this.controlAgent(agentId, 'stop');
  }

  public deleteNode(
    treeId: string | number,
    nodeId: string
  ): Promise<void> {
    return this.fetchWrapper(
      this.baseUrlPath + `${this.baseAgentsPath}${treeId}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ nodeId }),
      },
      false
    ) as Promise<void>;
  }
}
