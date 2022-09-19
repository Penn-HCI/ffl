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
const __fflPrefix = "\\ffl@";
// TODO: lift out shared constants
function overrideOptions(options) {
    options ??= { macros: {} };
    return {
        ...options,
        throwOnError: false,
        macros: {
            ...options.macros, "\\ffl": (context) => {
                // TODO: post-expansion matching
                // FIXME: this is too monolithic, refactoring needed
                var [fflTokens, latex] = context.consumeArgs(2);
                /// parse FFL, (hacky:) copy tokenized literal selectors
                // TODO: double check escape tokenization
                var fflString = "", fflLitSelectors = [], fflParse;
                var tok, litMode = false, litTokens = [];
                while (tok = fflTokens.pop()) {
                    if (tok.text == '$') {
                        litMode = !litMode;
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
            \\verb!${fflString.slice(0, grammarError.location?.start.offset)}!
            \\underbrace{\\verb!${fflString.slice(grammarError.location?.start.offset, grammarError.location?.end.offset)}!}
            _{\\mathclap{\\text{${grammarError.location?.start.line}:${grammarError.location?.start.column}: 
              ${grammarError.message.replaceAll(/\\/g, "\\textbackslash ").replaceAll(/([&%$#_\{\}~])/g, "\\$&")}
            }}}\\verb!${fflString.slice(grammarError.location?.end.offset)}!
            }}{\\texttt{\\}\\{}${latex.reverse().map(tok => tok.text).join("")}\\texttt{\\}}}`;
                }
                /// convert literal selectors to token state maps, removing spaces
                fflLitSelectors = fflLitSelectors.map(sel => sel.map((tok) => tok.text).filter((txt) => !(0, utils_1.__isWhitespace)(txt)));
                function __collapse(arr) {
                    return lodash_1.default.mapValues((0, utils_1.__mapGroup)(arr, ent => ent[1][0] ?? '\0', ent => [ent[0], ent[1].slice(1)]), (grp, key, _o) => key != '\0' ? __collapse(grp) : grp.map((idx) => idx[0]));
                }
                let fflLitSelectorsMap = __collapse(Object.entries(fflLitSelectors));
                /// mark all matches for literal selectors
                var startStyles = [];
                var endStyles = [];
                var fflLitSelectorsClassNames = fflLitSelectors.map((val) => val.join("").replaceAll(/[^-_A-Za-z]/g, '_'));
                latex = latex.reverse(); // can't use pop since we are doing 2 loops
                // TODO: revert to using the array/set format instead of state map, maybe could be less than n^2
                // prereq: evaluate if it is actually faster than merges
                for (var start = 0; start < latex.length; start++) {
                    let remainingMatchTable = fflLitSelectorsMap;
                    for (var cur = start; cur < latex.length; cur++) {
                        var tok = latex[cur].text;
                        if (!(0, utils_1.__isWhitespace)(tok)) {
                            // note that we do not remove whitespaces in the LaTeX string only skip them in case of useful ones
                            if (!(Object.hasOwn(remainingMatchTable, tok)
                                || Object.hasOwn(remainingMatchTable, '\\?')
                                || Object.hasOwn(remainingMatchTable, '\\*'))) {
                                break;
                            }
                            else {
                                // TODO: handle escapes ('\$')
                                // FIXME: wildcard '\*' still has weird behaviors
                                const __merge_cont_style = function (map, arr) {
                                    return arr ? { ...Object.assign({}, map), '\0': arr } : map;
                                };
                                const __merge_style_arrs = function (arr1, arr2) {
                                    if (!arr1)
                                        arr1 = [];
                                    if (!Array.isArray(arr1))
                                        arr1 = [arr1];
                                    return arr1.concat(arr2);
                                };
                                // merging all possible states after wildcard
                                var newRemainingMatchTable = (0, utils_1.__merge)({}, remainingMatchTable[tok], __merge_cont_style, __merge_style_arrs);
                                (0, utils_1.__merge)(newRemainingMatchTable, remainingMatchTable['\\?'] ?? {}, __merge_cont_style, __merge_style_arrs);
                                // FIXME: \? should not match empty selection
                                if (remainingMatchTable['\\*']) {
                                    newRemainingMatchTable =
                                        (0, utils_1.__merge)(newRemainingMatchTable, remainingMatchTable['\\*'] ?? {}, __merge_cont_style, __merge_style_arrs);
                                    newRemainingMatchTable =
                                        (0, utils_1.__merge)(newRemainingMatchTable, { '\\*': remainingMatchTable['\\*'] }, __merge_cont_style, __merge_style_arrs);
                                }
                                remainingMatchTable = newRemainingMatchTable;
                                if (Object.hasOwn(remainingMatchTable, '\0')) {
                                    startStyles[start] ??= [];
                                    startStyles[start].push({
                                        end: cur + 1,
                                        styles: remainingMatchTable['\0'].map((idx) => `fflMatch${idx}-${fflLitSelectorsClassNames[idx]}`)
                                    });
                                    endStyles[cur + 1] ??= [];
                                    endStyles[cur + 1].push({
                                        start: start,
                                        styles: remainingMatchTable['\0'].map((idx) => `fflMatch${idx}-${fflLitSelectorsClassNames[idx]}`)
                                    });
                                }
                            }
                        }
                    }
                }
                /// mark style groupings
                var latexWithMarkers = [];
                for (var i = 0; i <= latex.length; i++) {
                    if (endStyles[i]) {
                        latexWithMarkers.push(...endStyles[i]
                            .flatMap((e) => e.styles.map((sty, idx, arr) => [e.start, sty]))
                            .sort().reverse().filter((v, i, a) => a.indexOf(v) === i)
                            .map((val) => `\\fflMarker{endStyle{${val[1]}}}`));
                    }
                    if (startStyles[i]) {
                        latexWithMarkers.push(...startStyles[i]
                            .flatMap((e) => e.styles.map((sty, idx, arr) => [e.end, sty]))
                            .sort().filter((v, i, a) => a.indexOf(v) === i)
                            .map((val) => `\\fflMarker{startStyle{${val[1]}}}`));
                    }
                    latexWithMarkers.push(latex[i]?.text ?? '');
                }
                /// fix groupings at markers after _/^, add markers for special classes
                function __markGroups(idx, clazz) {
                    let isGroup = latexWithMarkers[idx] == '{';
                    if (!isGroup)
                        latexWithMarkers.splice(idx, 0, "{");
                    latexWithMarkers.splice(++idx, 0, `\\fflMarker{startStyle{${clazz}}}`);
                    while (latexWithMarkers[idx].startsWith("\\fflMarker"))
                        idx++;
                    if (isGroup) {
                        let openGroups = 0;
                        while (openGroups >= 0 && idx < latexWithMarkers.length) {
                            let clazz = latexWithMarkers[idx] == '^' ? "superscript"
                                : latexWithMarkers[idx] == '_' ? "subscript"
                                    : latexWithMarkers[idx] == '\\frac' ? "frac"
                                        : undefined;
                            if (clazz) {
                                let endGroup = __markGroups(idx + 1, clazz == "frac" ? "numerator" : clazz);
                                if (clazz == "frac")
                                    endGroup = __markGroups(endGroup, "denominator");
                                idx = endGroup;
                            }
                            else {
                                idx++;
                            }
                            switch (latexWithMarkers[idx]) {
                                case '{':
                                    openGroups++;
                                    break;
                                case '}':
                                    openGroups--;
                                    break;
                            }
                        }
                    }
                    else {
                        while (latexWithMarkers[++idx].startsWith("\\fflMarker{endStyle"))
                            ;
                    }
                    latexWithMarkers.splice(idx++, 0, `\\fflMarker{endStyle{${clazz}}}`);
                    if (!isGroup)
                        latexWithMarkers.splice(idx, 0, "}");
                    return idx + 1;
                }
                for (var i = 0; i < latexWithMarkers.length; i++) {
                    let clazz = latexWithMarkers[i] == '^' ? "superscript"
                        : latexWithMarkers[i] == '_' ? "subscript"
                            : latexWithMarkers[i] == '\\frac' ? "frac"
                                : undefined;
                    if (clazz) {
                        i = __markGroups(i + 1, clazz == "frac" ? "numerator" : clazz);
                        if (clazz == "frac")
                            i = __markGroups(i, "denominator");
                    }
                }
                // the inclusion of spaces as tokens is inconsistent
                for (var i = 1; i < latexWithMarkers.length; i++) {
                    let tok = latexWithMarkers[i - 1];
                    if (tok.startsWith('\\') && tok.charAt(tok.length - 1).match(/^[a-z0-9]+$/g)
                        && latexWithMarkers[i].charAt(0).match(/^[a-z0-9]+$/g)) {
                        latexWithMarkers.splice(i, 0, ' ');
                    }
                }
                /// register styles, CSS only for now
                let sectionId = self.crypto.randomUUID();
                // TODO: rewrite this line & block below to use class fflLitSelectors directly
                let fflLitSelectorsRevMap = Object.fromEntries(Object.entries(fflLitSelectors).map(val => [val[1].join(''), val[0]]));
                // this below needs to get clean up (too many nested call backs)
                var labels = [];
                let styleString = fflParse.map((styleBlock) => {
                    let classString = styleBlock.selectors.map((selectorGroups) => selectorGroups.map((singleSelector) => {
                        if (singleSelector.type == 'literal') {
                            let idx = fflLitSelectorsRevMap[singleSelector.str.replaceAll(/[ \t\r\n\v\f]/g, '')];
                            return `.fflMatch${idx}-${fflLitSelectorsClassNames[idx]}`;
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
                return `{\\fflMarker{startInvoc{${sectionId}}}\\fflMarker{styleString{${styleString}}}
          ${labels.map(({ selector, labelText }) => `\\fflMarker{label{${selector}}{${labelText}}}`).join('')}
          {${latexWithMarkers.join('')}}\\fflMarker{endInvoc{${sectionId}}}}`;
            },
            '\\fflMarker': (context) => {
                var arg = context.consumeArg();
                var tok = arg.start.range(arg.end, `${__fflPrefix}${arg.tokens.reverse().map((tok) => tok.text).join('').trim()}`);
                tok.noexpand = true;
                return { numArgs: 0, tokens: [tok], unexpandable: true };
            }
        }
    };
}
function __getFFLMarker(node) {
    if (['mord', 'text'].every((name) => (node?.classes ?? []).includes(name))
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
// TODO: figure out how to use the reexported types, maybe use an actual .d.ts file instead of reexport
function __transformKaTeXHTML(root, katexHtmlMain, classesState) {
    if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
        classesState ??= [];
        if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
            katexHtmlMain.classes = [katexHtmlMain.classes];
        for (var i = 0; i <= (katexHtmlMain.children ?? []).length; i++) {
            var childNode = (katexHtmlMain.children ?? [])[i], ffl;
            if (ffl = __getFFLMarker(childNode)) {
                switch (ffl.command) {
                    case "startInvoc":
                        katexHtmlMain.classes.push(`ffl-${ffl.arg}`);
                        break;
                    case "styleString":
                        var style = document.createElement('style');
                        style.appendChild(document.createTextNode(ffl.arg.replaceAll('\xA0', '\x20')));
                        (root.children ??= []).push(__asKaTeXVirtualNode(style));
                        break;
                    case "label": // no grouping for now
                        (root.ffl ??= []).labels ??= [];
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
        (katexHtmlMain.classes ??= []).push(...new Set(classesState));
        // FIXME: this condition might not be exhaustive, need better way to find "contentful" elements
        // the TODO above this function might be helpful. Worst case just remove the condition and label everything
        if (['mord', 'mbin', 'vlist', 'mspace', 'mopen', 'mclose', 'mpunct', 'mrel', 'mop']
            .some(cls => katexHtmlMain.classes?.includes(cls))) {
            (katexHtmlMain.classes ??= []).push('visible');
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
        let elements = [...root.querySelectorAll(selector)];
        let labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.textContent = label;
        return {
            symbolBoundingBox: utils_1.BoundingBox.of(...elements.map(node => new utils_1.BoundingBox(node.getBoundingClientRect())))?.relativeTo(rootBoundingBox),
            labelText
        };
    }).filter(info => info.symbolBoundingBox);
    let center = rootBoundingBox.relativeTo(rootBoundingBox).center;
    let [bottom, top] = (0, lodash_1.partition)(labelInfo, info => info.symbolBoundingBox?.center.vertical >= center.vertical);
    root.style.position = 'relative';
    if (bottom)
        __drawLabelGroup(bottom, root, rootBoundingBox, "down");
    if (top)
        __drawLabelGroup(top, root, rootBoundingBox, "up");
    (0, utils_1.__resetVisibility)(root, visibility);
}
class ffl {
    static render(expression, baseNode, options) {
        let htmlTree = __renderToHTMLTree(expression, options);
        let htmlNode = htmlTree.toNode();
        if (htmlTree.ffl?.labels)
            __drawLabels(htmlTree.ffl.labels, htmlNode);
        baseNode.textContent = "";
        baseNode.appendChild(htmlNode);
    }
    /**
     * no labeling support here until we backport it to plain HTML
     */
    static renderToString(expression, options) {
        return __renderToHTMLTree(expression, options).toMarkup();
    }
}
exports.default = ffl;
