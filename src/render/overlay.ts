import * as labella from 'labella';
import _, { max, over, partition } from "lodash";
import { KatexOptions } from "katex";
import { BoundingBox } from '../utils/boundingBox';
import { resetVisibility, setVisible } from '../utils/visibility';
import { toHTMLElement } from '../utils/dom';
import { INSTANCE_DATA_ATTR, SelectorInfo, toSelectorStrings } from '../../ffl';
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
    direction ??= "up";

    var labelsOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    let labels = labelInfo.map((nodeInfo) => {
        var foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute('xmlns', "http://www.w3.org/1999/xhtml");
        if ((window as any).renderMathInElement)
            (window as any).renderMathInElement(nodeInfo.labelElement, { delimiters: delimiterInElement });
        foreignObject.appendChild(nodeInfo.labelElement);
        return foreignObject;
    });
    labels.forEach((node) => {
        labelsOverlay.appendChild(node);
    });
    root.prepend(labelsOverlay);

    labelInfo.forEach((e) => {
        e.labelElement.style.inlineSize = "max-content";
    });

    let boundingRects = labelInfo.map((info) => {
        var range = document.createRange();
        range.selectNode(info.labelElement);
        return range.getBoundingClientRect();
    });

    const PREFERRED_WIDTH = rootBoundingBox.width * 0.8;
    labelInfo.forEach((e, i) => {
        if (boundingRects[i].width <= PREFERRED_WIDTH) {
            Object.assign(e.labelElement.style, {
                inlineSize: "max-content",
                maxWidth: `${PREFERRED_WIDTH}px`
            });
        } else {
            Object.assign(e.labelElement.style, {
                inlineSize: "fit-content",
                // minWidth: `${PREFERRED_WIDTH}px`
            });
        }
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
        // let bBox: any = boundingRects[idx];
        return new BoundingBox({
            top: node.y!,
            left: node.x! - node.dx! / 2,
            bottom: node.y! + node.dy!,
            right: node.x! + node.dx! / 2,
        });
    }), rootBoundingBox.relativeTo(rootBoundingBox))!;

    let anchorLineY = direction == "up" ? 0 : rootBoundingBox.height;

    Object.assign(labelsOverlay.style, {
        position: 'absolute',
        top: viewBox.top,
        left: viewBox.left,
        width: viewBox.width,
        height: viewBox.height + anchorLineY
    });
    let style = root.getAttribute('style');
    if (style && !style.endsWith(';')) style += ';';
    if (direction === "up") {
        root.setAttribute('style', style + ` margin-top: ${nodeHeight + 16}px;`);
    }
    if (direction === "down") {
        root.setAttribute('style', style + ` margin-bottom: ${nodeHeight + 16}px;`);
    }
    // console.log(viewBox);
    labelsOverlay.setAttribute('viewBox',
        `${viewBox.left} ${viewBox.top} ${viewBox.width} ${viewBox.height + anchorLineY}`);

    nodes.forEach((node, idx) => {
        labels[idx].setAttribute('overflow', 'visible');
        labels[idx].setAttribute('x', `${node.x! - node.dx! / 2}`);
        labels[idx].setAttribute('width', `${node.dx!}`);
        labels[idx].setAttribute('y', `${anchorLineY + node.y! + (direction === 'up' ? node.dy! - boundingRects[idx].height : 0)}`);
        labels[idx].setAttribute('height', `${boundingRects[idx].height}`);
        if (direction == 'down') labels[idx].setAttribute('dominant-baseline', `hanging`);
        const rebasedPath = function (x: number, y: number) {
            let defaultPath = renderer.generatePath(node); // TODO: Generate own path to accommodate more range of offsets
            return `M${x} ${y} ` + defaultPath.slice(defaultPath.indexOf('C'));
        }
        let path: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let base = direction === 'up' ? anchorLineY - 4 : anchorLineY - rootBoundingBox.height + 4;
        let braceY = direction === 'up' ? base + 4 : base - 4;

        path.setAttribute('d', rebasedPath(
            node.data.symbolBoundingBox.center.horizontal,
            base + (labelInfo[idx].markerOffset?.y ?? 0)));
        path.setAttribute('transform', `translate(${labelInfo[idx].markerOffset?.x ?? 0}, ${anchorLineY})`);
        Object.assign(path.style, { stroke: 'black', fill: 'none' });

        if (labelInfo[idx].labelMarker === 'extent') {
            let brace: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            brace.setAttribute('d', `M${node.data.symbolBoundingBox.left} ${braceY}
                V${base} H${node.data.symbolBoundingBox.right} V${braceY}`);
            brace.setAttribute('transform',
                `translate(${labelInfo[idx].markerOffset?.x ?? 0}, ${anchorLineY + (labelInfo[idx].markerOffset?.y ?? 0)})`);
            Object.assign(brace.style, { stroke: 'black', fill: 'none' });
            labelsOverlay.appendChild(brace);
        }

        labelsOverlay.appendChild(path);
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
                [...root.querySelectorAll(selector).values()].filter(isVisible), classes
            )[0];
            // console.log(elements);
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
                : info.symbolBoundingBox?.center.vertical! <= center.vertical);
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

function isVisible(element: Element): boolean {
    return element.textContent ? true : false;
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
                [...root.querySelectorAll(selector).values()].filter(isVisible), classes
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

export type BorderInfo = { selectorInfo: SelectorInfo[], border: any }[];
export function drawBorders(backgroundInfo: BorderInfo, root: HTMLElement, scopeKey: string) {
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

        root.prepend(overlay);

        root.style.position = 'relative';
        backgroundInfo.flatMap(({ selectorInfo, border }) =>
            toSelectorStrings(selectorInfo, scopeKey).map((ss, idx) => ({
                selector: ss,
                classes: selectorInfo[idx].selectors.map(s => s.class),
                border
            }))
        ).forEach(({ selector, classes, border }) =>
            groupByInstance(
                [...root.querySelectorAll(selector).values()].filter(isVisible), classes
            ).map(group => {
                var foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
                foreignObject.setAttribute('xmlns', "http://www.w3.org/1999/xhtml");
                var borderRect = document.createElement('div');
                borderRect.innerHTML = ""

                let bgRectDim = BoundingBox.of(
                    ...group.map(node => new BoundingBox(node.getBoundingClientRect()))
                )!.relativeTo(rootBoundingBox);

                borderRect.setAttribute('style', `
                    border: ${border};
                    left: 1px;
                    top: 1px;
                    position: relative;
                    width: ${bgRectDim.width}px;
                    height: ${bgRectDim.height}px;
                `)

                foreignObject.setAttribute('x', `${bgRectDim.left - 1}`);
                foreignObject.setAttribute('y', `${bgRectDim.top - 1}`);

                borderRect.setAttribute('width', `${bgRectDim.width}`);
                borderRect.setAttribute('height', `${bgRectDim.height}`);

                foreignObject.appendChild(borderRect);

                overlay.appendChild(foreignObject)

                var rectB = borderRect.getBoundingClientRect();
                foreignObject.setAttribute('width', `${rectB.width + 2}`);
                foreignObject.setAttribute('height', `${rectB.height + 2}`);

                return foreignObject;
            })
        );
    } finally {
        resetVisibility(root, visibility);
    }
}