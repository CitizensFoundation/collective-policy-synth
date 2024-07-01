import express from "express";
import { createClient } from "redis";
import WebSocket from "ws";
import {
  PsAgent,
  PsAgentConnector,
  PsAgentClass,
  User,
  Group,
  PsExternalApiUsage,
  PsModelUsage,
  PsAiModel,
  PsAgentConnectorClass,
  sequelize,
  PsAgentRegistry,
} from "../models/index.js";
import { AgentManagerService } from "../operations/agentManager.js";
import { Queue } from "bullmq";
import { QueryTypes, Transaction } from "sequelize";

let redisClient;

// TODO: Share this do not start on each controller
if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: true,
    },
  });
} else {
  redisClient = createClient({
    url: "redis://localhost:6379",
  });
}

export class AgentsController {
  public path = "/api/agents";
  public router = express.Router();
  public wsClients = new Map<string, WebSocket>();
  private agentManager: AgentManagerService;

  constructor(wsClients: Map<string, WebSocket>) {
    this.wsClients = wsClients;
    this.agentManager = new AgentManagerService();
    this.initializeRoutes();
  }

  public initializeRoutes() {
    this.router.get(this.path + "/:id", this.getAgent);
    this.router.put(
      this.path + "/:agentId/:nodeType/:nodeId/configuration",
      this.updateNodeConfiguration
    );

    this.router.post(this.path + "/:id/control", this.controlAgent());
    this.router.get(this.path + "/:id/status", this.getAgentStatus);
    this.router.get(this.path + "/:id/costs", this.getAgentCosts);
    this.router.get(
      this.path + "/registry/agentClasses",
      this.getActiveAgentClasses
    );
    this.router.get(
      this.path + "/registry/connectorClasses",
      this.getActiveConnectorClasses
    );
    this.router.get(this.path + "/registry/aiModels", this.getActiveAiModels);
    this.router.post(this.path, this.createAgent);
    this.router.post(this.path + "/:agentId/connectors", this.createConnector);
    this.router.put(this.path + '/:nodeId/:nodeType/configuration', this.updateNodeConfiguration);
  }

  updateNodeConfiguration = async (req: express.Request, res: express.Response) => {
    const agentId = parseInt(req.params.agentId);
    const nodeType = req.params.nodeType as 'agent' | 'connector';
    const nodeId = parseInt(req.params.nodeId);
    const updatedConfig = req.body;

    try {
      let node;
      if (nodeType === 'agent') {
        node = await PsAgent.findByPk(nodeId);
      } else if (nodeType === 'connector') {
        node = await PsAgentConnector.findByPk(nodeId);
      }

      if (!node) {
        return res.status(404).send(`${nodeType} not found`);
      }

      // Merge the updated configuration with the existing one
      node.configuration = {
        ...node.configuration,
        ...updatedConfig,
      };

      await node.save();

      res.json({ message: `${nodeType} configuration updated successfully` });
    } catch (error) {
      console.error(`Error updating ${nodeType} configuration:`, error);
      res.status(500).send('Internal Server Error');
    }
  };

