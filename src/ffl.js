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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const reexport_1 = __importDefault(require("./reexport"));
const grammar = __importStar(require("./grammar"));
const lodash_1 = __importStar(require("lodash"));
const utils_1 = require("./utils");
const labella = __importStar(require("labella"));
const groupParser_1 = require("./groupParser");
const __fflPrefix = "\\ffl@";
const __fflMarkerCmd = "\\fflMarker";
function __fflMarker(s) { return `${__fflMarkerCmd}{${s}}`; }
;
// TODO: lift out shared constants
// TODO: this is inefficient, we need better representations
function __markMatches(src, matchers, wildcardSingle, wildcardAny) {
    var source = lodash_1.default.cloneDeep(src);
    var startStyles = {};
    var endStyles = {};
    let matchTableState = [];
    function __match(selector, target) {
        if ([target, wildcardSingle, wildcardAny].some(tok => selector === tok))
            return true;
        if (Array.isArray(selector) && Array.isArray(target)) {
            var matchState = [[...selector]]; // clones
            for (var i = 0; i < target.length; i++) {
                if (!(typeof target[i] === 'string' && (0, utils_1.__isWhitespace)(target[i]))) {
                    matchState.push(...matchState.filter(selector => selector[0] === wildcardAny)
                        .map(selector => selector.slice(1)));
                    matchState = [
                        ...matchState.filter(selector => __match(selector[0], target[i]))
                            .map(selector => selector.slice(1)),
                        ...matchState.filter(selector => selector[0] == wildcardAny)
                    ];
                }
            }
            return matchState.some(m => m.length == 0);
        }
        return false;
    }
    for (var idx = 0; idx < source.length; idx++) {
        var tok = source[idx];
        if (!(typeof tok === 'string' && (0, utils_1.__isWhitespace)(tok))) {
            matchTableState.push(...matchers, ...matchTableState.filter(matcher => matcher.matcher[0] === wildcardAny)
                .map(matcher => { return Object.assign(Object.assign({}, matcher), { matcher: matcher.matcher.slice(1) }); }));
            matchTableState = [
                ...matchTableState.filter(matcher => __match(matcher.matcher[0], tok))
                    .map(matcher => { return Object.assign(Object.assign({}, matcher), { matcher: matcher.matcher.slice(1) }); }),
                ...matchTableState.filter(matcher => matcher.matcher[0] === wildcardAny),
            ].map(matcher => {
                var _a;
                return Object.assign(Object.assign({}, matcher), { startIdx: (_a = matcher.startIdx) !== null && _a !== void 0 ? _a : idx });
            });
            matchTableState.filter(matcher => matcher.matcher.length == 0 && matcher.startIdx !== undefined)
                .forEach(matcher => {
                var _a, _b;
                var _c, _d;
                (_a = startStyles[_c = matcher.startIdx]) !== null && _a !== void 0 ? _a : (startStyles[_c] = []);
                startStyles[matcher.startIdx].push({
                    end: idx + 1,
                    style: matcher.key
                });
                (_b = endStyles[_d = idx + 1]) !== null && _b !== void 0 ? _b : (endStyles[_d] = []);
                endStyles[idx + 1].push({
                    start: matcher.startIdx,
                    style: matcher.key
                });
            });
        }
        if (Array.isArray(tok)) {
            source[idx] = __markMatches(tok, matchers, wildcardSingle, wildcardAny);
        }
    }
    /// mark style groupings
    var latexWithMarkers = [];
    for (var i = 0; i <= source.length; i++) {
        if (endStyles[i]) {
            latexWithMarkers.push(...endStyles[i]
                .map((e) => [e.start, e.style])
                .sort().reverse().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => __fflMarker(`endStyle{${val[1]}}`)));
        }
        if (startStyles[i]) {
            latexWithMarkers.push(...startStyles[i]
                .map((e) => [e.end, e.style])
                .sort().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => __fflMarker(`startStyle{${val[1]}}`)));
        }
        if (source[i])
            latexWithMarkers.push(source[i]);
    }
    // FIXME: if this is right after a macro we should insert {} but be mindful of _/^
    // How to distinguish macros with v.s. w/o argument
    return latexWithMarkers;
}
function overrideOptions(options) {
    options !== null && options !== void 0 ? options : (options = { macros: {} });
    return Object.assign(Object.assign({}, options), { throwOnError: false, macros: Object.assign(Object.assign({}, options.macros), { "\\ffl": (context) => {
                var _a, _b, _c, _d, _e, _f;
                // TODO: post-expansion matching
                // FIXME: this is too monolithic, refactoring needed
                var [fflTokens, latex] = context.consumeArgs(2);
                /// parse FFL, (hacky:) copy tokenized literal selectors
                // TODO: double check escape tokenization
                var fflString = "", fflLitSelectors = [], fflParse;
                var tok, litMode = false, litTokens = [];
                while (tok = fflTokens.pop()) {
                    if (tok.text == '$') {
                        litMode = !litMode; // this flipping is should be fine if ffl parses
                        if (litMode)
                            litTokens = [];
                        else
                            fflLitSelectors.push(litTokens);
                    }
                    else if (litMode) {
                        litTokens.push(tok);
                    }
                    fflString += tok.text;
                }
                try {
                    fflParse = grammar.parse(fflString, { startRule: "blocks" });
                }
                catch (error) {
                    // FIXME: error reporting doesn't always work
                    let grammarError = error;
                    return `\\texttt{\\textbackslash ffl\\{}{\\color{red}{
            \\verb!${fflString.slice(0, (_a = grammarError.location) === null || _a === void 0 ? void 0 : _a.start.offset)}!
            \\underbrace{\\verb!${fflString.slice((_b = grammarError.location) === null || _b === void 0 ? void 0 : _b.start.offset, (_c = grammarError.location) === null || _c === void 0 ? void 0 : _c.end.offset)}!}
            _{\\mathclap{\\text{${(_d = grammarError.location) === null || _d === void 0 ? void 0 : _d.start.line}:${(_e = grammarError.location) === null || _e === void 0 ? void 0 : _e.start.column}: 
              ${grammarError.message.replaceAll(/\\/g, "\\textbackslash ").replaceAll(/([&%$#_\{\}~])/g, "\\$&")}
            }}}\\verb!${fflString.slice((_f = grammarError.location) === null || _f === void 0 ? void 0 : _f.end.offset)}!
            }}{\\texttt{\\}\\{}${latex.reverse().map(tok => tok.text).join("")}\\texttt{\\}}}`;
                }
                // working with strings from now on, until we find a good way to implement katex's Token interface
                var __isOpenGroup = (tok) => tok == '{';
                var __isCloseGroup = (tok) => tok == '}';
                latex = (0, groupParser_1.__parseAtomics)(latex.reverse().map(tok => tok.text), __isOpenGroup, __isCloseGroup);
                fflLitSelectors = fflLitSelectors.map((selector, idx) => {
                    let selectorTexts = selector.map(tok => tok.text);
                    return {
                        key: `fflMatch${idx}-${selectorTexts.join("").replaceAll(/[^-_A-Za-z]/g, '_')}`,
                        matcher: (0, groupParser_1.__parseAtomics)(selectorTexts.filter(tok => !(0, utils_1.__isWhitespace)(tok)), __isOpenGroup, __isCloseGroup)
                    };
                });
                let latexWithMarkers = __markMatches(latex, fflLitSelectors, '\\?', '\\*');
                // TODO: flatten groups and mark classes
                function __deepFlattenAndMark(tokens) {
                    if (Array.isArray(tokens)) {
                        var ret = [];
                        for (var i = 0; i < tokens.length; i++) {
                            let tok = tokens[i];
                            switch (tok) {
                                case "^":
                                    ret.push(tok, '{', __fflMarker("startStyle{superscript}"), ...__deepFlattenAndMark(tokens[++i]), __fflMarker("endStyle{superscript}"), '}');
                                    break;
                                case "_":
                                    ret.push(tok, '{', __fflMarker("startStyle{subscript}"), ...__deepFlattenAndMark(tokens[++i]), __fflMarker("endStyle{subscript}"), '}');
                                    break;
                                case "\\frac":
                                    ret.push(tok, '{', __fflMarker("startStyle{numerator}"), ...__deepFlattenAndMark(tokens[++i]), __fflMarker("endStyle{numerator}"), '}');
                                    ret.push('{', __fflMarker("startStyle{denominator}"), ...__deepFlattenAndMark(tokens[++i]), __fflMarker("endStyle{denominator}"), '}');
                                    break;
                                default:
                                    if (Array.isArray(tok))
                                        ret.push('{', ...__deepFlattenAndMark(tok), '}');
                                    else
                                        ret.push(__deepFlattenAndMark(tok));
                            }
                        }
                        return ret;
                    }
                    else {
                        return tokens;
                    }
                }
                let _latexWithMarkers = __deepFlattenAndMark(latexWithMarkers);
                latexWithMarkers = Array.isArray(_latexWithMarkers) ? _latexWithMarkers : [_latexWithMarkers];
                // the inclusion of spaces as tokens is inconsistent,
                // we need additional spaces since we are concat'ing back to string
                for (var i = 1; i < latexWithMarkers.length; i++) {
                    let tok = latexWithMarkers[i - 1];
                    if (tok.startsWith('\\') && tok.charAt(tok.length - 1).match(/^[a-z0-9]+$/g)
                        && latexWithMarkers[i].charAt(0).match(/^[a-z0-9]+$/g)) {
                        latexWithMarkers.splice(i, 0, ' ');
                    }
                }
                /// register styles, CSS only for now
                let sectionId = self.crypto.randomUUID();
                // this below needs to get clean up (too many nested call backs)
                var labels = [];
                var idx = 0;
                let styleString = fflParse.map((styleBlock) => {
                    let classString = styleBlock.selectors.map((selectorGroups) => selectorGroups.map((singleSelector) => {
                        if (singleSelector.type == 'literal') {
                            return `.${fflLitSelectors[idx++].key}`;
                        }
                        if (singleSelector.type == 'class') {
                            return `.${singleSelector.str}`;
                        }
                    }).join('')).map((grpStr) => `.ffl-${sectionId} ${grpStr}.visible`).join(', ');
                    // preprocess labels here
                    return `${classString} {\n${Object.entries(styleBlock.attributes).map(([k, v]) => {
                        if (k == 'label') {
                            labels.push({
                                selector: classString,
                                labelText: v,
                            });
                            k = '--ffl-label';
                        }
                        return `${k}: ${Array.isArray(v) ? v.join(' ') : v};`;
                    }).join('\n')}\n}`;
                }).join('\n');
                return `{${__fflMarker(`startInvoc{${sectionId}}`)}${__fflMarker(`styleString{${styleString}}`)}
          ${labels.map(({ selector, labelText }) => __fflMarker(`label{${selector}}{${labelText}}`)).join('')}
          {${latexWithMarkers.join('')}}${__fflMarker(`endInvoc{${sectionId}}`)}}`;
            }, '\\fflMarker': (context) => {
                var arg = context.consumeArg();
                var tok = arg.start.range(arg.end, `${__fflPrefix}${arg.tokens.reverse().map((tok) => tok.text).join('').trim()}`);
                tok.noexpand = true;
                return { numArgs: 0, tokens: [tok], unexpandable: true };
            } }) });
}
function __getFFLMarker(node) {
    if (['mord', 'text'].every((name) => { var _a; return ((_a = node === null || node === void 0 ? void 0 : node.classes) !== null && _a !== void 0 ? _a : []).includes(name); })
        && node.children[0].text.startsWith(__fflPrefix)) {
        let ffl = node.children[0].text.replace(new RegExp(`^${__fflPrefix.replaceAll("\\", "\\\\")}`), "").trim();
        let argIdx = ffl.indexOf("{");
        return {
            command: ffl.slice(0, argIdx),
            arg: ffl.slice(argIdx + 1, -1), // all of our markers are assumed to have single arg and no surrounding space
            // more advanced parsing could be done here or in \fflMarker macro impl if this is not enough
            // label has two args but first arg is a CSS query string which does not have '}{'
        };
    }
    else {
        return undefined;
    }
}
function __asKaTeXVirtualNode(element) {
    return new Proxy(element, {
        get(target, prop, receiver) {
            switch (prop) {
                case "hasClass": return target.classList.contains;
                case "toNode": return () => target;
                case "toMarkup": return () => target.outerHTML;
            }
            return Reflect.get(target, prop, receiver);
        },
    });
}
// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function __transformKaTeXHTML(root, katexHtmlMain, classesState) {
    var _a, _b, _c, _d, _e, _f, _g;
    var _h;
    if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
        classesState !== null && classesState !== void 0 ? classesState : (classesState = []);
        if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
            katexHtmlMain.classes = [katexHtmlMain.classes];
        for (var i = 0; i <= ((_a = katexHtmlMain.children) !== null && _a !== void 0 ? _a : []).length; i++) {
            var childNode = ((_b = katexHtmlMain.children) !== null && _b !== void 0 ? _b : [])[i], ffl;
            if (ffl = __getFFLMarker(childNode)) {
                switch (ffl.command) {
                    case "startInvoc":
                        katexHtmlMain.classes.push(`ffl-${ffl.arg}`);
                        break;
                    case "styleString":
                        var style = document.createElement('style');
                        style.appendChild(document.createTextNode(ffl.arg.replaceAll('\xA0', '\x20')));
                        ((_c = root.children) !== null && _c !== void 0 ? _c : (root.children = [])).push(__asKaTeXVirtualNode(style));
                        break;
                    case "label": // no grouping for now
                        (_e = (_h = ((_d = root.ffl) !== null && _d !== void 0 ? _d : (root.ffl = []))).labels) !== null && _e !== void 0 ? _e : (_h.labels = []);
                        var labelArg = ffl.arg.replaceAll('\xA0', '\x20');
                        var delimIdx = labelArg.indexOf('}{'); // safe since first arg is a css query
                        root.ffl.labels.push({
                            selector: labelArg.slice(0, delimIdx),
                            label: labelArg.slice(delimIdx + 2)
                        });
                        break;
                    case "startStyle":
                        classesState.push(`${ffl.arg}`);
                        break;
                    case "endStyle":
                        classesState.splice(classesState.indexOf(ffl.arg), 1);
                        break;
                    case "endInvoc":
                        // nothing to do here since we are using the descendant combinator
                        break;
                }
                katexHtmlMain.children.splice(i--, 1);
            }
            else {
                __transformKaTeXHTML(root, childNode, classesState);
            }
        }
        ((_f = katexHtmlMain.classes) !== null && _f !== void 0 ? _f : (katexHtmlMain.classes = [])).push(...new Set(classesState));
        // FIXME: this condition might not be exhaustive, need better way to find "contentful" elements
        // the TODO above this function might be helpful. Worst case just remove the condition and label everything
        if (['mord', 'mbin', 'vlist', 'mspace', 'mopen', 'mclose', 'mpunct', 'mrel', 'mop']
            .some(cls => { var _a; return (_a = katexHtmlMain.classes) === null || _a === void 0 ? void 0 : _a.includes(cls); })) {
            ((_g = katexHtmlMain.classes) !== null && _g !== void 0 ? _g : (katexHtmlMain.classes = [])).push('visible');
        }
    }
}
function __renderToHTMLTree(expression, options) {
    var htmlTree = reexport_1.default.katex.__renderToHTMLTree(expression, overrideOptions(options));
    var katexHtmlMain = htmlTree.children.find((span) => span.classes.includes("katex-html"));
    __transformKaTeXHTML(htmlTree, katexHtmlMain);
    return htmlTree;
}
function draw(nodes, canvas) {
    nodes.forEach((node) => {
        node.data.labelText.setAttribute('x', `${node.x + node.dx / 2}`);
        node.data.labelText.setAttribute('dx', `${node.dx}`);
        node.data.labelText.setAttribute('y', `${node.y + node.dy / 2}`);
        node.data.labelText.setAttribute('dy', `${node.dy}`);
        canvas.appendChild(node.data.labelText);
    });
}
function __drawLabelGroup(labelInfo, root, rootBoundingBox, direction) {
    var labelsOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    labelInfo.forEach((nodeInfo) => labelsOverlay.appendChild(nodeInfo.labelText));
    root.prepend(labelsOverlay);
    let force = new labella.Force({
        minPos: null, nodeSpacing: 12
    }).nodes(labelInfo.map(info => new labella.Node(info.symbolBoundingBox.center.horizontal, info.labelText.getBBox().width, info))).compute();
    let nodes = force.nodes();
    let nodeHeight = 12;
    var renderer = new labella.Renderer({
        layerGap: 16,
        nodeHeight,
        direction
    });
    renderer.layout(nodes);
    var viewBox = utils_1.BoundingBox.of(...nodes.map((node, idx) => {
        let bBox = labelInfo[idx].labelText.getBBox();
        return new utils_1.BoundingBox({
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
    labelsOverlay.setAttribute('viewBox', `${viewBox.left} ${viewBox.top - nodeHeight / 2 + anchorLineY} ${viewBox.width} ${viewBox.height + nodeHeight / 2}`);
    nodes.forEach((node) => {
        node.data.labelText.setAttribute('x', `${node.x - node.dx / 2}`);
        node.data.labelText.setAttribute('width', `${node.dx}`);
        node.data.labelText.setAttribute('y', `${node.y}`);
        node.data.labelText.setAttribute('height', `${node.dy}`);
        node.data.labelText.setAttribute('dy', `${anchorLineY}`);
        if (direction == 'down')
            node.data.labelText.setAttribute('dominant-baseline', `hanging`);
        let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${node.data.symbolBoundingBox.center.horizontal} `
            + `${direction == "up" ? node.data.symbolBoundingBox.top : (node.data.symbolBoundingBox.bottom - anchorLineY)} L`
            + renderer.generatePath(node).slice(1));
        path.setAttribute('transform', `translate(0, ${anchorLineY - nodeHeight / 2})`);
        Object.assign(path.style, { stroke: 'black', fill: 'none' });
        labelsOverlay.appendChild(path);
    });
}
function __drawLabels(labels, root) {
    // need to make sure element is rendered to find the bounding box
    document.body.appendChild(root); // root is not guaranteed to be already in the tree, so we append our own first
    let visibility = (0, utils_1.__setVisible)(root);
    let rootBoundingBox = new utils_1.BoundingBox(root.getBoundingClientRect());
    let labelInfo = labels.map(({ selector, label }) => {
        var _a;
        let elements = [...root.querySelectorAll(selector)];
        let labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.textContent = label;
        return {
            symbolBoundingBox: (_a = utils_1.BoundingBox.of(...elements.map(node => new utils_1.BoundingBox(node.getBoundingClientRect())))) === null || _a === void 0 ? void 0 : _a.relativeTo(rootBoundingBox),
            labelText
        };
    }).filter(info => info.symbolBoundingBox);
    let center = rootBoundingBox.relativeTo(rootBoundingBox).center;
    let [bottom, top] = (0, lodash_1.partition)(labelInfo, info => { var _a; return ((_a = info.symbolBoundingBox) === null || _a === void 0 ? void 0 : _a.center.vertical) >= center.vertical; });
    root.style.position = 'relative';
    if (bottom)
        __drawLabelGroup(bottom, root, rootBoundingBox, "down");
    if (top)
        __drawLabelGroup(top, root, rootBoundingBox, "up");
    (0, utils_1.__resetVisibility)(root, visibility);
}
class ffl {
    static render(expression, baseNode, options) {
        var _a;
        let htmlTree = __renderToHTMLTree(expression, options);
        let htmlNode = htmlTree.toNode();
        if ((_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.labels)
            __drawLabels(htmlTree.ffl.labels, htmlNode);
        baseNode.textContent = "";
        baseNode.appendChild(htmlNode);
    }
    /**
     * no labeling support here until we backport it to plain HTML
     */
    static renderToString(expression, options) {
        var _a;
        let htmlTree = __renderToHTMLTree(expression, options);
        let htmlNode = htmlTree.toNode();
        if ((_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.labels)
            __drawLabels(htmlTree.ffl.labels, htmlNode);
        return htmlNode.outerHTML;
    }
}
exports.default = ffl;
