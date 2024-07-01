import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '@material/web/dialog/dialog.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/select/filled-select.js';
import '@material/web/select/select-option.js';
import '@material/web/textfield/filled-text-field.js';

import { OpsServerApi } from './OpsServerApi.js';

@customElement('ps-add-connector-dialog')
export class PsAddConnectorDialog extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: Number }) selectedAgentId: number | null = null;
  @state() private activeConnectorClasses: PsAgentConnectorClassAttributes[] = [];
  @state() private selectedConnectorClassId: number | null = null;
  @state() private connectorName: string = '';

  private api = new OpsServerApi();

  async connectedCallback() {
    super.connectedCallback();
    await this.fetchActiveConnectorClasses();
  }

  async fetchActiveConnectorClasses() {
    try {
      this.activeConnectorClasses = await this.api.getActiveConnectorClasses();
    } catch (error) {
      console.error('Error fetching active connector classes:', error);
    }
  }

  render() {
    return html`
      <md-dialog ?open="${this.open}" @closed="${this._handleClose}">
        <div slot="headline">Add New Connector</div>
        <div slot="content">
          <md-filled-text-field
            label="Connector Name"
            @input="${this._handleNameInput}"
            value="${this.connectorName}"
          ></md-filled-text-field>
          <md-filled-select
            label="Select Connector Class"
            @change="${this._handleConnectorClassSelection}"
          >
            ${this.activeConnectorClasses?.map(
              (connectorClass) => html`
                <md-select-option value="${connectorClass.id}">
                  <div slot="headline">${connectorClass.name}</div>
                </md-select-option>
              `
            )}
          </md-filled-select>
        </div>
        <div slot="actions">
          <md-text-button @click="${this._handleClose}">Cancel</md-text-button>
          <md-filled-button @click="${this._handleAddConnector}">Add Connector</md-filled-button>
        </div>
      </md-dialog>
    `;
  }

  private _handleNameInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.connectorName = input.value;
  }

  private _handleConnectorClassSelection(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.selectedConnectorClassId = Number(select.value);
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private async _handleAddConnector() {
    if (!this.connectorName || !this.selectedAgentId || !this.selectedConnectorClassId) {
      console.error('Connector name, agent, or connector class not selected');
      return;
    }

    try {
      const newConnector = await this.api.createConnector(this.selectedAgentId, this.selectedConnectorClassId, this.connectorName);
      this.dispatchEvent(new CustomEvent('connector-added', { detail: { connector: newConnector } }));
      this._handleClose();
    } catch (error) {
      console.error('Error creating new connector:', error);
    }
  }

  static styles = css`
    md-filled-text-field,
    md-filled-select {
      width: 100%;
      margin-bottom: 16px;
    }
  `;
}