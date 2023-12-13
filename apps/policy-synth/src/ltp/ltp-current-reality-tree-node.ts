import { PropertyValueMap, css, html, nothing } from 'lit';
import { property, customElement } from 'lit/decorators.js';

import '@material/web/iconbutton/icon-button.js';
import '@material/web/progress/circular-progress.js';

import { CpsStageBase } from '../cps-stage-base.js';
import { LtpServerApi } from './LtpServerApi.js';
import { LtpCurrentRealityTree } from './ltp-current-reality-tree.js';

@customElement('ltp-current-reality-tree-node')
export class LtpCurrentRealityTreeNode extends CpsStageBase {
  @property({ type: String })
  nodeId: string;

  @property({ type: String })
  crtNodeType: CrtNodeType;

  @property({ type: Boolean })
  isRootCause!: boolean;

  @property({ type: String })
  causeDescription: string;

  @property({ type: Boolean })
  isCreatingCauses = false;

  api: LtpServerApi;

  constructor() {
    super();
    this.api = new LtpServerApi();
  }

  async connectedCallback() {
    super.connectedCallback();
  }

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  static get styles() {
    return [
      super.styles,
      css`
        .causeText {
          font-size: 14px;
          padding: 8px;
          height: 100%;
          width: 100%;
          max-height: 70px;
          overflow-y: auto;
        }

        .causeText[is-ude] {
          max-height: 75px;
        }

        .causeTextContainer {
          height: 100%;
        }

        .causeText[root-cause] {
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

        .createOptionsButtons[root-cause] {
        }

        .menuButton {
          position: absolute;
          bottom: 0;
          right: 0;
        }

        .typeIconCore {
          position: absolute;
          bottom: 8px;
          left: 8px;
        }

        .typeIcon {
          color: var(--md-sys-color-primary);
        }

        .typeIconUde {
          color: var(--md-sys-color-tertiary);
        }

        md-circular-progress {
          --md-circular-progress-size: 28px;
          margin-bottom: 6px;
        }
      `,
    ];
  }

  async createDirectCauses() {
    this.isCreatingCauses = true;

    const nodes = await this.api.createDirectCauses(this.nodeId);

    this.fireGlobal('add-nodes', {
      parentNodeId: this.nodeId,
      nodes,
    });

    this.isCreatingCauses = false;
  }

  get crtTypeIconClass() {
    switch (this.crtNodeType) {
      case 'ude':
        return 'typeIconUde';
      default:
        console.error('crtNodeType', this.crtNodeType);
        return 'typeIcon'
      }
  }

  get crtTypeIcon() {
    switch (this.crtNodeType) {
      case 'ude':
        return 'bug_report';
      case 'directCause':
        return 'arrow_upward';
      case 'intermediateCause':
        return 'unfold_more';
      case 'rootCause':
        return 'flag';
      default:
        return 'more_vert'
      }
  }

  render() {
    return html`
      <div
        class="layout vertical mainContainer"
        ?root-cause="${this.isRootCause}"
      >
        <div class="layout horizontal causeTextContainer">
          <div class="causeText" ?is-ude="${this.crtNodeType==="ude"}" ?root-cause="${this.isRootCause}">
            ${this.causeDescription}
          </div>
        </div>
        <md-icon class="typeIconCore ${this.crtTypeIconClass}">${this.crtTypeIcon}</md-icon>
        <md-icon-button class="menuButton"
          ><md-icon>more_vert</md-icon></md-icon-button
        >
        <div
          class="layout horizontal center-justify createOptionsButtons"
          ?root-cause="${this.isRootCause}"
        >
          ${this.isCreatingCauses
            ? html`
                <md-circular-progress indeterminate></md-circular-progress>
              `
            : html`
                <md-icon-button
                  class="createOptionsButton"
                  @click="${this.createDirectCauses}"
                  ><md-icon>prompt_suggestion</md-icon></md-icon-button
                >
                <md-icon-button
                  class="createOptionsButton"
                  @click="${() =>
                    this.fire('open-add-cause-dialog', {
                      parentNodeId: this.nodeId,
                    })}"
                  ><md-icon>person_edit</md-icon></md-icon-button
                >
              `}
        </div>
      </div>
    `;
  }
}
