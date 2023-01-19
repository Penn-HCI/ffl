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
exports.INSTANCE_DATA_ATTR = exports.toSelectorStrings = void 0;
const katex_1 = __importDefault(require("katex"));
const lodash_1 = __importDefault(require("lodash"));
const grammar = __importStar(require("./language/grammar"));
const common_1 = require("./utils/common");
const groupParser_1 = require("./language/groupParser");
const uuid_1 = require("uuid");
const styleMarkers_1 = require("./language/styleMarkers");
const overlay_1 = require("./render/overlay");
const dom_1 = require("./utils/dom");
function __tryTokenize(selector, options) {
    let toks = [];
    try {
        katex_1.default.renderToString(`\\fflSelectorTokenizer{${selector}}`, Object.assign(Object.assign({}, options), { throwOnError: true, macros: Object.assign(Object.assign({}, options.macros), { "\\fflSelectorTokenizer": (context) => {
                    toks = context.consumeArg().tokens;
                    throw 'BREAK';
                } }) }));
    }
    catch (err) {
        if (err !== 'BREAK')
            throw err;
    }
    return toks.reverse();
}
function overrideOptions(options, fflParse) {
    var _a, _b;
    options !== null && options !== void 0 ? options : (options = { macros: {} });
    let fflLitSelectorsTokenized = [];
    for (const b of fflParse) {
        for (const ss of b.selectors)
            for (const s of ss) {
                if (s.type === "literal") {
                    fflLitSelectorsTokenized.push(__tryTokenize(s.str, options));
                }
            }
    }
    var isOpenGroup = (tok) => tok == '{';
    var isCloseGroup = (tok) => tok == '}';
    let sectionKey = (_b = (_a = options.ffl) === null || _a === void 0 ? void 0 : _a.sectionKey) !== null && _b !== void 0 ? _b : (0, uuid_1.v4)();
    return Object.assign(Object.assign({}, options), { throwOnError: false, macros: Object.assign(Object.assign({}, options.macros), { "\\ffl": (context) => {
                // TODO: post-expansion matching
                var latex = context.consumeArg().tokens;
                var fflLitSelectors = [...fflLitSelectorsTokenized];
                // working with strings from now on, until we find a good way to implement katex's Token interface
                latex = (0, groupParser_1.parseAtomics)(latex.reverse().map(tok => tok.text), isOpenGroup, isCloseGroup);
                fflLitSelectors = fflLitSelectors.map((selector, idx) => {
                    let selectorTexts = selector.map(tok => tok.text);
                    return {
                        key: `fflMatch${idx}-${selectorTexts.join("").replaceAll(/[^-_A-Za-z]/g, '_')}`,
                        matcher: (0, groupParser_1.parseAtomics)(selectorTexts.filter(tok => !(0, common_1.isWhitespace)(tok)), isOpenGroup, isCloseGroup)
                    };
                });
                let latexWithMarkers = (0, styleMarkers_1.markMatches)(latex, fflLitSelectors, '?', '*', {
                    '\\*': '*',
                    '\\?': '?'
                });
                // TODO: single-pass implementation rather than multi-pass
                latexWithMarkers = (0, styleMarkers_1.markDoubleGroups)(latexWithMarkers);
                latexWithMarkers = (0, styleMarkers_1.flatten)((0, styleMarkers_1.markConstants)((0, styleMarkers_1.markClasses)(latexWithMarkers)));
                // the inclusion of spaces as tokens is inconsistent,
                // we need additional spaces since we are concat'ing back to string
                for (var i = 1; i < latexWithMarkers.length; i++) {
                    let tok = latexWithMarkers[i - 1];
                    if (tok.startsWith('\\') && tok.charAt(tok.length - 1).match(/^[a-z0-9]+$/g)
                        && latexWithMarkers[i].charAt(0).match(/^[a-z0-9]+$/g)) {
                        latexWithMarkers.splice(i, 0, ' ');
                    }
                }
                var idx = 0;
                let style = fflParse.map((styleBlock) => ({
                    selectorGroups: styleBlock.selectors.map((selectorGroup) => {
                        let isGlobal = selectorGroup[0] === '*';
                        if (isGlobal)
                            selectorGroup.shift();
                        let selectorGroup_ = selectorGroup;
                        return {
                            isGlobal, selectors: selectorGroup_.map((singleSelector) => {
                                let clazz = undefined;
                                if (singleSelector.type === 'literal') {
                                    clazz = fflLitSelectors[idx++].key;
                                }
                                if (singleSelector.type === 'class') {
                                    let className = singleSelector.str;
                                    switch (className) {
                                        case 'operator':
                                            className = 'mbin';
                                            break;
                                        case 'group':
                                            className = 'ffl-group';
                                            break;
                                        default: break;
                                    }
                                    clazz = className;
                                }
                                return {
                                    class: clazz,
                                    pseudoSelectors: singleSelector.pseudoSelectors
                                };
                            })
                        };
                    }),
                    properties: styleBlock.properties
                }));
                return `{${(0, styleMarkers_1.fflMarker)("startInvoc", sectionKey)}${(0, styleMarkers_1.fflMarker)("style", JSON.stringify(style))}
          {${latexWithMarkers.join('')}}${(0, styleMarkers_1.fflMarker)("endInvoc", sectionKey)}}`;
            }, '\\fflMarker': (context) => {
                var arg = context.consumeArg();
                var tok = arg.start.range(arg.end, `${styleMarkers_1.fflPrefix}${arg.tokens.reverse().map((tok) => tok.text).join('').trim()}`);
                tok.noexpand = true;
                return { numArgs: 0, tokens: [tok], unexpandable: true };
            } }) });
}
const toSelectorStrings = (selectorGroups, scopeKey) => selectorGroups.map(({ isGlobal, selectors }) => `${isGlobal ? "*" : `.ffl-${scopeKey} `}${selectors.map((selector) => `.${selector.class}${selector.pseudoSelectors.map((ps) => {
    switch (ps.class) {
        case "nth":
            return `[${exports.INSTANCE_DATA_ATTR}*=${CSS.escape(JSON.stringify([selector.class, ps.arg]))}]`;
        default:
            return '';
    }
}).join('')}`).join('')}`);
exports.toSelectorStrings = toSelectorStrings;
// from intermediate representation where selectors are replaces with CSS classes
// to a fake style node in KaTeX's representation of the document tree
const toCSS = (translatedStyles, scopeKey) => (0, dom_1.toKaTeXVirtualNode)(`<style> ${translatedStyles.map((block) => `
${(0, exports.toSelectorStrings)(block.selectorGroups, scopeKey).join(', ')} {
  ${Object.entries(block.properties).map(([k, v]) => {
    var _a, _b;
    switch (k) {
        case 'label':
            k = '--ffl-label';
            v = `${(_a = v.renderType) !== null && _a !== void 0 ? _a : ''}("${(_b = v.value) !== null && _b !== void 0 ? _b : ''}")`;
            break;
        case 'label-position':
            k = '--ffl-label-position';
            break;
        case 'label-marker':
            k = '--ffl-label-marker';
            break;
        case 'label-marker-offset-x':
            k = '--ffl-label-marker-offset-x';
            break;
        case 'label-marker-offset-y':
            k = '--ffl-label-marker-offset-y';
            break;
        case 'background-color':
            k = '--ffl-background-color';
            break;
    }
    return `${k}: ${v};`;
}).join('\n')}
}`).join('\n')} </style>`);
exports.INSTANCE_DATA_ATTR = "data-ffl-class-instances";
// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function transformKaTeXHTML(root, katexHtmlMain, classesState) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    let invocId;
    if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
        classesState !== null && classesState !== void 0 ? classesState : (classesState = []);
        if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
            katexHtmlMain.classes = [katexHtmlMain.classes];
        for (var i = 0; i < ((_a = katexHtmlMain.children) !== null && _a !== void 0 ? _a : []).length; i++) {
            var childNode = ((_b = katexHtmlMain.children) !== null && _b !== void 0 ? _b : [])[i], ffl;
            if (ffl = (0, styleMarkers_1.getFFLMarker)(childNode)) {
                switch (ffl.command) {
                    case "startInvoc":
                        invocId = ffl.arg;
                        ((_c = root.ffl) !== null && _c !== void 0 ? _c : (root.ffl = {})).invocId = invocId;
                        katexHtmlMain.classes.push(`ffl-${invocId}`);
                        root.classes.push(`ffl-${invocId}`);
                        break;
                    case "style":
                        let style = JSON.parse(ffl.arg.replaceAll('\xA0', '\x20'));
                        ((_d = root.children) !== null && _d !== void 0 ? _d : (root.children = [])).push(toCSS(style, (_f = (_e = root === null || root === void 0 ? void 0 : root.ffl) === null || _e === void 0 ? void 0 : _e.invocId) !== null && _f !== void 0 ? _f : 'global'));
                        ((_g = root.ffl) !== null && _g !== void 0 ? _g : (root.ffl = {})).labels = [];
                        root.ffl.backgroundColors = [];
                        style.forEach(block => {
                            var _a, _b;
                            let label = block.properties['label'];
                            let labelPosition = block.properties['label-position'];
                            let labelMarker = block.properties['label-marker'];
                            let markerOffsetX = block.properties['label-marker-offset-x'];
                            let markerOffsetY = block.properties['label-marker-offset-y'];
                            const parsePx = (s) => {
                                let s_ = (s !== null && s !== void 0 ? s : "").trim();
                                let f = parseFloat(s_.toLowerCase().endsWith('px')
                                    ? s_.slice(0, s_.length - 2).trimEnd() : s_);
                                return (f && !isNaN(f)) ? f : 0;
                            };
                            if (label) {
                                root.ffl.labels.push({
                                    selectorInfo: block.selectorGroups,
                                    label, labelPosition, labelMarker,
                                    markerOffset: {
                                        x: (_a = parsePx(markerOffsetX)) !== null && _a !== void 0 ? _a : 0,
                                        y: (_b = parsePx(markerOffsetY)) !== null && _b !== void 0 ? _b : 0
                                    }
                                });
                            }
                            let backgroundColor = block.properties['background-color'];
                            if (backgroundColor) {
                                root.ffl.backgroundColors.push({
                                    selectorInfo: block.selectorGroups,
                                    backgroundColor: backgroundColor
                                });
                            }
                        });
                        break;
                    case "startStyle":
                        classesState.push(ffl.arg.split('}{'));
                        break;
                    case "endStyle":
                        classesState.splice(classesState.indexOf(ffl.arg.split('}{')), 1);
                        break;
                    case "endInvoc":
                        // nothing to do here since we are using the descendant combinator
                        break;
                }
                katexHtmlMain.children.splice(i--, 1);
            }
            else {
                let id = transformKaTeXHTML(root, childNode, classesState);
                if (!invocId)
                    invocId = id;
            }
        }
        if (classesState.length > 0) {
            ((_h = katexHtmlMain.classes) !== null && _h !== void 0 ? _h : (katexHtmlMain.classes = [])).push(...new Set(classesState.map(c => c[0])));
            if (['mord', 'mbin', 'vlist', 'mspace', 'mopen', 'mclose', 'mpunct', 'mrel', 'mop']
                .some(cls => { var _a; return (_a = katexHtmlMain.classes) === null || _a === void 0 ? void 0 : _a.includes(cls); })) {
                ((_j = katexHtmlMain.classes) !== null && _j !== void 0 ? _j : (katexHtmlMain.classes = [])).push('visible');
            }
            if (katexHtmlMain.setAttribute) {
                katexHtmlMain.setAttribute(exports.INSTANCE_DATA_ATTR, JSON.stringify(classesState));
            }
            else {
                let _toNode = katexHtmlMain.toNode;
                katexHtmlMain.toNode = () => {
                    let node = _toNode.call(katexHtmlMain, "span");
                    node.setAttribute(exports.INSTANCE_DATA_ATTR, JSON.stringify(classesState));
                    return node;
                };
                let _toMarkup = katexHtmlMain.toMarkup;
                let _classesState = lodash_1.default.escape(JSON.stringify(classesState));
                katexHtmlMain.toMarkup = () => _toMarkup.call(katexHtmlMain, "span").replace(/(?<!\\)>/, ` ${exports.INSTANCE_DATA_ATTR}="${_classesState}">`);
            }
        }
    }
    return invocId;
}
function findKatexHTMLRoot(htmlTree) {
    var _a;
    return (_a = htmlTree.children.find((span) => span.classes.includes("katex-html"))) !== null && _a !== void 0 ? _a : htmlTree.children.map(findKatexHTMLRoot).find((e) => e);
}
function renderToHTMLTree(ffl, expression, options) {
    var _a;
    let __renderToHTMLTree = (_a = window.renderToHTMLTree) !== null && _a !== void 0 ? _a : katex_1.default.__renderToHTMLTree;
    try {
        __renderToHTMLTree(expression, Object.assign(Object.assign({}, options), { throwOnError: true }));
    }
    catch (err) {
        if (options === null || options === void 0 ? void 0 : options.throwOnError) {
            throw err;
        }
        else {
            return __renderToHTMLTree(expression, options !== null && options !== void 0 ? options : {});
        }
    }
    var parsedFFL = grammar.parse(ffl, { startRule: "blocks" });
    var htmlTree = __renderToHTMLTree(`\\ffl{${expression}}`, overrideOptions(options, parsedFFL));
    var katexHtmlMain = findKatexHTMLRoot(htmlTree);
    transformKaTeXHTML(htmlTree, katexHtmlMain);
    htmlTree.style.display = 'inline-block';
    return htmlTree;
}
function drawOverlays(root, scopeKey, labels, backgroundInfo, options) {
    if (!(0, common_1.isServer)()) {
        if (backgroundInfo)
            (0, overlay_1.drawBackground)(backgroundInfo, root, scopeKey);
        if (labels && (options === null || options === void 0 ? void 0 : options.displayMode))
            (0, overlay_1.drawLabels)(labels, root, scopeKey);
    }
}
/**
 * labels are only supported when running on browser client
 * TODO: disable labels for inline?
 */
