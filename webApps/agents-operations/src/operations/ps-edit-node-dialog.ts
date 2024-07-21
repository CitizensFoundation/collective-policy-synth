import { html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '@material/web/dialog/dialog.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/select/filled-select.js';
import '@material/web/select/select-option.js';
import '@yrpri/webapp/yp-survey/yp-structured-question-edit.js';
import './ps-ai-model-selector.js';

import { YpBaseElement } from '@yrpri/webapp/common/yp-base-element';
import { PsAiModelSize } from '@policysynth/agents/aiModelTypes.js';
import { OpsServerApi } from './OpsServerApi.js';

@customElement('ps-edit-node-dialog')
export class PsEditNodeDialog extends YpBaseElement {
  @property({ type: Boolean }) open = false;
  @property({ type: Object }) nodeToEditInfo: any;

  @state() private activeAiModels: PsAiModelAttributes[] = [];
  @state() private selectedAiModels: { [key in PsAiModelSize]?: number | null } = {};

  private api = new OpsServerApi();

  async connectedCallback() {
    super.connectedCallback();
    await this.fetchActiveAiModels();
  }

  async fetchActiveAiModels() {
    try {
      this.activeAiModels = await this.api.getActiveAiModels();
    } catch (error) {
      console.error('Error fetching active AI models:', error);
    }
  }

  disableScrim(event: CustomEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  render() {
    return html`
 <md-dialog
        ?open="${this.open}"
        @closed="${this._handleClose}"
        @cancel="${this.disableScrim}"
      >
        <div slot="headline">
          ${this.nodeToEditInfo ? this._renderNodeEditHeadline() : ''}
        </div>
        <div slot="content" class="dialog-content">
          ${this.nodeToEditInfo ? this._renderEditForm() : ''}
        </div>
        <div slot="actions">
          <md-text-button @click="${this._handleClose}">${this.t('cancel')}</md-text-button>
          <md-filled-button @click="${this._handleSave}">${this.t('save')}</md-filled-button>
        </div>
      </md-dialog>
    `;
  }

  _renderNodeEditHeadline() {
    return html`
      <div class="layout horizontal">
        <div>
          <img
            src="${this.nodeToEditInfo.Class.configuration.imageUrl}"
            class="nodeEditHeadlineImage"
          />
        </div>
        <div class="nodeEditHeadlineTitle">
          ${this.nodeToEditInfo.Class.name}
        </div>
      </div>
    `;
  }

  _renderEditForm() {
    return html`
      <div id="surveyContainer">
        ${this.nodeToEditInfo.Class.configuration.questions.map(
          (question: YpStructuredQuestionData, index: number) => html`
            <yp-structured-question-edit
              index="${index}"
              id="structuredQuestion_${question.uniqueId
                ? index
                : `noId_${index}`}"
              .structuredAnswers="${this._getInitialAnswers()}"
              .question="${question}"
            >
            </yp-structured-question-edit>
          `
        )}
        ${this._renderAiModelSelector()}
      </div>
    `;
  }

  _renderAiModelSelector() {
    if (!this.nodeToEditInfo.Class.configuration.requestedAiModelSizes) {
      return '';
    }

    return html`
      <ps-ai-model-selector
        .activeAiModels="${this.activeAiModels}"
        .requestedAiModelSizes="${this.nodeToEditInfo.Class.configuration.requestedAiModelSizes}"
        .currentModels="${this._getCurrentModels()}"
        @ai-models-changed="${this._handleAiModelsChanged}"
      ></ps-ai-model-selector>
    `;
  }

  _getCurrentModels() {
    const currentModels: { [key in PsAiModelSize]?: PsAiModelAttributes } = {};
    this.nodeToEditInfo.AiModels?.forEach((model: PsAiModelAttributes) => {
      if (model.configuration && 'modelSize' in model.configuration) {
        currentModels[model.configuration.modelSize as PsAiModelSize] = model;
      }
    });
    return currentModels;
  }

  _getInitialAnswers() {
    return Object.entries(this.nodeToEditInfo.configuration).map(
      ([key, value]) => ({
        uniqueId: key,
        value: value,
      })
    );
  }

  _handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  _handleAiModelsChanged(e: CustomEvent) {
    this.selectedAiModels = e.detail.selectedAiModels;
  }

  _handleSave() {
    const updatedConfig = {} as Record<string, any>;
    this.nodeToEditInfo.Class.configuration.questions.forEach(
      (question: YpStructuredQuestionData, index: number) => {
        const questionElement = this.shadowRoot?.querySelector(
          `#structuredQuestion_${question.uniqueId ? index : `noId_${index}`}`
        ) as any;
        if (questionElement && question.uniqueId) {
          const answer = questionElement.getAnswer();
          if (answer) {
            updatedConfig[question.uniqueId] = answer.value;
          }
        }
      }
    );

    let aiModelUpdates;
    if (this.nodeToEditInfo.Class.configuration.type === 'agent') {
      aiModelUpdates = Object.entries(this.selectedAiModels).map(
        ([size, modelId]) => {
          return {
            size: size as PsAiModelSize,
            modelId: modelId as number | null,
          };
        }
      );
    }

    this.dispatchEvent(
      new CustomEvent('save', {
        detail: {
          updatedConfig,
          aiModelUpdates,
          connectorType: this.nodeToEditInfo.Class.configuration.type === 'input' ? 'input' : 'output',
        },
      })
    );

    this._handleClose();
  }

  static override get styles() {
    return [
      super.styles,
      css`
        .nodeEditHeadlineImage {
          max-width: 100px;
          margin-right: 16px;
        }

        .nodeEditHeadlineTitle {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 55px;
        }

        md-dialog {
          width: 90%;
          height: 90%;
        }

        #surveyContainer {
          margin-bottom: 48px;
        }
      `,
    ];
  }
}