import { BoundingBox, resetVisibility, setVisible, toHTMLElement } from "./utils";
import * as labella from 'labella';
import { max, partition } from "lodash";

const MAX_WIDTH = '300px';

function drawLabelGroup(labelInfo: { symbolBoundingBox?: BoundingBox, labelElement: HTMLElement }[],
    root: HTMLElement, rootBoundingBox: BoundingBox, direction?: "up" | "down") {

    var labelsOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    let labels = labelInfo.map((nodeInfo) => {
        var foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute('xmlns', "http://www.w3.org/1999/xhtml");
        foreignObject.appendChild(nodeInfo.labelElement);
        return foreignObject;
    });
    labels.forEach((node) => labelsOverlay.appendChild(node));
    root.prepend(labelsOverlay);

    let boundingRects = labelInfo.map((info, idx) => {
        var range = document.createRange();
        range.selectNode(info.labelElement);
        return range.getBoundingClientRect();
    });
    let force = new labella.Force({
        minPos: null, nodeSpacing: 12
    }).nodes(labelInfo.map((info, idx) => new labella.Node(
        info.symbolBoundingBox!.center.horizontal,
        boundingRects[idx].width,
        info
    ))).compute();
    let nodes = force.nodes();

    let nodeHeight = max(boundingRects.map(b => b.height)) ?? 12;
    var renderer = new labella.Renderer({
        layerGap: 16,
        nodeHeight,
        direction
    });
    renderer.layout(nodes);

    var viewBox = BoundingBox.of(...nodes.map((node, idx) => {
        let bBox: any = boundingRects[idx];
        return new BoundingBox({
            top: node.y! - bBox.height,
            left: node.x! - bBox.width / 2,
            bottom: node.y! + bBox.height,
            right: node.x! + bBox.width / 2,
        });
    }), rootBoundingBox.relativeTo(rootBoundingBox))!;

    let anchorLineY = direction == "up" ? 0 : rootBoundingBox.height;
    if (direction === "up") {
        let style = root.getAttribute('style');
        if (style && !style.endsWith(';')) style += ';';
        root.setAttribute('style', style + ` margin-top: ${-viewBox.top - nodeHeight * 1.5}px;`);
    }
    if (direction === "down") {
        let style = root.getAttribute('style');
        if (style && !style.endsWith(';')) style += ';';
        root.setAttribute('style', style + ` margin-bottom: ${viewBox.bottom - rootBoundingBox.height + nodeHeight * 2}px;`);
    }

    Object.assign(labelsOverlay.style, {
        position: 'absolute',
        top: viewBox.top - nodeHeight! / 2 + anchorLineY,
        left: viewBox.left,
        width: viewBox.width,
        height: viewBox.height + nodeHeight
    });
    labelsOverlay.setAttribute('viewBox',
        `${viewBox.left} ${viewBox.top - nodeHeight / 2 + anchorLineY} ${viewBox.width} ${viewBox.height + nodeHeight / 2}`);

    nodes.forEach((node, idx) => {
        labels[idx].setAttribute('overflow', 'visible');
        labels[idx].setAttribute('x', `${node.x! - node.dx! / 2}`);
        labels[idx].setAttribute('width', `${node.dx!}`);
        labels[idx].setAttribute('y', `${anchorLineY + node.y! - node.dy! / 4 -
            (direction === 'up' ? boundingRects[idx].height - node.dy! : 0)}`);
        labels[idx].setAttribute('height', `${boundingRects[idx].height}`);
        if (direction == 'down') labels[idx].setAttribute('dominant-baseline', `hanging`);
        let path: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', renderer.generatePath(node));
        path.setAttribute('transform', `translate(0, ${anchorLineY - node.dy! / 4})`);
        Object.assign(path.style, { stroke: 'black', fill: 'none' });
        labelsOverlay.appendChild(path);
    });
}

export function drawLabels(labels: { selector: string, label: any }[], root: HTMLElement) {
    // need to make sure element is rendered to find the bounding box
    let visibility = setVisible(root);
    try {
        let rootBoundingBox = new BoundingBox(root.getBoundingClientRect());
        let labelInfo = labels.map(({ selector, label }) => {
            let elements: Element[] = [...root.querySelectorAll(selector)];
            let labelElement = document.createElement('div');
            labelElement.setAttribute("style", `
                inline-size: auto;
                max-width: ${rootBoundingBox.width * 0.8}pt;
                display: inline-block;
            `);
            switch (label.renderType) {
                case "html":
                    labelElement.appendChild(toHTMLElement(label.value));
                    break;
                case "plain": default:
                    labelElement.appendChild(document.createTextNode(label.value));
                    break;
            }
            return {
                symbolBoundingBox: BoundingBox.of(
                    ...elements.map(node => new BoundingBox(node.getBoundingClientRect()))
                )?.relativeTo(rootBoundingBox), // we use relative coords since our element could be attached anywhere once returned
                labelElement: labelElement
            };
        }).filter(info => info.symbolBoundingBox);
        let center = rootBoundingBox.relativeTo(rootBoundingBox).center;
        let [bottom, top] = partition(labelInfo, info => info.symbolBoundingBox?.center.vertical! >= center.vertical);
        root.style.position = 'relative';
        if (bottom.length > 0) drawLabelGroup(bottom, root, rootBoundingBox, "down");
        if (top.length > 0) drawLabelGroup(top, root, rootBoundingBox, "up");
    } finally {
        resetVisibility(root, visibility);
    }
}
