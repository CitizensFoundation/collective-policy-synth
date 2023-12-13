import { PropertyValueMap, css, html, nothing } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { dia, shapes, util, highlighters, V } from 'jointjs';

import { CpsStageBase } from '../cps-stage-base.js';

import './ltp-current-reality-tree-node.js';
import { LtpServerApi } from './LtpServerApi.js';

type Cell = dia.Element | dia.Link;

const TESTING = false;

class MyShapeView extends dia.ElementView {
  render() {
    super.render();
    const htmlMarkup = this.model.get('markup');

    // Create a foreignObject with a set size and style
    const foreignObject = V('foreignObject', {
      width: this.model.attributes.nodeType === "ude" ? 185 : 185,
      height: this.model.attributes.nodeType === "ude" ? 135 : 107,
      style: 'overflow: visible; display: block;',
    }).node;

    // Append the foreignObject to this.el
    V(this.el).append(foreignObject);

    // Defer the addition of the inner div with the HTML content
    setTimeout(() => {
      const div = document.createElement('div');
      div.setAttribute('class', 'html-element');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = this.model.attributes.nodeType === "ude" ? '185px' : '185px';
      div.style.height = this.model.attributes.nodeType === "ude" ? '135px' : '107px';
      div.className = `causeContainer ${
        this.model.attributes.isRootCause ? 'rootCauseContainer' : ''
      } ${
        this.model.attributes.nodeType=="ude" ? 'udeContainer' : ''
      }`;
      div.innerHTML = `<ltp-current-reality-tree-node
        nodeId="${this.model.attributes.nodeId}"
        crtNodeType="${this.model.attributes.nodeType}"
        ${this.model.attributes.isRootCause ? 'isRootCause=1' : ''}
        causeDescription="${this.model.attributes.label}"
      >
      </ltp-current-reality-tree-node>`;

      // Append the div to the foreignObject
      foreignObject.appendChild(div);

      // Force layout recalculation and repaint
      foreignObject.getBoundingClientRect();
    }, 0); // A timeout of 0 ms defers the execution until the browser has finished other processing

    this.update();
    return this;
  }
}

class MyShape extends shapes.devs.Model {
  defaults() {
    return util.deepSupplement(
      {
        type: 'html.MyShape',
        attrs: {},
        markup: '<div></div>',
      },
      shapes.devs.Model.prototype.defaults
    );
  }

  view = MyShapeView;
}

@customElement('ltp-current-reality-tree')
export class LtpCurrentRealityTree extends CpsStageBase {
  @property({ type: Object }) crtData?: LtpCurrentRealityTreeData;
  private graph: dia.Graph;
  private paper: dia.Paper;
  private elements: { [key: string]: dia.Element } = {};
  private selection: dia.Element | null = null;

  api: LtpServerApi;

  constructor() {
    super();
    this.api = new LtpServerApi();
  }

  async connectedCallback() {
    super.connectedCallback();
    window.appGlobals.activity(`CRT - open`);

    this.addEventListener('add-nodes', this.addNodesEvent as EventListener);
    this.addGlobalListener('add-nodes', this.addNodesEvent.bind(this) as EventListener);
  }

  addNodesEvent(event: CustomEvent<any>) {
    this.addNodes(event.detail.parentNodeId, event.detail.nodes);
  }

