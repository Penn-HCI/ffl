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
exports.INSTANCE_DATA_ATTR = void 0;
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
                // FIXME: this is too monolithic, refactoring needed
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
                    selectorString: styleBlock.selectors.map((selectorGroups) => selectorGroups.map((singleSelector) => {
                        if (singleSelector.type === 'literal') {
                            return `.${fflLitSelectors[idx++].key}`;
                        }
                        if (singleSelector.type === 'class') {
                            let className = singleSelector.str;
                            switch (className) {
                                case 'operator':
                                    className = 'mbin';
                                    break;
                                default: break;
                            }
                            return `.${className}`;
                        }
                    }).join('')).map((grpStr) => `.ffl-${sectionKey} ${grpStr}.visible`).join(', '),
                    properties: styleBlock.attributes
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
exports.INSTANCE_DATA_ATTR = "data-ffl-class-instances";
// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function transformKaTeXHTML(root, katexHtmlMain, classesState) {
    var _a, _b, _c, _d, _e, _f;
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
                        katexHtmlMain.classes.push(`ffl-${invocId}`);
                        root.classes.push(`ffl-${invocId}`);
                        break;
                    case "style":
                        let style = JSON.parse(ffl.arg.replaceAll('\xA0', '\x20'));
                        ((_c = root.children) !== null && _c !== void 0 ? _c : (root.children = [])).push((0, dom_1.toKaTeXVirtualNode)(`<style>${style.map(block => `
${block.selectorString} {
    ${Object.entries(block.properties).map(([k, v]) => {
                            var _a, _b;
                            if (k === 'label') {
                                k = '--ffl-label';
                                v = `${(_a = v.renderType) !== null && _a !== void 0 ? _a : ''}("${(_b = v.value) !== null && _b !== void 0 ? _b : ''}")`;
                            }
                            else if (k === 'background-color') {
                                k = '--ffl-background-color';
                            }
                            return `${k}: ${v};`;
                        }).join('\n')}
}`).join('\n')}</style>`));
                        ((_d = root.ffl) !== null && _d !== void 0 ? _d : (root.ffl = {})).labels = [];
                        root.ffl.backgroundColors = [];
                        style.forEach(block => {
                            let label = block.properties['label'];
                            if (label) {
                                root.ffl.labels.push({
                                    selector: block.selectorString,
                                    label: label
                                });
                            }
                            let backgroundColor = block.properties['background-color'];
                            if (backgroundColor) {
                                root.ffl.backgroundColors.push({
                                    selector: block.selectorString,
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
            ((_e = katexHtmlMain.classes) !== null && _e !== void 0 ? _e : (katexHtmlMain.classes = [])).push(...new Set(classesState.map(c => c[0])));
            if (['mord', 'mbin', 'vlist', 'mspace', 'mopen', 'mclose', 'mpunct', 'mrel', 'mop']
                .some(cls => { var _a; return (_a = katexHtmlMain.classes) === null || _a === void 0 ? void 0 : _a.includes(cls); })) {
                ((_f = katexHtmlMain.classes) !== null && _f !== void 0 ? _f : (katexHtmlMain.classes = [])).push('visible');
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
    var katexHtmlMain = htmlTree.children.find((span) => span.classes.includes("katex-html"));
    transformKaTeXHTML(htmlTree, katexHtmlMain);
    htmlTree.style.display = 'inline-block';
    return htmlTree;
}
function drawOverlays(root, labels, backgroundInfo) {
    if (!(0, common_1.isServer)()) {
        if (backgroundInfo)
            (0, overlay_1.drawBackground)(backgroundInfo, root);
        if (labels)
            (0, overlay_1.drawLabels)(labels, root);
    }
}
/**
 * labels are only supported when running on browser client
 * TODO: disable labels for inline?
 */
class ffl {
    static render(latex, ffl, baseNode, options) {
        var _a, _b;
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        let htmlNode = htmlTree.toNode();
        drawOverlays(htmlNode, (_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.labels, (_b = htmlTree.ffl) === null || _b === void 0 ? void 0 : _b.backgroundColors);
        baseNode.textContent = "";
        baseNode.appendChild(htmlNode);
    }
    static renderToString(latex, ffl, options) {
        var _a, _b;
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        if (!(0, common_1.isServer)()) {
            let htmlNode;
            try {
                htmlNode = (0, dom_1.toHTMLElement)(htmlTree.toMarkup());
                drawOverlays(htmlNode, (_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.labels, (_b = htmlTree.ffl) === null || _b === void 0 ? void 0 : _b.backgroundColors);
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