  createAgent = async (req: express.Request, res: express.Response) => {
    const { name, agentClassId, aiModelId, parentAgentId } = req.body;

    if (!agentClassId || !aiModelId) {
      return res
        .status(400)
        .send("Agent class ID and AI model ID are required");
    }

    const transaction = await sequelize.transaction();

    try {
      const agentClass = await PsAgentClass.findByPk(agentClassId);
      const aiModel = await PsAiModel.findByPk(aiModelId);

      if (!agentClass || !aiModel) {
        await transaction.rollback();
        return res.status(404).send("Agent class or AI model not found");
      }

      const newAgent = await PsAgent.create(
        {
          class_id: agentClassId,
          user_id: 1,
          group_id: 1,
          parent_agent_id: parentAgentId,
          configuration: {
            name
          },
        },
        { transaction }
      );

      await newAgent.addAiModel(aiModel, { transaction });

      await transaction.commit();

      // Fetch the created agent with its associations
      const createdAgent = await PsAgent.findByPk(newAgent.id, {
        include: [
          { model: PsAgentClass, as: "Class" },
          { model: PsAiModel, as: "AiModels" },
        ],
      });

      res.status(201).json(createdAgent);
    } catch (error) {
      await transaction.rollback();
      console.error("Error creating agent:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  createConnector = async (req: express.Request, res: express.Response) => {
    const { agentId } = req.params;
    const { connectorClassId, name } = req.body;

    if (!agentId || !connectorClassId || !name) {
      return res
        .status(400)
        .send("Agent ID, connector class ID, and name are required");
    }

    const transaction = await sequelize.transaction();

    try {
      const agent = await PsAgent.findByPk(agentId);
      const connectorClass = await PsAgentConnectorClass.findByPk(
        connectorClassId
      );

      if (!agent || !connectorClass) {
        await transaction.rollback();
        return res.status(404).send("Agent or connector class not found");
      }

      const newConnector = await PsAgentConnector.create(
        {
          class_id: connectorClassId,
          user_id: 1, //TODO: Make dynamic
          group_id: agent.group_id,
          configuration: {
            name: name,
            graphPosX: 200,
            graphPosY: 200,
            permissionNeeded: PsAgentConnectorPermissionTypes.ReadWrite,
          },
        },
        { transaction }
      );

      await agent.addConnector(newConnector, { transaction });

      await transaction.commit();

      // Fetch the created connector with its associations
      const createdConnector = await PsAgentConnector.findByPk(
        newConnector.id,
        {
          include: [
            { model: PsAgentConnectorClass, as: "Class" },
            { model: PsAgent, as: "Agent" },
          ],
        }
      );

      res.status(201).json(createdConnector);
    } catch (error) {
      await transaction.rollback();
      console.error("Error creating connector:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  getActiveAiModels = async (req: express.Request, res: express.Response) => {
    try {
      const activeAiModels = await PsAiModel.findAll({
        where: { "configuration.active": true },
      });

      res.json(activeAiModels);
    } catch (error) {
      console.error("Error fetching active AI models:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  getActiveAgentClasses = async (
    req: express.Request,
    res: express.Response
  ) => {
    try {
      const registry = await PsAgentRegistry.findOne({
        include: [
          {
            model: PsAgentClass,
            as: "Agents",
            where: { available: true },
            through: { attributes: [] },
          },
        ],
      });

      if (!registry) {
        return res.status(404).send("Agent registry not found");
      }

      res.json(registry.Agents);
    } catch (error) {
      console.error("Error fetching active agent classes:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  getActiveConnectorClasses = async (
    req: express.Request,
    res: express.Response
  ) => {
    try {
      const registry = await PsAgentRegistry.findOne({
        include: [
          {
            model: PsAgentConnectorClass,
            as: "Connectors",
            where: { available: true },
            through: { attributes: [] },
          },
        ],
      });

      if (!registry) {
        return res.status(404).send("Agent registry not found");
      }

      res.json(registry.Connectors);
    } catch (error) {
      console.error("Error fetching active connector classes:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  controlAgent = () => async (req: express.Request, res: express.Response) => {
    const agentId = parseInt(req.params.id);
    const action = req.body.action;

    try {
      const agent = await PsAgent.findByPk(agentId, {
        include: [{ model: PsAgentClass, as: "Class" }],
      });

      if (!agent || !agent.Class) {
        return res.status(404).send("Agent or Agent Class not found");
      }

      const queueName = agent.Class.configuration.queueName;
      if (!queueName) {
        return res
          .status(400)
          .send("Queue name not defined for this agent class");
      }

      const queue = new Queue(queueName);

      await queue.add(`${action}Agent`, { agentId, action });

      res.json({
        message: `${
          action.charAt(0).toUpperCase() + action.slice(1)
        } request for agent ${agentId} queued in ${queueName}`,
      });
    } catch (error) {
      console.error(`Error ${action}ing agent:`, error);
      res.status(500).send("Internal Server Error");
    }
  };



  getAgentStatus = async (req: express.Request, res: express.Response) => {
    const agentId = parseInt(req.params.id);

    try {
      const status = await this.agentManager.getAgentStatus(agentId);
      if (status) {
        res.json(status);
      } else {
        res.status(404).send("Agent status not found");
      }
    } catch (error) {
      console.error("Error getting agent status:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  updateAgentStatus = async (req: express.Request, res: express.Response) => {
    const agentId = parseInt(req.params.id);
    const { state, details } = req.body;

    try {
      const success = await this.agentManager.updateAgentStatus(
        agentId,
        state,
        details
      );
      if (success) {
        res.json({ message: "Agent status updated successfully" });
      } else {
        res.status(404).send("Agent not found");
      }
    } catch (error) {
      console.error("Error updating agent status:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  startAgentProcessing = async (
    req: express.Request,
    res: express.Response
  ) => {
    const agentId = parseInt(req.params.id);

    try {
      const success = await this.agentManager.startAgentProcessing(agentId);
      if (success) {
        res.json({ message: "Agent processing started successfully" });
      } else {
        res.status(404).send("Agent not found");
      }
    } catch (error) {
      console.error("Error starting agent processing:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  pauseAgentProcessing = async (
    req: express.Request,
    res: express.Response
  ) => {
    const agentId = parseInt(req.params.id);

    try {
      const success = await this.agentManager.pauseAgentProcessing(agentId);
      if (success) {
        res.json({ message: "Agent processing paused successfully" });
      } else {
        res.status(404).send("Agent not found");
      }
    } catch (error) {
      console.error("Error pausing agent processing:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  public async getAgentCosts(req: express.Request, res: express.Response) {
    const agentId = parseInt(req.params.id);

    try {
      const results = await sequelize.query(
        `
        SELECT
          COALESCE(SUM(
            (COALESCE(mu.token_in_count, 0) * COALESCE(CAST(am.configuration#>>'{prices,costInTokensPerMillion}' AS FLOAT), 0) +
             COALESCE(mu.token_out_count, 0) * COALESCE(CAST(am.configuration#>>'{prices,costOutTokensPerMillion}' AS FLOAT), 0)) / 1000000.0
          ), 0) as total_cost
        FROM ps_agents a
        LEFT JOIN "AgentModels" am_join ON a.id = am_join.agent_id
        LEFT JOIN ps_ai_models am ON am_join.ai_model_id = am.id
        LEFT JOIN ps_model_usage mu ON mu.model_id = am.id AND mu.agent_id = a.id
        WHERE a.id = :agentId
      `,
        {
          replacements: { agentId },
          type: QueryTypes.SELECT,
        }
      );

      const totalCost = (results[0] as { total_cost: string }).total_cost;
      res.json({ totalCost: parseFloat(totalCost).toFixed(2) });
    } catch (error) {
      console.error("Error calculating agent costs:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  getAgent = async (req: express.Request, res: express.Response) => {
    const groupId = req.params.id;

    if (!groupId) {
      return res.status(400).send("Group ID is required");
    }

    try {
      const group = await Group.findByPk(groupId, {
        attributes: ["id", "user_id", "configuration", "name"],
      });

      if (!group) {
        return res.status(404).send("Group not found");
      }

      console.log("Initial group:", JSON.stringify(group.toJSON()));
      //TODO: Check this why does it not work
      const groupData = group.toJSON();
      const configuration = groupData.configuration;
      let topLevelAgentId = configuration?.agents?.topLevelAgentId;
//      let topLevelAgentId = group.configuration.agents?.topLevelAgentId;

      console.log(`Top-level agent ID: ${topLevelAgentId}`);

      let topLevelAgent: PsAgent | null = null;
      if (topLevelAgentId) {
        topLevelAgent = await PsAgent.findByPk(topLevelAgentId);
      }

      if (!topLevelAgent) {
        const defaultAgentClassUuid = process.env.CLASS_ID_FOR_TOP_LEVEL_AGENT;
        if (!defaultAgentClassUuid) {
          return res.status(500).send("Default agent class UUID is not configured");
        }

        const agentClass = await PsAgentClass.findOne({
          where: { class_base_id: defaultAgentClassUuid },
        });
        if (!agentClass) {
          return res.status(404).send("Default agent class not found");
        }

        console.log(`Creating top-level agent for group ${group.id}`);

        const transaction = await sequelize.transaction();

        try {
          topLevelAgent = await PsAgent.create(
            {
              class_id: agentClass.id,
              user_id: group.user_id,
              group_id: group.id,
              configuration: {
                name: `${group.name} Top-Level Agent`,
              },
            },
            { transaction }
          );

          console.log("Created top-level agent:", JSON.stringify(topLevelAgent.toJSON()));

          // Use a raw query to update the nested JSON field
          const [updateCount] = await sequelize.query(
            `UPDATE groups
             SET configuration = jsonb_set(
               COALESCE(configuration, '{}')::jsonb,
               '{agents,topLevelAgentId}',
               :topLevelAgentId::jsonb
             )
             WHERE id = :groupId`,
            {
              replacements: {
                topLevelAgentId: JSON.stringify(topLevelAgent.id),
                groupId: group.id,
              },
              type: QueryTypes.UPDATE,
              transaction,
            }
          );

          console.log(`Updated ${updateCount} group(s)`);

          if (updateCount === 0) {
            throw new Error(`Failed to update configuration for group ${group.id}`);
          }

          await transaction.commit();
          console.log('Transaction committed successfully');

          // Fetch the updated group to verify changes
          const finalGroup = await Group.findByPk(group.id);
          console.log('Final group:', JSON.stringify(finalGroup?.toJSON()));
        } catch (error) {
          await transaction.rollback();
          console.error('Error creating top-level agent:', error);
          throw error;
        }
      }

      // Fetch the agent with all its associations
      const fullAgent = await this.fetchAgentWithSubAgents(topLevelAgent!.id);

      res.json(fullAgent);
    } catch (error) {
      console.error("Error in getAgent:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  async fetchAgentWithSubAgents(agentId: number) {
    console.log("Fetching agent with ID:", agentId); // Debug logging
    const agent = await PsAgent.findByPk(agentId, {
      include: [
        {
          model: PsAgent,
          as: "SubAgents",
          include: [
            {
              model: PsAgentConnector,
              as: "Connectors",
              include: [
                {
                  model: PsAgentConnectorClass,
                  as: "Class",
                },
              ],
            },
            { model: PsAgentClass, as: "Class" },
          ],
        },
        {
          model: PsAgentConnector,
          as: "Connectors",
          include: [
            {
              model: PsAgentConnectorClass,
              as: "Class",
            },
          ],
        },
        { model: PsAgentClass, as: "Class" },
        { model: User, as: "User" },
        { model: Group, as: "Group" },
        { model: PsExternalApiUsage, as: "ExternalApiUsage" },
        { model: PsModelUsage, as: "ModelUsage" },
        { model: PsAiModel, as: "AiModels" },
      ],
    });

    if (!agent) {
      throw new Error("Agent not found");
    }

    console.log("Agent found:", agent.toJSON()); // Debug logging

    //const subAgents = await this.fetchNestedSubAgents(agent.id);

    //console.log("Sub-agents fetched:", subAgents); // Debug logging

    return {
      ...agent.toJSON(),
      //  SubAgents: subAgents,
    };
  }

  async fetchNestedSubAgents(parentAgentId: number): Promise<any[]> {
    if (!parentAgentId) {
      return [];
    }

    console.log("Fetching sub-agents for parent ID:", parentAgentId); // Debug logging

    const subAgents = await PsAgent.findAll({
      where: { parent_agent_id: parentAgentId },
      include: [
        {
          model: PsAgent,
          as: "SubAgents",
          include: [{ model: PsAgentConnector, as: "Connectors" }],
        },
        { model: PsAgentConnector, as: "Connectors" },
        { model: PsAgentClass, as: "Class" },
        { model: User, as: "User" },
        { model: Group, as: "Group" },
        { model: PsExternalApiUsage, as: "ExternalApiUsage" },
        { model: PsModelUsage, as: "ModelUsage" },
        { model: PsAiModel, as: "AiModels" },
      ],
    });

    console.log("Sub-agents found:", subAgents); // Debug logging

    return Promise.all(
      subAgents.map(async (subAgent) => {
        const nestedSubAgents = await this.fetchNestedSubAgents(subAgent.id);
        return {
          ...subAgent.toJSON(),
          SubAgents: nestedSubAgents,
        };
      })
    );
  }
}
