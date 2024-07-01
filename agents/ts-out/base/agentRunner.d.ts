import { PolicySynthOperationsAgent } from "./operationsAgent.js";
import { PsAgentRegistry } from "../dbModels/agentRegistry.js";
import { PsAgentClass } from "../dbModels/agentClass.js";
import { PsAgentConnectorClass } from "../dbModels/agentConnectorClass.js";
import { PolicySynthAgentQueue } from "./operationsAgentQueue.js";
export declare abstract class PsBaseAgentRunner extends PolicySynthOperationsAgent {
    protected agentsToRun: PolicySynthAgentQueue[];
    protected agentRegistry: PsAgentRegistry | null;
    protected registeredAgentClasses: PsAgentClass[];
    protected registeredConnectorClasses: PsAgentConnectorClass[];
    protected abstract agentClasses: PsAgentClassCreationAttributes[];
    protected abstract connectorClasses: PsConnectorClassCreationAttributes[];
    constructor();
    abstract setupAgents(): Promise<void>;
    setupAndRunAgents(): Promise<void>;
    inspectDynamicMethods(obj: any, className: string): void;
    private registerAgent;
    private registerConnectors;
    private getOrCreateAgentRegistry;
    protected createAgentClassesIfNeeded(): Promise<void>;
    protected createConnectorClassesIfNeeded(): Promise<void>;
    run(): Promise<void>;
    setupGracefulShutdown(): void;
}
//# sourceMappingURL=agentRunner.d.ts.map