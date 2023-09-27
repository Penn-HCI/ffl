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
        katex_1.default.renderToString(`\\fflSelectorTokenizer{${selector}}`, {
            ...options,
            throwOnError: true,
            macros: {
                ...options.macros,
                "\\fflSelectorTokenizer": (context) => {
                    toks = context.consumeArg().tokens;
                    throw 'BREAK';
                }
            }
        });
    }
    catch (err) {
        if (err !== 'BREAK')
            throw err;
    }
    return toks.reverse();
}
function overrideOptions(options, fflParse) {
    options ??= { macros: {} };
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
    let sectionKey = options.ffl?.sectionKey ?? (0, uuid_1.v4)();
    return {
        ...options,
        throwOnError: false,
        macros: {
            ...options.macros, "\\ffl": (context) => {
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
                    if (tok.startsWith('\\') && tok.charAt(tok.length - 1).match(/[A-Za-z0-9]+$/g)
                        && latexWithMarkers[i].charAt(0).match(/^[A-Za-z0-9]+/g)) {
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
            },
            '\\fflMarker': (context) => {
                var arg = context.consumeArg();
                var tok = arg.start.range(arg.end, `${styleMarkers_1.fflPrefix}${arg.tokens.reverse().map((tok) => tok.text).join('').trim()}`);
                tok.noexpand = true;
                return { numArgs: 0, tokens: [tok], unexpandable: true };
            }
        }
    };
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
    switch (k) {
        case 'label':
            k = '--ffl-label';
            v = `${v.renderType ?? ''}("${v.value ?? ''}")`;
            break;
        case 'border':
        case 'label-position':
        case 'label-marker':
        case 'label-marker-offset-x':
        case 'label-marker-offset-y':
        case 'background-color':
            k = '--ffl-' + k;
            break;
    }
    return `  ${k}: ${v};`;
}).join('\n')}
}`).join('\n')} </style>`);
exports.INSTANCE_DATA_ATTR = "data-ffl-class-instances";
// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function transformKaTeXHTML(root, katexHtmlMain, classesState) {
    let invocId;
    if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
        classesState ??= [];
        if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
            katexHtmlMain.classes = [katexHtmlMain.classes];
        for (var i = 0; i < (katexHtmlMain.children ?? []).length; i++) {
            var childNode = (katexHtmlMain.children ?? [])[i], ffl;
            if (ffl = (0, styleMarkers_1.getFFLMarker)(childNode)) {
                switch (ffl.command) {
                    case "startInvoc":
                        invocId = ffl.arg;
                        (root.ffl ??= {}).invocId = invocId;
                        katexHtmlMain.classes.push(`ffl-${invocId}`);
                        root.classes.push(`ffl-${invocId}`);
                        break;
                    case "style":
                        let style = JSON.parse(ffl.arg.replaceAll('\xA0', '\x20'));
                        (root.children ??= []).push(toCSS(style, root?.ffl?.invocId ?? 'global'));
                        (root.ffl ??= {}).labels = [];
                        root.ffl.backgroundColors ??= [];
                        root.ffl.borders ??= [];
                        style.forEach(block => {
                            let label = block.properties['label'];
                            let labelPosition = block.properties['label-position'];
                            let labelMarker = block.properties['label-marker'];
                            let markerOffsetX = block.properties['label-marker-offset-x'];
                            let markerOffsetY = block.properties['label-marker-offset-y'];
                            const parsePx = (s) => {
                                let s_ = (s ?? "").trim();
                                let f = parseFloat(s_.toLowerCase().endsWith('px')
                                    ? s_.slice(0, s_.length - 2).trimEnd() : s_);
                                return (f && !isNaN(f)) ? f : 0;
                            };
                            if (label) {
                                root.ffl.labels.push({
                                    selectorInfo: block.selectorGroups,
                                    label, labelPosition, labelMarker,
                                    markerOffset: {
                                        x: parsePx(markerOffsetX) ?? 0,
                                        y: parsePx(markerOffsetY) ?? 0
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
                            let border = block.properties['border'];
                            if (border) {
                                root.ffl.borders.push({
                                    selectorInfo: block.selectorGroups,
                                    border: border
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
            (katexHtmlMain.classes ??= []).push(...new Set(classesState.map(c => c[0])));
            if (['mord', 'mbin', 'vlist', 'mspace', 'mopen', 'mclose', 'mpunct', 'mrel', 'mop']
                .some(cls => katexHtmlMain.classes?.includes(cls))) {
                (katexHtmlMain.classes ??= []).push('visible');
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
    return htmlTree.children.find((span) => span.classes.includes("katex-html"))
        ?? htmlTree.children.map(findKatexHTMLRoot).find((e) => e);
}
function renderToHTMLTree(ffl, expression, options) {
    let __renderToHTMLTree = window.renderToHTMLTree ?? katex_1.default.__renderToHTMLTree;
    try {
        __renderToHTMLTree(expression, { ...options, throwOnError: true });
    }
    catch (err) {
        if (options?.throwOnError) {
            throw err;
        }
        else {
            return __renderToHTMLTree(expression, options ?? {});
        }
    }
    var parsedFFL = grammar.parse(ffl, { startRule: "blocks" });
    var htmlTree = __renderToHTMLTree(`\\ffl{${expression}}`, overrideOptions(options, parsedFFL));
    var katexHtmlMain = findKatexHTMLRoot(htmlTree);
    transformKaTeXHTML(htmlTree, katexHtmlMain);
    htmlTree.style.display = 'inline-block';
    return htmlTree;
}
function drawOverlays(root, scopeKey, labels, backgroundInfo, borderInfo, options) {
    if (!(0, common_1.isServer)()) {
        if (borderInfo)
            (0, overlay_1.drawBorders)(borderInfo, root, scopeKey);
        if (backgroundInfo)
            (0, overlay_1.drawBackground)(backgroundInfo, root, scopeKey);
        if (labels && options?.displayMode)
            (0, overlay_1.drawLabels)(labels, root, scopeKey);
    }
}
/**
 * labels are only supported when running on browser client
 * TODO: disable labels for inline?
 */
class ffl {
    static render(latex, ffl, baseNode, options) {
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        let htmlNode = htmlTree.toNode();
        drawOverlays(htmlNode, htmlTree.ffl?.invocId, htmlTree.ffl?.labels, htmlTree.ffl?.backgroundColors, htmlTree.ffl?.borders, options);
        baseNode.textContent = "";
        baseNode.appendChild(htmlNode);
    }
    static renderToString(latex, ffl, options) {
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        if (!(0, common_1.isServer)()) {
            let htmlNode;
            try {
                htmlNode = (0, dom_1.toHTMLElement)(htmlTree.toMarkup());
                drawOverlays(htmlNode, htmlTree.ffl?.invocId, htmlTree.ffl?.labels, htmlTree.ffl?.backgroundColors, htmlTree.ffl?.borders, options);
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