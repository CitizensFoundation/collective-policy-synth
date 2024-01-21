import "@material/web/iconbutton/icon-button.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/iconbutton/outlined-icon-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/dialog/dialog.js";
import "@material/web/button/text-button.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/menu/menu.js";
import "@material/web/menu/menu-item.js";
import "@material/web/button/filled-button.js";
import { CpsStageBase } from '../base/cps-stage-base.js';
import "./ltp-current-reality-tree.js";
import "./LtpServerApi.js";
import { LtpServerApi } from "./LtpServerApi.js";
import "./chat/ltp-chat-assistant.js";
import { LtpStreamingAIResponse } from "./LtpStreamingAIResponse.js";
import { LtpCurrentRealityTree } from "./ltp-current-reality-tree.js";
export declare class LtpManageCrt extends CpsStageBase {
    currentTreeId: string | number | undefined;
    crt: LtpCurrentRealityTreeData | undefined;
    isCreatingCrt: boolean;
    isFetchingCrt: boolean;
    nodeToEditInfo: CrtEditNodeInfo | undefined;
    nodeToEdit: LtpCurrentRealityTreeDataNode | undefined;
    allCausesExceptCurrentToEdit: LtpCurrentRealityTreeDataNode[];
    showDeleteConfirmation: boolean;
    activeTabIndex: number;
    currentlySelectedCauseIdToAddAsChild: string | undefined;
    AIConfigReview: string | undefined;
    isReviewingCrt: boolean;
    crtElement: LtpCurrentRealityTree;
    api: LtpServerApi;
    nodeToAddCauseTo: LtpCurrentRealityTreeDataNode | undefined;
    wsMessageListener: ((event: any) => void) | undefined;
    currentStreaminReponse: LtpStreamingAIResponse | undefined;
    constructor();
    connectedCallback(): Promise<void>;
    openEditNodeDialog(event: CustomEvent): void;
    closeEditNodeDialog(): void;
    addChildChanged(): void;
    handleSaveEditNode(): Promise<void>;
    handleDeleteNode(): void;
    removeNodeRecursively(nodes: LtpCurrentRealityTreeDataNode[], nodeId: string): void;
    confirmDeleteNode(): Promise<void>;
    createDirectCauses(): void;
    closeDeleteConfirmationDialog(): void;
    renderDeleteConfirmationDialog(): import("lit-html").TemplateResult<1>;
    renderEditNodeDialog(): import("lit-html").TemplateResult<1>;
    updatePath(): void;
    addChildToCurrentNode(): Promise<void>;
    findNodeById(nodes: LtpCurrentRealityTreeDataNode[], id: string): LtpCurrentRealityTreeDataNode | null;
    removeChildNode(childIdToRemove: string): Promise<void>;
    fetchCurrentTree(): Promise<void>;
    updated(changedProperties: Map<string | number | symbol, unknown>): void;
    disconnectedCallback(): void;
    camelCaseToHumanReadable(str: string): string;
    static get styles(): (any[] | import("lit").CSSResult)[];
    tabChanged(): void;
    clearForNew(): void;
    get crtInputData(): LtpCurrentRealityTreeData;
    reviewTreeConfiguration(): Promise<void>;
    createTree(): Promise<void>;
    toggleDarkMode(): void;
    randomizeTheme(): void;
    renderAIConfigReview(): import("lit-html").TemplateResult<1>;
    renderReviewAndSubmit(): import("lit-html").TemplateResult<1>;
    renderThemeToggle(): import("lit-html").TemplateResult<1>;
    renderConfiguration(): import("lit-html").TemplateResult<1>;
    findNodeRecursively: (nodes: LtpCurrentRealityTreeDataNode[], nodeId: string) => LtpCurrentRealityTreeDataNode | undefined;
    openAddCauseDialog(event: CustomEvent): void;
    closeAddCauseDialog(): void;
    renderAddCauseDialog(): import("lit-html").TemplateResult<1>;
    render(): import("lit-html/directive.js").DirectiveResult<typeof import("lit-html/directives/cache.js").CacheDirective>;
}
//# sourceMappingURL=ltp-manage-crt.d.ts.map