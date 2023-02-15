"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawBackground = exports.drawLabels = void 0;
const labella = __importStar(require("labella"));
const lodash_1 = require("lodash");
const boundingBox_1 = require("../utils/boundingBox");
const visibility_1 = require("../utils/visibility");
const dom_1 = require("../utils/dom");
const ffl_1 = require("../ffl");
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
function drawLabelGroup(labelInfo, root, rootBoundingBox, direction) {
    var _a;
    var labelsOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    let labels = labelInfo.map((nodeInfo) => {
        var foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObject.setAttribute('xmlns', "http://www.w3.org/1999/xhtml");
        if (window.renderMathInElement)
            window.renderMathInElement(nodeInfo.labelElement, { delimiters: delimiterInElement });
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
        `);
    });
    boundingRects = labelInfo.map((info) => {
        var range = document.createRange();
        range.selectNode(info.labelElement);
        return range.getBoundingClientRect();
    });
    let force = new labella.Force({
        minPos: null, nodeSpacing: 12
    }).nodes(labelInfo.map((info, idx) => new labella.Node(info.symbolBoundingBox.center.horizontal, boundingRects[idx].width, info))).compute();
    let nodes = force.nodes();
    let nodeHeight = (_a = (0, lodash_1.max)(boundingRects.map(b => b.height))) !== null && _a !== void 0 ? _a : 12;
    var renderer = new labella.Renderer({
        layerGap: 16,
        nodeHeight,
        direction
    });
    renderer.layout(nodes);
    var viewBox = boundingBox_1.BoundingBox.of(...nodes.map((node, idx) => {
        let bBox = boundingRects[idx];
        return new boundingBox_1.BoundingBox({
            top: node.y - bBox.height,
            left: node.x - bBox.width / 2,
            bottom: node.y + bBox.height,
            right: node.x + bBox.width / 2,
        });
    }), rootBoundingBox.relativeTo(rootBoundingBox));
    let anchorLineY = direction == "up" ? 0 : rootBoundingBox.height;
    Object.assign(labelsOverlay.style, {
        position: 'absolute',
        top: viewBox.top - nodeHeight / 2 + anchorLineY,
        left: viewBox.left,
        width: viewBox.width,
        height: viewBox.height + nodeHeight
    });
    if (direction === "up") {
        let style = root.getAttribute('style');
        if (style && !style.endsWith(';'))
            style += ';';
        root.setAttribute('style', style + ` margin-top: ${-viewBox.top - nodeHeight}px;`);
    }
    if (direction === "down") {
        let style = root.getAttribute('style');
        if (style && !style.endsWith(';'))
            style += ';';
        root.setAttribute('style', style + ` margin-bottom: ${viewBox.height - rootBoundingBox.height + nodeHeight}px;`);
    }
    labelsOverlay.setAttribute('viewBox', `${viewBox.left} ${viewBox.top - nodeHeight / 2 + anchorLineY} ${viewBox.width} ${viewBox.height + nodeHeight / 2}`);
    nodes.forEach((node, idx) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        labels[idx].setAttribute('overflow', 'visible');
        labels[idx].setAttribute('x', `${node.x - node.dx / 2}`);
        labels[idx].setAttribute('width', `${node.dx}`);
        labels[idx].setAttribute('dy', `${node.dy}`);
        labels[idx].setAttribute('y', `${anchorLineY + node.y -
            (direction === 'up' ? boundingRects[idx].height - node.dy / 2 : node.dy / 4)}`);
        labels[idx].setAttribute('height', `${boundingRects[idx].height}`);
        if (direction == 'down')
            labels[idx].setAttribute('dominant-baseline', `hanging`);
        const rebasedPath = function (x, y) {
            let defaultPath = renderer.generatePath(node); // TODO: Generate own path to accommodate more range of offsets
            return `M${x} ${y} ` + defaultPath.slice(defaultPath.indexOf('C'));
        };
        let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let base = direction === 'up' ? anchorLineY - 4 : anchorLineY - rootBoundingBox.height + 4;
        let braceY = direction === 'up' ? base + 4 : base - 4;
        path.setAttribute('d', rebasedPath(node.data.symbolBoundingBox.center.horizontal + ((_b = (_a = labelInfo[idx].markerOffset) === null || _a === void 0 ? void 0 : _a.x) !== null && _b !== void 0 ? _b : 0), base + ((_d = (_c = labelInfo[idx].markerOffset) === null || _c === void 0 ? void 0 : _c.y) !== null && _d !== void 0 ? _d : 0)));
        path.setAttribute('transform', `translate(0, ${anchorLineY - node.dy / 4})`);
        Object.assign(path.style, { stroke: 'black', fill: 'none' });
        if (labelInfo[idx].labelMarker === 'extent') {
            let brace = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            brace.setAttribute('d', `M${node.data.symbolBoundingBox.left} ${braceY}
                V${base} H${node.data.symbolBoundingBox.right} V${braceY}`);
            brace.setAttribute('transform', `translate(${(_f = (_e = labelInfo[idx].markerOffset) === null || _e === void 0 ? void 0 : _e.x) !== null && _f !== void 0 ? _f : 0}, ${anchorLineY - node.dy / 4 + ((_h = (_g = labelInfo[idx].markerOffset) === null || _g === void 0 ? void 0 : _g.y) !== null && _h !== void 0 ? _h : 0)})`);
            Object.assign(brace.style, { stroke: 'black', fill: 'none' });
            labelsOverlay.appendChild(brace);
        }
        labelsOverlay.appendChild(path);
    });
}
function drawLabels(labels, root, scopeKey) {
    // need to make sure element is rendered to find the bounding box
    let visibility = (0, visibility_1.setVisible)(root);
    try {
        let rootBoundingBox = new boundingBox_1.BoundingBox(root.getBoundingClientRect());
        let labelInfo = labels.flatMap(({ selectorInfo, label, labelPosition, labelMarker, markerOffset }) => (0, ffl_1.toSelectorStrings)(selectorInfo, scopeKey).map((ss, idx) => ({
            selector: ss,
            classes: selectorInfo[idx].selectors.map(s => s.class),
            label, labelPosition, labelMarker, markerOffset
        }))).map(({ selector, classes, label, labelPosition, labelMarker, markerOffset }) => {
            var _a;
            let elements = groupByInstance([...root.querySelectorAll(selector).values()].filter(isVisible), classes)[0];
            console.log(elements);
            let labelElement = document.createElement('div');
            switch (label.renderType) {
                case "html":
                    labelElement.appendChild((0, dom_1.toHTMLElement)(label.value));
                    break;
                case "plain":
                default:
                    labelElement.appendChild(document.createTextNode(label.value));
                    break;
            }
            labelElement.classList.add("ffl-label");
            labelElement.classList.add("visible");
            return {
                symbolBoundingBox: elements !== undefined ? (_a = boundingBox_1.BoundingBox.of(...elements.map(node => new boundingBox_1.BoundingBox(node.getBoundingClientRect())))) === null || _a === void 0 ? void 0 : _a.relativeTo(rootBoundingBox) : undefined,
                labelElement, labelPosition, labelMarker, markerOffset
            };
        }).filter(info => info.symbolBoundingBox);
        let center = rootBoundingBox.relativeTo(rootBoundingBox).center;
        let [top, bottom] = (0, lodash_1.partition)(labelInfo, info => {
            var _a;
            return (info.labelPosition && info.labelPosition !== 'auto') ? info.labelPosition === 'above'
                : ((_a = info.symbolBoundingBox) === null || _a === void 0 ? void 0 : _a.center.vertical) <= center.vertical;
        });
        root.style.position = 'relative';
        if (bottom.length > 0)
            drawLabelGroup(bottom, root, rootBoundingBox, "down");
        if (top.length > 0)
            drawLabelGroup(top, root, rootBoundingBox, "up");
    }
    catch (e) {
        console.log(e);
        throw e;
    }
    finally {
        (0, visibility_1.resetVisibility)(root, visibility);
    }
}
exports.drawLabels = drawLabels;
function groupByStyleInstance(elements, styleClass) {
    var groups = [];
    elements.forEach(({ element, instanceIndices }) => instanceIndices.filter(([style, _]) => styleClass === style)
        .map(([_, idx]) => idx)
        .forEach(idx => { var _a; return ((_a = groups[idx]) !== null && _a !== void 0 ? _a : (groups[idx] = [])).push({ element, instanceIndices }); }));
    return Object.values(groups);
}
function groupByInstance(elements, classes) {
    let groups = [elements.map(element => ({
            element,
            instanceIndices: JSON.parse(element.getAttribute(ffl_1.INSTANCE_DATA_ATTR))
        }))];
    for (var cls of classes) {
        groups = groups.flatMap(e => groupByStyleInstance(e, cls));
    }
    return groups.map(g => g.map(({ element }) => element));
}
function isVisible(element) {
    return true;
    // return element.tagName === 'svg' || element.nodeType === Node.TEXT_NODE
    //     || [...element.children].some(e => isVisible(e));
}
function drawBackground(backgroundInfo, root, scopeKey) {
    // need to make sure element is rendered to find the bounding box
    let visibility = (0, visibility_1.setVisible)(root);
    try {
        let rootBoundingBox = new boundingBox_1.BoundingBox(root.getBoundingClientRect());
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
        backgroundInfo.flatMap(({ selectorInfo, backgroundColor }) => (0, ffl_1.toSelectorStrings)(selectorInfo, scopeKey).map((ss, idx) => ({
            selector: ss,
            classes: selectorInfo[idx].selectors.map(s => s.class),
            backgroundColor
        }))).forEach(({ selector, classes, backgroundColor }) => groupByInstance([...root.querySelectorAll(selector).values()].filter(isVisible), classes).map(group => {
            var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bgRect.setAttribute('stroke', 'none');
            bgRect.setAttribute('fill', backgroundColor);
            let bgRectDim = boundingBox_1.BoundingBox.of(...group.map(node => new boundingBox_1.BoundingBox(node.getBoundingClientRect()))).relativeTo(rootBoundingBox);
            bgRect.setAttribute('x', `${bgRectDim.left}`);
            bgRect.setAttribute('y', `${bgRectDim.top}`);
            bgRect.setAttribute('width', `${bgRectDim.width}`);
            bgRect.setAttribute('height', `${bgRectDim.height}`);
            return bgRect;
        }).forEach(bgRect => overlay.appendChild(bgRect)));
        root.prepend(overlay);
    }
    finally {
        (0, visibility_1.resetVisibility)(root, visibility);
    }
}
exports.drawBackground = drawBackground;
//# sourceMappingURL=overlay.js.map