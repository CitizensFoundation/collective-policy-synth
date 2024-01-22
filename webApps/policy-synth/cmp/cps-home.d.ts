import '@yrpri/webapp/cmp/common/yp-image.js';
import { PsStageBase } from './base/cps-stage-base.js';
export declare class PsHome extends PsStageBase {
    connectedCallback(): Promise<void>;
    updated(changedProperties: Map<string | number | symbol, unknown>): void;
    disconnectedCallback(): void;
    static get styles(): (any[] | import("lit").CSSResult)[];
    renderProject(project: PsProjectData): import("lit-html").TemplateResult<1>;
    render(): import("lit-html").TemplateResult<1>;
}
//# sourceMappingURL=ps-home.d.ts.map