import { PropertyValueMap, css, html, nothing } from 'lit';
import { property, customElement, query, state } from 'lit/decorators.js';

import '@material/web/iconbutton/icon-button.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/iconbutton/outlined-icon-button.js';
import '@material/web/button/filled-tonal-button.js';

import { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import { MdTabs } from '@material/web/tabs/tabs.js';

import './ps-operations-view.js';
import './OpsServerApi.js';
import { OpsServerApi } from './OpsServerApi.js';

import './ps-edit-node-dialog.js';
import './ps-add-agent-dialog.js';
import './ps-add-connector-dialog.js';

import { PsOperationsView } from './ps-operations-view.js';
import { YpBaseElement } from '@yrpri/webapp/common/yp-base-element.js';
import { PsBaseWithRunningAgentObserver } from '../base/PsBaseWithRunningAgent.js';

@customElement('ps-operations-manager')
export class PsOperationsManager extends PsBaseWithRunningAgentObserver {
  @property({ type: Number })
  currentAgentId: number | undefined = 1;

  @property({ type: Number })
  totalCosts: number | undefined;

  @property({ type: Object })
  currentAgent: PsAgentAttributes | undefined;

  @property({ type: Boolean })
  isFetchingAgent = false;

  @property({ type: Object })
  nodeToEditInfo: PsAgentAttributes | PsAgentConnectorAttributes | undefined;

  @property({ type: Number })
  activeTabIndex = 0;

  @property({ type: Boolean })
  showEditNodeDialog = false;

  @property({ type: Boolean })
  showAddAgentDialog = false;

  @property({ type: Boolean })
  showAddConnectorDialog = false;

  @property({ type: Number })
  selectedAgentIdForConnector: number | null = null;

  @query('ps-operations-view')
  agentElement!: PsOperationsView;

  @property({ type: Number })
  groupId: number | undefined = 1; // TODO: No default here

  api: OpsServerApi;

  constructor() {
    super();
    this.api = new OpsServerApi();
    this.getAgent();
  }

  async getAgent() {
    this.isFetchingAgent = true;
    try {
      if (!this.groupId) {
        throw new Error('Current group ID is not set');
      }
      const agent = await this.api.getAgent(this.groupId);
      this.currentAgent = agent;
    } catch (error) {
      console.error('Error fetching agent:', error);
    } finally {
      this.isFetchingAgent = false;
    }
  }

  override async connectedCallback() {
    super.connectedCallback();
    this.addEventListener('edit-node', this.openEditNodeDialog as EventListenerOrEventListenerObject);
    this.addEventListener('add-connector', this.openAddConnectorDialog as EventListenerOrEventListenerObject);
    this.addEventListener('get-costs', this.fetchAgentCosts as EventListenerOrEventListenerObject);
    this.addEventListener('add-agent', this.openAddAgentDialog as EventListenerOrEventListenerObject);
  }

  async fetchAgentCosts() {
    if (this.currentAgentId) {
      try {
        this.totalCosts = await this.api.getAgentCosts(this.currentAgentId);
      } catch (error) {
        console.error('Error fetching agent costs:', error);
      }
    }
  }

  openEditNodeDialog(event: CustomEvent) {
    this.nodeToEditInfo = event.detail.element;
    this.showEditNodeDialog = true;
  }

  openAddConnectorDialog(event: CustomEvent) {
    this.selectedAgentIdForConnector = event.detail.agentId;
    this.showAddConnectorDialog = true;
  }

  openAddAgentDialog(event: CustomEvent) {
    this.showAddAgentDialog = true;
  }

  tabChanged() {
    this.activeTabIndex = (this.$$('#tabBar') as MdTabs).activeTabIndex;
  }

  toggleDarkMode() {
    this.fire('yp-theme-dark-mode', !this.themeDarkMode);
    window.psAppGlobals.activity('Agent - toggle darkmode');
    if (this.themeDarkMode) {
      window.psAppGlobals.activity('Settings - dark mode');
      localStorage.setItem('md3-ps-dark-mode', 'true');
    } else {
      window.psAppGlobals.activity('Settings - light mode');
      localStorage.removeItem('md3-ps-dark-mode');
    }
  }

  randomizeTheme() {
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    this.fire('yp-theme-color', `#${randomColor}`);
  }

  renderThemeToggle() {
    return html`
      <div class="layout horizontal center-center themeToggle">
        ${!this.themeDarkMode
          ? html`
              <md-outlined-icon-button
                class="darkModeButton"
                @click="${this.toggleDarkMode}"
                ><md-icon>dark_mode</md-icon></md-outlined-icon-button
              >
            `
          : html`
              <md-outlined-icon-button
                class="darkModeButton"
                @click="${this.toggleDarkMode}"
                ><md-icon>light_mode</md-icon></md-outlined-icon-button
              >
            `}

        <md-outlined-icon-button
          class="darkModeButton"
          @click="${this.randomizeTheme}"
          ><md-icon>shuffle</md-icon></md-outlined-icon-button
        >
      </div>
    `;
  }

  renderTotalCosts() {
    return html`${this.t('Costs')}
    ${this.totalCosts !== undefined ? `($${this.totalCosts.toFixed(2)})` : ''}`;
  }

  render() {
    if (this.isFetchingAgent) {
      return html`<md-linear-progress indeterminate></md-linear-progress>`;
    } else {
      return html`
        <ps-edit-node-dialog
          ?open="${this.showEditNodeDialog}"
          .nodeToEditInfo="${this.nodeToEditInfo}"
          @close="${() => (this.showEditNodeDialog = false)}"
        ></ps-edit-node-dialog>

        <ps-add-agent-dialog
          ?open="${this.showAddAgentDialog}"
          @close="${() => (this.showAddAgentDialog = false)}"
          .parentAgentId="${this.currentAgent.id}"
          .groupId="${this.groupId}"
        ></ps-add-agent-dialog>

        <ps-add-connector-dialog
          ?open="${this.showAddConnectorDialog}"
          .groupid="${this.groupId}"
          .selectedAgentId="${this.selectedAgentIdForConnector}"
          @close="${() => (this.showAddConnectorDialog = false)}"
        ></ps-add-connector-dialog>

        <md-tabs id="tabBar" @change="${this.tabChanged}">
          <md-primary-tab id="configure-tab" aria-controls="configure-panel">
            <md-icon slot="icon">support_agent</md-icon>
            ${this.t('Agents Operations')}
          </md-primary-tab>
          <md-primary-tab id="crt-tab" aria-controls="crt-panel">
            <md-icon slot="icon">checklist</md-icon>
            ${this.t('Audit Log')}
          </md-primary-tab>
          <md-primary-tab id="crt-tab" aria-controls="crt-panel">
            <md-icon slot="icon">account_balance</md-icon>
            ${this.renderTotalCosts()}
          </md-primary-tab>
        </md-tabs>
        <ps-operations-view
          .currentAgent="${this.currentAgent}"
        ></ps-operations-view>
        ${this.renderThemeToggle()}
      `;
    }
  }

  static override get styles() {
    return [
      super.styles,
      css`
        md-tabs {
          margin-bottom: 64px;
        }
        md-filled-select {
          width: 100%;
          margin-bottom: 16px;
        }
        .nodeEditHeadlineImage {
          max-width: 100px;
          margin-right: 16px;
        }

        .nodeEditHeadlineTitle {
          display: flex;
          align-items: center;
          justify-content: center; /* This will also center the content horizontally */
          height: 55px; /* Make sure this element has a defined height */
        }

        .childEditing {
          color: var(--md-sys-color-on-surface-variant);
          background-color: var(--md-sys-color-surface-variant);
          padding: 16px;
          border-radius: 8px;
        }

        .childrenList {
          height: 100px;
          overflow-y: auto;
        }

        md-icon-button {
          margin-top: 32px;
        }

        .createOptionsButtons {
          display: flex;
          justify-content: center;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding-left: 8px;
          padding-right: 8px;
        }

        .deleteButton {
          --md-sys-color-primary: var(--md-sys-color-error);
        }

        md-circular-progress {
          margin-bottom: 6px;
        }

        md-filled-text-field,
        md-outlined-text-field {
          width: 600px;
          margin-bottom: 16px;
        }

        [type='textarea'] {
          min-height: 150px;
        }

        [type='textarea'][supporting-text] {
          min-height: 76px;
        }

        .formContainer {
          margin-top: 32px;
        }

        md-filled-button,
        md-outlined-button {
          margin-top: 8px;
          margin-left: 8px;
          margin-right: 8px;
          margin-bottom: 8px;
        }

        .aiConfigReview {
          margin-left: 8px;
          margin-right: 8px;
          padding: 16px;
          margin-top: 8px;
          margin-bottom: 8px;
          border-radius: 12px;
          max-width: 560px;
          font-size: 14px;
          background-color: var(--md-sys-color-primary-container);
          color: var(--md-sys-color-on-primary-container);
        }

        .agentUDEDescription {
          font-size: 18px;
          margin: 32px;
          margin-bottom: 0;
          padding: 24px;
          border-radius: 12px;
          background-color: var(--md-sys-color-primary);
          color: var(--md-sys-color-on-primary);
        }

        md-tabs,
        agent-tab,
        configure-tab {
          width: 100%;
        }

        .themeToggle {
          margin-top: 32px;
        }

        ltp-chat-assistant {
          height: 100%;
          max-height: 100%;
          width: 100%;
          height: 100%;
        }

        md-linear-progress {
          width: 600px;
        }

        .darkModeButton {
          margin-right: 8px;
          margin-left: 8px;
        }

        .topDiv {
          margin-bottom: 256px;
        }

        md-outlined-select {
          z-index: 1500px;
          margin: 16px;
          margin-left: 0;
          max-width: 250px;
        }

        .automaticCreateButton {
          max-width: 300px;
        }

        [hidden] {
          display: none !important;
        }
      `,
    ];
  }
}