class ffl {
    static render(latex, ffl, baseNode, options) {
        var _a, _b, _c;
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        let htmlNode = htmlTree.toNode();
        drawOverlays(htmlNode, (_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.invocId, (_b = htmlTree.ffl) === null || _b === void 0 ? void 0 : _b.labels, (_c = htmlTree.ffl) === null || _c === void 0 ? void 0 : _c.backgroundColors, options);
        baseNode.textContent = "";
        baseNode.appendChild(htmlNode);
    }
    static renderToString(latex, ffl, options) {
        var _a, _b, _c;
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        if (!(0, common_1.isServer)()) {
            let htmlNode;
            try {
                htmlNode = (0, dom_1.toHTMLElement)(htmlTree.toMarkup());
                drawOverlays(htmlNode, (_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.invocId, (_b = htmlTree.ffl) === null || _b === void 0 ? void 0 : _b.labels, (_c = htmlTree.ffl) === null || _c === void 0 ? void 0 : _c.backgroundColors, options);
                var htmlStr = htmlNode.outerHTML;
            }
            finally {
                if (htmlNode)
                    htmlNode.remove();
            }
            return htmlStr;
        }
        else {
            return htmlTree.toMarkup();
        }
    }
    // can be used to pre-validate
    static parseFFL(ffl) {
        return grammar.parse(ffl, { startRule: "blocks" });
    }
}
exports.default = ffl;
//# sourceMappingURL=ffl.js.map