import * as labella from 'labella';
import _, { max, over, partition } from "lodash";
import { KatexOptions } from "katex";
import { BoundingBox } from '../utils/boundingBox';
import { resetVisibility, setVisible } from '../utils/visibility';
import { toHTMLElement } from '../utils/dom';
import { INSTANCE_DATA_ATTR, SelectorInfo, toSelectorStrings } from '../ffl';
import { IndexedInstance } from '../language/styleMarkers';

const delimiterInElement = [{
    left: "$$",
    right: "$$",
    display: true
}, {
    left: "\\(",
    right: "\\)",
    display: false
},
{ left: "$", right: "$", display: false },
{
    left: "\\begin{equation}",
    right: "\\end{equation}",
    display: true
}, {
    left: "\\begin{align}",
    right: "\\end{align}",
    display: true
}, {
    left: "\\begin{alignat}",
    right: "\\end{alignat}",
    display: true
}, {
    left: "\\begin{gather}",
    right: "\\end{gather}",
    display: true
}, {
    left: "\\begin{CD}",
    right: "\\end{CD}",
    display: true
}, {
    left: "\\[",
    right: "\\]",
    display: true
}];

function drawLabelGroup(labelInfo: {
    symbolBoundingBox?: BoundingBox,
    labelElement: HTMLElement,
    labelPosition?: "above" | "below" | "auto",
    labelMarker?: "line" | "extent",
    markerOffset?: {
        x?: number,
        y?: number
    }
}[], root: HTMLElement, rootBoundingBox: BoundingBox, direction?: "up" | "down") {

    var labelsOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    let labels = labelInfo.map((nodeInfo) => {
        var foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute('xmlns', "http://www.w3.org/1999/xhtml");
        if ((window as any).renderMathInElement)
            (window as any).renderMathInElement(nodeInfo.labelElement, { delimiters: delimiterInElement });
        foreignObject.appendChild(nodeInfo.labelElement);
        return foreignObject;
    });
    labels.forEach((node) => labelsOverlay.appendChild(node));
    root.prepend(labelsOverlay);

    let boundingRects = labelInfo.map((info) => {
        var range = document.createRange();
        range.selectNode(info.labelElement);
        return range.getBoundingClientRect();
    });

    const MAX_WIDTH = rootBoundingBox.width * 0.8;
    labelInfo.forEach((e, i) => {
        let width = boundingRects[i].width <= MAX_WIDTH
            ? boundingRects[i].width
            : MAX_WIDTH;
        e.labelElement.setAttribute("style", `
            inline-size: fit-content;
            max-width: ${MAX_WIDTH}px;
        `)
    });

    boundingRects = labelInfo.map((info) => {
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
        root.setAttribute('style', style + ` margin-top: ${-viewBox.top - nodeHeight}px;`);
    }
    if (direction === "down") {
        let style = root.getAttribute('style');
        if (style && !style.endsWith(';')) style += ';';
        root.setAttribute('style', style + ` margin-bottom: ${viewBox.bottom - rootBoundingBox.height + nodeHeight}px;`);
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
        labels[idx].setAttribute('dy', `${node.dy!}`);
        labels[idx].setAttribute('y', `${anchorLineY + node.y! -
            (direction === 'up' ? boundingRects[idx].height - node.dy! / 2 : node.dy! / 4)}`);
        labels[idx].setAttribute('height', `${boundingRects[idx].height}`);
        if (direction == 'down') labels[idx].setAttribute('dominant-baseline', `hanging`);
        const rebasedPath = function (x: number, y: number) {
            let defaultPath = renderer.generatePath(node); // TODO: Generate own path to accommodate more range of offsets
            return `M${x} ${y} ` + defaultPath.slice(defaultPath.indexOf('C'));
        }
        if ((labelInfo[idx].labelMarker ?? 'line') === 'line') {
            let path: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d',
                rebasedPath(node.data.symbolBoundingBox.center.horizontal + (labelInfo[idx].markerOffset?.x ?? 0)
                    , (direction == "up"
                        ? node.data.symbolBoundingBox.top
                        : node.data.symbolBoundingBox.bottom - anchorLineY)
                    + (labelInfo[idx].markerOffset?.y ?? 0)));
            console.log(renderer.generatePath(node));
            console.log(renderer.getWaypoints(node));
            path.setAttribute('transform', `translate(0, ${anchorLineY - node.dy! / 4})`);
            Object.assign(path.style, { stroke: 'black', fill: 'none' });
            labelsOverlay.appendChild(path);
        } else if (labelInfo[idx].labelMarker === 'extent') {
            let path: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let base = direction === 'up' ? anchorLineY - 4 : anchorLineY - rootBoundingBox.height + 4;
            path.setAttribute('d', rebasedPath(
                node.data.symbolBoundingBox.center.horizontal + (labelInfo[idx].markerOffset?.x ?? 0),
                base + (labelInfo[idx].markerOffset?.y ?? 0)));
            path.setAttribute('transform', `translate(0, ${anchorLineY - node.dy! / 4})`);
            Object.assign(path.style, { stroke: 'black', fill: 'none' });

            let brace: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let edgeY = direction === 'up' ? node.data.symbolBoundingBox.top : node.data.symbolBoundingBox.bottom - rootBoundingBox.height;
            brace.setAttribute('d', `M${node.data.symbolBoundingBox.left} ${edgeY}
                V${base} H${node.data.symbolBoundingBox.right} V${edgeY}`);
            brace.setAttribute('transform',
                `translate(${labelInfo[idx].markerOffset?.x ?? 0}, ${anchorLineY - node.dy! / 4 + (labelInfo[idx].markerOffset?.y ?? 0)})`);
            Object.assign(brace.style, { stroke: 'black', fill: 'none' });

            labelsOverlay.appendChild(path);
            labelsOverlay.appendChild(brace);
        }
    });
}

