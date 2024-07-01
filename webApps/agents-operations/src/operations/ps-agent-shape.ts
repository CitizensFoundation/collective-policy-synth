import { dia, shapes, util, V } from '@joint/core';
import { OpsServerApi } from './OpsServerApi';

const api = new OpsServerApi();

export class AgentsShapeView extends dia.ElementView {
  render() {
    super.render();

    const htmlMarkup = this.model.get('markup');

    //TODO: Make TS work here
    const nodeType = this.model.attributes.nodeType as PsAgentsNodeType;

    let foreignObjectWidth = 200;
    let foreignObjectHeight = 230;

    if (nodeType === 'connector') {
      foreignObjectWidth = 140;
      foreignObjectHeight = 180;
    }

    // Create a foreignObject with a set size and style
    const foreignObject = V('foreignObject', {
      width: foreignObjectWidth,
      height: foreignObjectHeight,
      style: 'overflow: visible; display: block;',
    }).node;

    // Append the foreignObject to this.el
    V(this.el).append(foreignObject);

    // Defer the addition of the inner div with the HTML content
    setTimeout(() => {
      const div = document.createElement('div');
      div.setAttribute('class', 'html-element');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

      if (nodeType === 'agent') {
        div.innerHTML = `<ps-agent-node
          agentId="${this.model.attributes.agentId}"
        >
     </ps-agent-node>`;
        div.className = 'agentContainer';
      } else {
        div.innerHTML = `<ps-connector-node
          connectorId="${this.model.attributes.connectorId}"
        >
      </ps-connector-node>`;
        div.className = 'connectorContainer';
      }

      // Append the div to the foreignObject
      foreignObject.appendChild(div);

      // Force layout recalculation and repaint
      foreignObject.getBoundingClientRect();
    }, 0); // A timeout of 0 ms defers the execution until the browser has finished other processing

    // Add event listener for position changes
    this.listenTo(this.model, 'change:position', this.updateNodePosition);

    this.update();
    return this;
  }

  updateNodePosition = util.debounce(() => {
    const nodeType = this.model.attributes.nodeType;
    const nodeId = nodeType === 'agent' ? this.model.attributes.agentId : this.model.attributes.connectorId;
    const position = this.model.position();

    api.updateNodeConfiguration(nodeType, nodeId, {
      graphPosX: position.x,
      graphPosY: position.y
    });
  }, 500);
}

export class AgentShape extends shapes.standard.Rectangle {
  defaults() {
    return util.deepSupplement(
      {
        type: 'html.AgentShape',
        attrs: {},
        markup: '<div></div>',
      },
      shapes.standard.Rectangle.prototype.defaults
    );
  }

  view = AgentsShapeView;
}
