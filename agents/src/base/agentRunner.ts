import { PolicySynthOperationsAgent } from "./operationsAgent.js";
import { PsAgentRegistry } from "../dbModels/agentRegistry.js";
import { PsAgentClass } from "../dbModels/agentClass.js";
import { PsAgentConnectorClass } from "../dbModels/agentConnectorClass.js";
import { PsAgent, initializeModels } from "../dbModels/index.js";
import { connectToDatabase } from "../dbModels/sequelize.js";
import { PoliciesAgentQueue } from "../smarterCrowdsourcing/agents/policies/policies.js";
import { PolicySynthAgentQueue } from "./operationsAgentQueue.js";

interface AgentQueueConstructor {
  new (...args: any[]): PolicySynthAgentQueue;
  getAgentClass(): PsAgentClassCreationAttributes;
}

export abstract class PsBaseAgentRunner extends PolicySynthOperationsAgent {
  protected agentsToRun: PolicySynthAgentQueue[] = [];
  protected agentRegistry: PsAgentRegistry | null = null;

  protected abstract agentClasses: PsAgentClassCreationAttributes[];
  protected abstract connectorClasses: PsConnectorClassCreationAttributes[];

  constructor() {
    super({} as any, undefined, 0, 100);

    if (!process.env.YP_USER_ID_FOR_AGENT_CREATION) {
      throw new Error(
        "YP_USER_ID_FOR_AGENT_CREATION environment variable not set"
      );
    }
  }

  abstract setupAgents(): Promise<void>;

  async setupAndRunAgents() {
    await connectToDatabase();
    await initializeModels();

    this.agentRegistry = await this.getOrCreateAgentRegistry();

    await this.createAgentClassesIfNeeded();
    await this.createConnectorClassesIfNeeded();

    await this.setupAgents();

    for (const agentQueue of this.agentsToRun) {
      this.logger.info(`Setting up agent: ${agentQueue.agentQueueName}`);
      await agentQueue.setupAgentQueue();
      await this.registerAgent(agentQueue);
      this.logger.info(
        `Agent ${agentQueue.agentQueueName} is ready and listening for jobs`
      );
    }

    this.logger.info("All agents are set up and running");

    this.startRenewalProcess();
  }

  inspectDynamicMethods(obj: any, className: string) {
    console.log(`Inspecting methods for ${className}:`);

    // Get all property names, including non-enumerable ones
    const propertyNames = Object.getOwnPropertyNames(
      Object.getPrototypeOf(obj)
    );

    propertyNames.forEach((name) => {
      const property = obj[name];
      if (typeof property === "function" && name !== "constructor") {
        console.log(`  - ${name}`);
      }
    });

    // Check for any enumerable properties that might have been added dynamically
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "function") {
        console.log(`  - ${key} (dynamically added)`);
      }
    });
  }

  private async registerAgent(agentQueue: PolicySynthAgentQueue) {
    if (!this.agentRegistry) {
      throw new Error("Agent registry not initialized");
    }

    const agentClassInfo = this.agentClasses.find(
      (ac) => ac.configuration.queueName === agentQueue.agentQueueName
    );

    if (!agentClassInfo) {
      throw new Error(
        `Agent class information not found for ${agentQueue.agentQueueName}`
      );
    }

    const agentClass = await PsAgentClass.findOne({
      where: { class_base_id: agentClassInfo.class_base_id },
    });

    if (!agentClass) {
      throw new Error(
        `Agent class not found in database for ${agentClassInfo.name}`
      );
    }

    await this.agentRegistry.addAgent(agentClass);
    this.logger.info(`Registered agent: ${agentClassInfo.name}`);
  }

  private async getOrCreateAgentRegistry(): Promise<PsAgentRegistry> {
    const [registry, created] = await PsAgentRegistry.findOrCreate({
      where: {},
      defaults: {
        user_id: parseInt(process.env.YP_USER_ID_FOR_AGENT_CREATION!),
        configuration: { supportedAgents: [] },
      },
    });

    if (created) {
      this.logger.info("Created new agent registry");
    } else {
      this.logger.info("Retrieved existing agent registry");
    }

    return registry;
  }

  private startRenewalProcess() {
    setInterval(() => {
      this.renewRegistration().catch((error) => {
        this.logger.error("Error renewing agent registration:", error);
      });
    }, 30000); // 30 seconds
  }

  private async renewRegistration() {
    if (!this.agentRegistry) {
      throw new Error("Agent registry not initialized");
    }

    // Update the timestamp to show the registration is still active
    await this.agentRegistry.update({ updated_at: new Date() });
    this.logger.info("Renewed agent registration");
  }

  // New method for creating agent classes
  protected async createAgentClassesIfNeeded() {
    for (const agentClass of this.agentClasses) {
      const [instance, created] = await PsAgentClass.findOrCreate({
        where: {
          class_base_id: agentClass.class_base_id,
          version: agentClass.version,
        },
        defaults: {
          ...agentClass,
          user_id: parseInt(process.env.YP_USER_ID_FOR_AGENT_CREATION!),
        },
      });

      if (created) {
        this.logger.info(
          `Created agent class: ${instance.class_base_id} v${instance.version}`
        );
      }
    }
  }
  // New method for creating connector classes
  protected async createConnectorClassesIfNeeded() {
    for (const connectorClass of this.connectorClasses) {
      const [instance, created] = await PsAgentConnectorClass.findOrCreate({
        where: {
          class_base_id: connectorClass.class_base_id,
          version: connectorClass.version,
        },
        //TODO: Check this
        //@ts-ignore
        defaults: {
          ...connectorClass,
          user_id: parseInt(process.env.YP_USER_ID_FOR_AGENT_CREATION!),
        },
      });

      if (created) {
        this.logger.info(
          `Created connector class: ${instance.class_base_id} v${instance.version}`
        );
      }
    }
  }

  async run() {
    try {
      await this.setupAndRunAgents();
      this.setupGracefulShutdown();
    } catch (error) {
      this.logger.error("Error setting up agents:", error);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    process.on("SIGINT", async () => {
      this.logger.info("Shutting down gracefully...");
      if (this.agentRegistry) {
        await this.agentRegistry.destroy();
        this.logger.info("Unregistered agents");
      }
      process.exit(0);
    });
  }
}
