import katex from 'katex';
import _ from 'lodash';
import * as grammar from "./src/language/grammar";
import { isServer, isWhitespace } from './src/utils/common';
import { parseAtomics } from './src/language/groupParser';
import { v4 as uuidv4 } from 'uuid';
import { markClasses, flatten, markMatches, markConstants, fflMarker, fflPrefix, getFFLMarker, markDoubleGroups } from './src/language/styleMarkers';
import { drawBackground, drawBorders, drawLabels } from './src/render/overlay';
import { toHTMLElement, toKaTeXVirtualNode } from './src/utils/dom';
function __tryTokenize(selector, options) {
    let toks = [];
    try {
        katex.renderToString(`\\fflSelectorTokenizer{${selector}}`, {
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
    let sectionKey = options.ffl?.sectionKey ?? uuidv4();
    return {
        ...options,
        throwOnError: false,
        macros: {
            ...options.macros, "\\ffl": (context) => {
                // TODO: post-expansion matching
                var latex = context.consumeArg().tokens;
                var fflLitSelectors = [...fflLitSelectorsTokenized];
                // working with strings from now on, until we find a good way to implement katex's Token interface
                latex = parseAtomics(latex.reverse().map(tok => tok.text), isOpenGroup, isCloseGroup);
                fflLitSelectors = fflLitSelectors.map((selector, idx) => {
                    let selectorTexts = selector.map(tok => tok.text);
                    return {
                        key: `fflMatch${idx}-${selectorTexts.join("").replaceAll(/[^-_A-Za-z]/g, '_')}`,
                        matcher: parseAtomics(selectorTexts.filter(tok => !isWhitespace(tok)), isOpenGroup, isCloseGroup)
                    };
                });
                let latexWithMarkers = markMatches(latex, fflLitSelectors, '?', '*', {
                    '\\*': '*',
                    '\\?': '?'
                });
                // TODO: single-pass implementation rather than multi-pass
                latexWithMarkers = markDoubleGroups(latexWithMarkers);
                latexWithMarkers = flatten(markConstants(markClasses(latexWithMarkers)));
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
                return `{${fflMarker("startInvoc", sectionKey)}${fflMarker("style", JSON.stringify(style))}
          {${latexWithMarkers.join('')}}${fflMarker("endInvoc", sectionKey)}}`;
            },
            '\\fflMarker': (context) => {
                var arg = context.consumeArg();
                var tok = arg.start.range(arg.end, `${fflPrefix}${arg.tokens.reverse().map((tok) => tok.text).join('').trim()}`);
                tok.noexpand = true;
                return { numArgs: 0, tokens: [tok], unexpandable: true };
            }
        }
    };
}
export const toSelectorStrings = (selectorGroups, scopeKey) => selectorGroups.map(({ isGlobal, selectors }) => `${isGlobal ? "*" : `.ffl-${scopeKey} `}${selectors.map((selector) => `.${selector.class}${selector.pseudoSelectors.map((ps) => {
    switch (ps.class) {
        case "nth":
            return `[${INSTANCE_DATA_ATTR}*=${CSS.escape(JSON.stringify([selector.class, ps.arg]))}]`;
        default:
            return '';
    }
}).join('')}`).join('')}`);
// from intermediate representation where selectors are replaces with CSS classes
// to a fake style node in KaTeX's representation of the document tree
const toCSS = (translatedStyles, scopeKey) => toKaTeXVirtualNode(`<style> ${translatedStyles.map((block) => `
${toSelectorStrings(block.selectorGroups, scopeKey).join(', ')} {
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
export const INSTANCE_DATA_ATTR = "data-ffl-class-instances";
// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function transformKaTeXHTML(root, katexHtmlMain, classesState) {
    let invocId;
    if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
        classesState ??= [];
        if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
            katexHtmlMain.classes = [katexHtmlMain.classes];
        for (var i = 0; i < (katexHtmlMain.children ?? []).length; i++) {
            var childNode = (katexHtmlMain.children ?? [])[i], ffl;
            if (ffl = getFFLMarker(childNode)) {
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
                katexHtmlMain.setAttribute(INSTANCE_DATA_ATTR, JSON.stringify(classesState));
            }
            else {
                let _toNode = katexHtmlMain.toNode;
                katexHtmlMain.toNode = () => {
                    let node = _toNode.call(katexHtmlMain, "span");
                    node.setAttribute(INSTANCE_DATA_ATTR, JSON.stringify(classesState));
                    return node;
                };
                let _toMarkup = katexHtmlMain.toMarkup;
                let _classesState = _.escape(JSON.stringify(classesState));
                katexHtmlMain.toMarkup = () => _toMarkup.call(katexHtmlMain, "span").replace(/(?<!\\)>/, ` ${INSTANCE_DATA_ATTR}="${_classesState}">`);
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
    let __renderToHTMLTree = window.renderToHTMLTree ?? katex.__renderToHTMLTree;
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
    if (!isServer()) {
        if (borderInfo)
            drawBorders(borderInfo, root, scopeKey);
        if (backgroundInfo)
            drawBackground(backgroundInfo, root, scopeKey);
        if (labels && options?.displayMode)
            drawLabels(labels, root, scopeKey);
    }
}
/**
 * labels are only supported when running on browser client
 * TODO: disable labels for inline?
 */
export default class ffl {
    static render(latex, ffl, baseNode, options) {
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        let htmlNode = htmlTree.toNode();
        drawOverlays(htmlNode, htmlTree.ffl?.invocId, htmlTree.ffl?.labels, htmlTree.ffl?.backgroundColors, htmlTree.ffl?.borders, options);
        baseNode.textContent = "";
        baseNode.appendChild(htmlNode);
    }
    static renderToString(latex, ffl, options) {
        let htmlTree = renderToHTMLTree(ffl, latex, options);
        if (!isServer()) {
            let htmlNode;
            try {
                htmlNode = toHTMLElement(htmlTree.toMarkup());
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
//# sourceMappingURL=ffl.js.map