export type LabelInfo = {
    selectorInfo: SelectorInfo[],
    label: any,
    labelPosition?: "above" | "below" | "auto",
    labelMarker?: "line" | "extent",
    markerOffset?: {
        x?: number,
        y?: number
    }
}[];
export function drawLabels(labels: LabelInfo, root: HTMLElement, scopeKey: string) {
    // need to make sure element is rendered to find the bounding box
    let visibility = setVisible(root);
    try {
        let rootBoundingBox = new BoundingBox(root.getBoundingClientRect());
        let labelInfo = labels.flatMap(({ selectorInfo, label, labelPosition, labelMarker, markerOffset }) =>
            toSelectorStrings(selectorInfo, scopeKey).map((ss, idx) => ({
                selector: ss,
                classes: selectorInfo[idx].selectors.map(s => s.class),
                label, labelPosition, labelMarker, markerOffset
            }))
        ).map(({ selector, classes, label, labelPosition, labelMarker, markerOffset }) => {
            let elements: Element[] = groupByInstance(
                [...root.querySelectorAll(selector).values()], classes
            )[0];
            let labelElement = document.createElement('div');
            switch (label.renderType) {
                case "html": labelElement.appendChild(toHTMLElement(label.value)); break;
                case "plain": default: labelElement.appendChild(document.createTextNode(label.value)); break;
            }
            labelElement.classList.add("ffl-label");
            labelElement.classList.add("visible");
            return {
                symbolBoundingBox: elements !== undefined ? BoundingBox.of(
                    ...elements.map(node => new BoundingBox(node.getBoundingClientRect()))
                )?.relativeTo(rootBoundingBox) : undefined, // we use relative coords since our element could be attached anywhere once returned
                labelElement, labelPosition, labelMarker, markerOffset
            };
        }).filter(info => info.symbolBoundingBox);
        let center = rootBoundingBox.relativeTo(rootBoundingBox).center;
        let [top, bottom] = partition(labelInfo, info =>
            (info.labelPosition && info.labelPosition !== 'auto') ? info.labelPosition === 'above'
                : info.symbolBoundingBox?.center.vertical! >= center.vertical);
        root.style.position = 'relative';
        if (bottom.length > 0) drawLabelGroup(bottom, root, rootBoundingBox, "down");
        if (top.length > 0) drawLabelGroup(top, root, rootBoundingBox, "up");
    } catch (e) {
        console.log(e);
        throw e;
    } finally {
        resetVisibility(root, visibility);
    }
}

// just a shorthand that is unlikely to be useful elsewhere
type ElementWithInstance = {
    element: Element, instanceIndices: IndexedInstance[]
};

function groupByStyleInstance(
    elements: ElementWithInstance[],
    styleClass: string): ElementWithInstance[][] {
    var groups: {
        [idx: number]: ElementWithInstance[]
    } = [];
    elements.forEach(({ element, instanceIndices }) =>
        instanceIndices.filter(([style, _]) => styleClass === style)
            .map(([_, idx]) => idx)
            .forEach(idx => (groups[idx] ??= []).push({ element, instanceIndices }))
    );
    return Object.values(groups);
}

function groupByInstance(elements: Element[], classes: string[]): Element[][] {
    let groups = [elements.map(element => ({
        element,
        instanceIndices: JSON.parse(element.getAttribute(INSTANCE_DATA_ATTR)!)
    }))];
    for (var cls of classes) {
        groups = groups.flatMap(e => groupByStyleInstance(e, cls))
    }
    return groups.map(g => g.map(({ element }) => element));
}

export type BackgroundInfo = { selectorInfo: SelectorInfo[], backgroundColor: any }[];
export function drawBackground(backgroundInfo: BackgroundInfo, root: HTMLElement, scopeKey: string) {
    // need to make sure element is rendered to find the bounding box
    let visibility = setVisible(root);
    try {
        let rootBoundingBox = new BoundingBox(root.getBoundingClientRect());
        var overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        Object.assign(overlay.style, {
            position: 'absolute',
            top: 0,
            left: 0,
            width: rootBoundingBox.width,
            height: rootBoundingBox.height
        });
        overlay.setAttribute('viewBox', `${0} ${0}
            ${rootBoundingBox.width} ${rootBoundingBox.height}`);

        root.style.position = 'relative';
        backgroundInfo.flatMap(({ selectorInfo, backgroundColor }) =>
            toSelectorStrings(selectorInfo, scopeKey).map((ss, idx) => ({
                selector: ss,
                classes: selectorInfo[idx].selectors.map(s => s.class),
                backgroundColor
            }))
        ).forEach(({ selector, classes, backgroundColor }) =>
            groupByInstance(
                [...root.querySelectorAll(selector).values()], classes
            ).map(group => {
                var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                bgRect.setAttribute('stroke', 'none');
                bgRect.setAttribute('fill', backgroundColor);
                let bgRectDim = BoundingBox.of(
                    ...group.map(node => new BoundingBox(node.getBoundingClientRect()))
                )!.relativeTo(rootBoundingBox);
                bgRect.setAttribute('x', `${bgRectDim.left}`);
                bgRect.setAttribute('y', `${bgRectDim.top}`);
                bgRect.setAttribute('width', `${bgRectDim.width}`);
                bgRect.setAttribute('height', `${bgRectDim.height}`);
                return bgRect;
            }).forEach(bgRect => overlay.appendChild(bgRect))
        );
        root.prepend(overlay);
    } finally {
        resetVisibility(root, visibility);
    }
}