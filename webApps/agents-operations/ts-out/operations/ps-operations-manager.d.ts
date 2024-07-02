import '@material/web/iconbutton/icon-button.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/iconbutton/outlined-icon-button.js';
import '@material/web/button/filled-tonal-button.js';
import './ps-operations-view.js';
import './OpsServerApi.js';
import { OpsServerApi } from './OpsServerApi.js';
import './ps-edit-node-dialog.js';
import './ps-add-agent-dialog.js';
import './ps-add-connector-dialog.js';
import { PsOperationsView } from './ps-operations-view.js';
import { PsBaseWithRunningAgentObserver } from '../base/PsBaseWithRunningAgent.js';
export declare class PsOperationsManager extends PsBaseWithRunningAgentObserver {
    currentAgentId: number | undefined;
    totalCosts: number | undefined;
    currentAgent: PsAgentAttributes | undefined;
    isFetchingAgent: boolean;
    nodeToEditInfo: PsAgentAttributes | PsAgentConnectorAttributes | undefined;
    activeTabIndex: number;
    showEditNodeDialog: boolean;
    showAddAgentDialog: boolean;
    showAddConnectorDialog: boolean;
    selectedAgentIdForConnector: number | null;
    selectedInputOutputType: string | null;
    agentElement: PsOperationsView;
    groupId: number | undefined;
    api: OpsServerApi;
    constructor();
    getAgent(): Promise<void>;
    connectedCallback(): Promise<void>;
    fetchAgentCosts(): Promise<void>;
    handleEditDialogSave(event: CustomEvent): Promise<void>;
    openEditNodeDialog(event: CustomEvent): void;
    openAddConnectorDialog(event: CustomEvent): void;
    openAddAgentDialog(event: CustomEvent): void;
    tabChanged(): void;
    toggleDarkMode(): void;
    randomizeTheme(): void;
    renderThemeToggle(): import("lit").TemplateResult<1>;
    renderTotalCosts(): import("lit").TemplateResult<1>;
    render(): import("lit").TemplateResult<1>;
    static get styles(): any[];
}
//# sourceMappingURL=ps-operations-manager.d.ts.map