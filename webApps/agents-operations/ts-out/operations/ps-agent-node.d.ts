import { nothing } from 'lit';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import { OpsServerApi } from './OpsServerApi.js';
import { PsOperationsBaseNode } from './ps-operations-base-node.js';
export declare class PsAgentNode extends PsOperationsBaseNode {
    agent: PsAgentAttributes;
    agentId: number;
    isWorking: boolean;
    private latestMessage;
    private progress;
    api: OpsServerApi;
    private statusInterval;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    startStatusUpdates(): void;
    stopStatusUpdates(): void;
    updateAgentStatus(): Promise<void>;
    static get styles(): (any[] | import("lit").CSSResult)[];
    startAgent(): Promise<void>;
    pauseAgent(): Promise<void>;
    stopAgent(): Promise<void>;
    editNode(): void;
    toggleMenu(): void;
    clickPlayPause(): void;
    renderProgress(): import("lit").TemplateResult<1>;
    render(): typeof nothing | import("lit").TemplateResult<1>;
}
//# sourceMappingURL=ps-agent-node.d.ts.map