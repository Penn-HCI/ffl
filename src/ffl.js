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
const katex_1 = __importDefault(require("katex"));
const grammar = __importStar(require("./grammar"));
const utils_1 = require("./utils");
const groupParser_1 = require("./groupParser");
const uuid_1 = require("uuid");
const styleMarkers_1 = require("./styleMarkers");
const labels_1 = require("./labels");
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
                        matcher: (0, groupParser_1.parseAtomics)(selectorTexts.filter(tok => !(0, utils_1.isWhitespace)(tok)), isOpenGroup, isCloseGroup)
                    };
                });
                let latexWithMarkers = (0, styleMarkers_1.markMatches)(latex, fflLitSelectors, '\\?', '\\*');
                let _latexWithMarkers = (0, styleMarkers_1.deepFlattenAndMark)(latexWithMarkers);
                _latexWithMarkers = Array.isArray(_latexWithMarkers) ? _latexWithMarkers : [_latexWithMarkers];
                latexWithMarkers = (0, styleMarkers_1.markConstants)(_latexWithMarkers);
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
                // this below needs to get clean up (too many nested call backs)
                var labels = [];
                var idx = 0;
                let styleString = fflParse.map((styleBlock) => {
                    let classString = styleBlock.selectors.map((selectorGroups) => selectorGroups.map((singleSelector) => {
                        if (singleSelector.type == 'literal') {
                            return `.${fflLitSelectors[idx++].key}`;
                        }
                        if (singleSelector.type == 'class') {
                            let className = singleSelector.str;
                            switch (className) {
                                case 'operator':
                                    className = 'mbin';
                                    break;
                                default: break;
                            }
                            return `.${className}`;
                        }
                    }).join('')).map((grpStr) => `.ffl-${sectionKey} ${grpStr}.visible`).join(', ');
                    // preprocess labels here
                    return `${classString} {\n${Object.entries(styleBlock.attributes).map(([k, v]) => {
                        if (k == 'label') {
                            labels.push({
                                selector: classString,
                                label: v,
                            });
                            k = '--ffl-label';
                        }
                        return `${k}: ${Array.isArray(v) ? v.join(' ') : v};`;
                    }).join('\n')}\n}`;
                }).join('\n');
                return `{${(0, styleMarkers_1.fflMarker)(`startInvoc{${sectionKey}}`)}${(0, styleMarkers_1.fflMarker)(`styleString{${styleString}}`)}
          ${labels.map(({ selector, label }) => (0, styleMarkers_1.fflMarker)(`label{${selector}}{${JSON.stringify(label)}}`)).join('')}
          {${latexWithMarkers.join('')}}${(0, styleMarkers_1.fflMarker)(`endInvoc{${sectionKey}}`)}}`;
            }, '\\fflMarker': (context) => {
                var arg = context.consumeArg();
                var tok = arg.start.range(arg.end, `${styleMarkers_1.fflPrefix}${arg.tokens.reverse().map((tok) => tok.text).join('').trim()}`);
                tok.noexpand = true;
                return { numArgs: 0, tokens: [tok], unexpandable: true };
            } }) });
}
// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function transformKaTeXHTML(root, katexHtmlMain, classesState) {
    var _a, _b, _c, _d, _e, _f, _g;
    var _h;
    if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
        classesState !== null && classesState !== void 0 ? classesState : (classesState = []);
        if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
            katexHtmlMain.classes = [katexHtmlMain.classes];
        for (var i = 0; i <= ((_a = katexHtmlMain.children) !== null && _a !== void 0 ? _a : []).length; i++) {
            var childNode = ((_b = katexHtmlMain.children) !== null && _b !== void 0 ? _b : [])[i], ffl;
            if (ffl = (0, styleMarkers_1.getFFLMarker)(childNode)) {
                switch (ffl.command) {
                    case "startInvoc":
                        katexHtmlMain.classes.push(`ffl-${ffl.arg}`);
                        break;
                    case "styleString":
                        ((_c = root.children) !== null && _c !== void 0 ? _c : (root.children = [])).push((0, utils_1.toKaTeXVirtualNode)(`<style>${ffl.arg.replaceAll('\xA0', '\x20')}</style>`));
                        break;
                    case "label": // no grouping for now
                        (_e = (_h = ((_d = root.ffl) !== null && _d !== void 0 ? _d : (root.ffl = []))).labels) !== null && _e !== void 0 ? _e : (_h.labels = []);
                        var labelArg = ffl.arg.replaceAll('\xA0', '\x20');
                        var delimIdx = labelArg.indexOf('}{'); // safe since first arg is a css query
                        root.ffl.labels.push({
                            selector: labelArg.slice(0, delimIdx),
                            label: JSON.parse(labelArg.slice(delimIdx + 2))
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
                transformKaTeXHTML(root, childNode, classesState);
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
function renderToHTMLTree(ffl, expression, options) {
    try {
        katex_1.default.__renderToHTMLTree(expression, Object.assign(Object.assign({}, options), { throwOnError: true }));
    }
    catch (err) {
        if (options === null || options === void 0 ? void 0 : options.throwOnError) {
            throw err;
        }
        else {
            return katex_1.default.__renderToHTMLTree(expression, options);
        }
    }
    var parsedFFL = grammar.parse(ffl, { startRule: "blocks" });
    var htmlTree = katex_1.default.__renderToHTMLTree(`\\ffl{${expression}}`, overrideOptions(options, parsedFFL));
    var katexHtmlMain = htmlTree.children.find((span) => span.classes.includes("katex-html"));
    transformKaTeXHTML(htmlTree, katexHtmlMain);
    htmlTree.style.display = 'inline-block';
    return htmlTree;
}
/**
 * labels are only supported when running on browser client
 * TODO: disable labels for inline?
 */
class ffl {
    static render(latex, ffl, baseNode, options) {
        var _a;
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        let htmlNode = htmlTree.toNode();
        if (typeof window !== "undefined" && ((_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.labels))
            (0, labels_1.drawLabels)(htmlTree.ffl.labels, htmlNode);
        baseNode.textContent = "";
        baseNode.appendChild(htmlNode);
    }
    // TODO: defer label drawing to a <script> tag on client side
    // (to be compatible VSCode which runs extension on server side)
    static renderToString(latex, ffl, options) {
        var _a;
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        if (!(0, utils_1.isServer)() && ((_a = htmlTree.ffl) === null || _a === void 0 ? void 0 : _a.labels)) {
            let htmlNode = (0, utils_1.toHTMLElement)(htmlTree.toMarkup());
            (0, labels_1.drawLabels)(htmlTree.ffl.labels, htmlNode);
            var htmlStr = htmlNode.outerHTML;
            htmlNode.remove();
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