  protected firstUpdated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
  ): void {
    this.initializeJointJS();
  }

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has('crtData') && this.crtData) {
      this.updateGraphWithCRTData(this.crtData);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.appGlobals.activity(`CRT - close`);
  }

  jointNamespace = {};

  private initializeJointJS(): void {
    const paperContainer = this.shadowRoot?.getElementById(
      'paper-container'
    ) as HTMLElement;

    if (!paperContainer) {
      console.error('Paper container not found');
      return;
    }

    this.graph = new dia.Graph({}, { cellNamespace: this.jointNamespace });
    this.paper = new dia.Paper({
      //@ts-ignore
      elementView: () => MyShapeView,
      el: paperContainer,
      model: this.graph,
      cellViewNamespace: this.jointNamespace,
      width: '100%',
      height: '100%',
      gridSize: 10,
      async: true,
      frozen: true,
      sorting: dia.Paper.sorting.APPROX,
      background: { color: 'var(--md-sys-color-surface)' },
      clickThreshold: 10,
      defaultConnector: {
        name: 'rounded',
        // Add attributes for the arrowheads to point upwards
      },
      defaultRouter: {
        name: 'orthogonal',
        args: {
          // Make sure the links go from bottom to top
          startDirections: ['bottom'],
          endDirections: ['top'],
        },
      },
    });

    this.paper.on('element:pointerclick', elementView => {
      this.selectElement((elementView as any).model as dia.Element);
    });

    this.paper.on('blank:pointerclick', () => this.selectElement(null));

    // Initialize SVG styles for the paper
    V(paperContainer as any).prepend(
      V('style', {
        type: 'text/css',
      }).text(`
        .joint-element .selection {
            stroke: var(--md-sys-color-surface);
        }
        .joint-link .selection {
            stroke: var(--md-sys-color-surface);
            stroke-dasharray: 5;
            stroke-dashoffset: 10;
            animation: dash 0.5s infinite linear;
        }
        @keyframes dash {
            to {
                stroke-dashoffset: 0;
            }
        }
      `)
    );

    Object.assign(this.jointNamespace, {
      myShapeGroup: {
        MyShape,
        MyShapeView,
      },
      standard: {
        Rectangle: shapes.standard.Rectangle,
      },
    });

    this.updatePaperSize();
    this.paper.unfreeze();
    this.updatePaperSize();
  }

  private updatePaperSize(): void {
    if (!this.paper) {
      console.warn('Paper not initialized');
      return;
    }

    // Get the bounding box of the diagram
    const bbox = this.paper.getContentBBox();

    // Check if bbox is valid
    if (!bbox || bbox.width === 0 || bbox.height === 0) {
      console.warn('Invalid content bounding box');
      return;
    }

    // Set the dimensions of the paper to the size of the diagram
    //this.paper.setDimensions(bbox.width, 15000);
  }

  private createElement(node: LtpCurrentRealityTreeDataNode): dia.Element {
    //@ts-ignore
    const el = new MyShape({
      // position: { x: Math.random() * 600, y: Math.random() * 400 },
      label: node.description,
      text: node.description,
      nodeId: node.id,
      nodeType: node.type,
      isRootCause: node.isRootCause,
      attrs: {
        //cause: node.description,
      },
      type: 'html.Element',
    });
    el.addTo(this.graph);
    return el;
  }

  private updateGraphWithCRTData(crtData: LtpCurrentRealityTreeData): void {
    // Clear the existing graph elements
    this.graph.clear();
    this.elements = {};

    console.error(
      'Updating graph with CRT data:',
      JSON.stringify(crtData, null, 2)
    ); // Log the entire data being processed

    // Function to recursively create elements/nodes
    const createNodes = (nodeData: LtpCurrentRealityTreeDataNode) => {
      console.log('Creating node for:', nodeData.id); // Log the ID of the node being processed

      const el = this.createElement(nodeData);
      this.elements[nodeData.id] = el;

      const processChildren = (children: LtpCurrentRealityTreeDataNode[]) => {
        children.forEach(childNode => {
          createNodes(childNode); // Recursive call
        });
      };

      if (nodeData.andChildren) {
        processChildren(nodeData.andChildren);
      }
      if (nodeData.orChildren) {
        processChildren(nodeData.orChildren);
      }
    };

    // Create all elements/nodes
    crtData.nodes.forEach(createNodes);

    // Create links for all 'andChildren' and 'orChildren'
    const createLinks = (
      source: dia.Element,
      children: LtpCurrentRealityTreeDataNode[]
    ) => {
      children.forEach(childNode => {
        const targetElement = this.elements[childNode.id];
        if (!targetElement) {
          console.error(
            `Target element not found for node ID: ${childNode.id}`
          );
          return;
        }

        console.log('Creating link from', source.id, 'to', childNode.id); // Log the source and target IDs
        this.createLink(source, targetElement);

        // Recursively create links for nested children
        if (childNode.andChildren) {
          createLinks(targetElement, childNode.andChildren);
        }
        if (childNode.orChildren) {
          createLinks(targetElement, childNode.orChildren);
        }
      });
    };

    crtData.nodes.forEach(node => {
      const sourceElement = this.elements[node.id];
      if (node.andChildren) {
        createLinks(sourceElement, node.andChildren);
      }
      if (node.orChildren) {
        createLinks(sourceElement, node.orChildren);
      }
    });

    this.layoutGraph();
  }

  // Function to create a link/edge
  private createLink(source: dia.Element, target: dia.Element): dia.Link {
    if (!source || !target) {
      console.error(`source or target is null ${source} ${target}`);
      return;
    }
    const l = new shapes.standard.Link({
      source: { id: target.id },
      target: { id: source.id },
      attrs: {
        '.connection': {
          stroke: 'var(--md-sys-color-on-surface)',
          'stroke-width': 2,
        },
        '.marker-target': {
          fill: 'var(--md-sys-color-on-surface)',
          d: 'M 10 -5 L 0 0 L 10 5 z',
          // Make sure the marker is at the start of the path (bottom of the source)
          'ref-x': 0.5,
          'ref-y': 0,
        },
      },
      z: 1,
      router: {
        name: 'orthogonal',
        args: {
          startDirections: ['top'],
          endDirections: ['bottom'],
        },
      },
      connector: { name: 'rounded' },
    });

    this.graph.addCell(l);
    return l;
  }

  private selectElement(el: dia.Element | null): void {
    debugger;
    // Deselect the current selection if any
    if (this.selection) {
      this.unhighlightCell(this.selection);
      this.graph.getLinks().forEach(link => this.unhighlightCell(link));
    }

    // Select and highlight the new element
    if (el) {
      this.highlightCell(el);
      this.selection = el;
    } else {
      this.selection = null;
    }
  }

  private highlightCell(cell: Cell): void {
    const view = cell.findView(this.paper);
    if (view) {
      highlighters.addClass.add(
        view,
        cell.isElement() ? 'body' : 'line',
        'selection',
        { className: 'selection' }
      );
    }
  }

  private unhighlightCell(cell: Cell): void {
    const view = cell.findView(this.paper);
    if (view) {
      highlighters.addClass.remove(view, 'selection');
    }
  }

  addNodes(parentNodeId: string, nodes: LtpCurrentRealityTreeDataNode[]): void {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      console.error('No nodes provided to add');
      return;
    }

    const findAndUpdateParentNode = (
      nodeDataArray: LtpCurrentRealityTreeDataNode[],
      parentNodeId: string
    ) => {
      for (const nodeData of nodeDataArray) {
        if (nodeData.id === parentNodeId) {
          // Found the parent node, update its andChildren
          nodeData.andChildren = nodeData.andChildren || [];
          nodeData.andChildren.push(...nodes);
          return true;
        }
        // Recursively search in andChildren and orChildren
        if (
          nodeData.andChildren &&
          findAndUpdateParentNode(nodeData.andChildren, parentNodeId)
        )
          return true;
        if (
          nodeData.orChildren &&
          findAndUpdateParentNode(nodeData.orChildren, parentNodeId)
        )
          return true;
      }
      return false;
    };

    // Start the search from the root nodes
    if (!findAndUpdateParentNode(this.crtData.nodes, parentNodeId)) {
      console.error(`Parent node with ID ${parentNodeId} not found in crtData`);
      return;
    }

    const parentNode = this.elements[parentNodeId];

    if (!parentNode) {
      console.error(`Parent node with ID ${parentNodeId} not found`);
      return;
    }

    nodes.forEach(node => {
      node.andChildren = [];
      node.orChildren = [];
      const newNode = this.createElement(node);
      this.elements[node.id] = newNode;

      // Create a link from the parent node to the new node
      this.createLink(parentNode, newNode);
    });

    // Refresh the paper to reflect the new nodes
    this.layoutGraph();

    // wait for two seconds
    setTimeout(() => {
      // then unfreeze the paper
      this.layoutGraph();
    }, 2000);
  }

  private layoutGraph(): void {
    const nodeWidth = 185;
    const nodeHeight = 50;
    const verticalSpacing = 170;
    const horizontalSpacing = 45; // You might want to adjust this dynamically based on the tree width
    const topPadding = 60; // Padding at the top of the container

    // Function to get the width of a subtree rooted at a given node
    const getSubtreeWidth = (node: LtpCurrentRealityTreeDataNode): number => {
      let width = nodeWidth;
      if (node.andChildren) {
        width = Math.max(
          width,
          node.andChildren.reduce(
            (acc, child) => acc + getSubtreeWidth(child) + horizontalSpacing,
            0
          ) - horizontalSpacing
        );
      }
      if (node.orChildren) {
        width = Math.max(
          width,
          node.orChildren.reduce(
            (acc, child) => acc + getSubtreeWidth(child) + horizontalSpacing,
            0
          ) - horizontalSpacing
        );
      }
      return width;
    };

    // Recursive function to layout nodes, this will align parents above their children
    const layoutNodes = (
      nodes: LtpCurrentRealityTreeDataNode[],
      x: number,
      y: number
    ) => {
      let xOffset = x;
      nodes.forEach(node => {
        const subtreeWidth = getSubtreeWidth(node);
        const nodeCenterX = xOffset + subtreeWidth / 2;
        this.elements[node.id].position(nodeCenterX - nodeWidth / 2, y);

        if (node.andChildren) {
          layoutNodes(node.andChildren, xOffset, y + verticalSpacing);
        }
        if (node.orChildren) {
          layoutNodes(node.orChildren, xOffset, y + verticalSpacing);
        }
        xOffset += subtreeWidth + horizontalSpacing;
      });
    };

    // Calculate initial x offset to center the tree
    const totalWidth = this.crtData.nodes.reduce(
      (acc, node) => acc + getSubtreeWidth(node) + horizontalSpacing,
      -horizontalSpacing
    );
    console.error(this.paper.options);
    //TODO: Figure this out better
    const initialXOffset = (1900 - totalWidth) / 2;

    //    const initialXOffset = ((this.paper.options as any).width - totalWidth) / 2;

    // Start the layout process
    if (this.crtData && this.crtData.nodes) {
      layoutNodes(this.crtData.nodes, initialXOffset, topPadding); // Start from the centered x position and top padding
    }

    this.updatePaperSize();
    this.paper.unfreeze(); // Unfreeze the paper to render the layout
    this.updatePaperSize();
  }

  static get styles() {
    return [
      super.styles,
      css`
        .causeContainer {
          color: var(--md-sys-color-on-secondary-container);
          background-color: var(--md-sys-color-secondary-container);
          border-radius: 16px;
          padding: 0;
        }

        .rootCauseContainer {
          color: var(--md-sys-color-on-primary-container);
          background-color: var(--md-sys-color-primary-container);
          border-radius: 8px;
          padding: 0;
        }

        .udeContainer {
          color: var(--md-sys-color-on-tertiary-container);
          background-color: var(--md-sys-color-tertiary-container);
          border-radius: 8px;
          padding: 0;
        }

        /* Define your component styles here */
        .jointJSCanvas {
          width: 1920px !important;
          height: 25000px !important;
          overflow-x: auto !important;
          overflow-y: auto !important;
          /* styles for the JointJS canvas */
        }
      `,
    ];
  }

  render() {
    return html` <div class="jointJSCanvas" id="paper-container"></div> `;
  }
}
