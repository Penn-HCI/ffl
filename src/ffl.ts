import katex, { KatexOptions } from 'katex';
import _, { at } from 'lodash';
import * as grammar from "./language/grammar";
import { isServer, isWhitespace } from './utils/common';
import { parseAtomics, TokenTree } from './language/groupParser';
import { v4 as uuidv4 } from 'uuid';
import {
  markClasses, flatten, markMatches, markConstants,
  fflMarker, fflPrefix, getFFLMarker, markDoubleGroups
} from './language/styleMarkers';
import { BackgroundInfo, BorderInfo, drawBackground, drawBorders, drawLabels, LabelInfo } from './render/overlay';
import { toHTMLElement, toKaTeXVirtualNode } from './utils/dom';

function __tryTokenize(selector: string, options: KatexOptions): string[] {
  let toks: any[] = [];
  try {
    katex.renderToString(`\\fflSelectorTokenizer{${selector}}`, {
      ...options,
      throwOnError: true,
      macros: {
        ...options.macros,
        "\\fflSelectorTokenizer": (context: any) => {
          toks = context.consumeArg().tokens;
          throw 'BREAK';
        }
      }
    });
  } catch (err) {
    if (err !== 'BREAK') throw err;
  }
  return toks.reverse();
}

function overrideOptions(options: KatexOptions | any, fflParse: grammar.FFLStyleSheet): KatexOptions {
  options ??= { macros: {} }
  let fflLitSelectorsTokenized: any[] = [];
  for (const b of fflParse) {
    for (const ss of (b as any).selectors)
      for (const s of (ss as any)) {
        if ((s as any).type === "literal") {
          fflLitSelectorsTokenized.push(__tryTokenize(s.str, options));
        }
      }
  }
  var isOpenGroup = (tok: string) => tok == '{';
  var isCloseGroup = (tok: string) => tok == '}';
  let sectionKey = options.ffl?.sectionKey ?? uuidv4();
  return {
    ...options,
    throwOnError: false,
    macros: {
      ...options.macros, "\\ffl": (context: any) => {
        // TODO: post-expansion matching
        var latex: any[] = context.consumeArg().tokens;
        var fflLitSelectors = [...fflLitSelectorsTokenized];
        // working with strings from now on, until we find a good way to implement katex's Token interface
        latex = parseAtomics(latex.reverse().map(tok => tok.text), isOpenGroup, isCloseGroup);
        fflLitSelectors = fflLitSelectors.map((selector: any[], idx) => {
          let selectorTexts = selector.map(tok => tok.text);
          return {
            key: `fflMatch${idx}-${selectorTexts.join("").replaceAll(/[^-_A-Za-z]/g, '_')}`,
            matcher: parseAtomics(selectorTexts.filter(tok => !isWhitespace(tok)), isOpenGroup, isCloseGroup)
          };
        });
        let latexWithMarkers: TokenTree | any = markMatches(latex, fflLitSelectors, '?', '*', {
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
        type Selector = { type: 'literal' | 'class', str: string, pseudoSelectors: { class: string, arg: string }[] };
        let style = fflParse.map(
          (styleBlock: any) => ({
            selectorGroups: styleBlock.selectors.map(
              (selectorGroup: ('*' | Selector)[]) => {
                let isGlobal = selectorGroup[0] === '*';
                if (isGlobal) selectorGroup.shift();
                let selectorGroup_: Selector[] = selectorGroup as any;
                return {
                  isGlobal, selectors: selectorGroup_.map(
                    (singleSelector: Selector) => {
                      let clazz: string | undefined = undefined;
                      if (singleSelector.type === 'literal') {
                        clazz = fflLitSelectors[idx++].key;
                      }
                      if (singleSelector.type === 'class') {
                        let className = singleSelector.str;
                        switch (className) {
                          case 'operator': className = 'mbin'; break;
                          case 'group': className = 'ffl-group'; break;
                          default: break;
                        }
                        clazz = className;
                      }
                      return {
                        class: clazz,
                        pseudoSelectors: singleSelector.pseudoSelectors
                      };
                    }
                  )
                }
              }
            ),
            properties: styleBlock.properties
          })
        );

        return `{${fflMarker("startInvoc", sectionKey)}${fflMarker("style", JSON.stringify(style))}
          {${latexWithMarkers.join('')}}${fflMarker("endInvoc", sectionKey)}}`;
      },
      '\\fflMarker': (context: any) => {
        var arg = context.consumeArg();
        var tok = arg.start.range(
          arg.end,
          `${fflPrefix}${arg.tokens.reverse().map((tok: any) => tok.text).join('').trim()}`,
        );
        tok.noexpand = true;
        return { numArgs: 0, tokens: [tok], unexpandable: true };
      }
    }
  };
}

export const toSelectorStrings = (selectorGroups: any[], scopeKey: string) =>
  selectorGroups.map(({ isGlobal, selectors }) =>
    `${isGlobal ? "*" : `.ffl-${scopeKey} `}${selectors.map(
      (selector: { class: string, pseudoSelectors: any }) =>
        `.${selector.class}${selector.pseudoSelectors.map((ps: any) => {
          switch (ps.class) {
            case "nth":
              return `[${INSTANCE_DATA_ATTR}*=${CSS.escape(JSON.stringify([selector.class, ps.arg]))}]`;
            default:
              return '';
          }
        }).join('')}`).join('')
    }`
  );

// from intermediate representation where selectors are replaces with CSS classes
// to a fake style node in KaTeX's representation of the document tree
const toCSS = (translatedStyles: any, scopeKey: string) =>
  toKaTeXVirtualNode(`<style> ${translatedStyles.map((block: any) => `
${toSelectorStrings(block.selectorGroups, scopeKey).join(', ')} {
  ${Object.entries(block.properties).map(([k, v]: [any, any]) => {
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
  }).join('\n')
    }
}`).join('\n')
    } </style>`
  );

export type SelectorInfo = { isGlobal: boolean, selectors: { class: string, pseudoSelectors: { class: string, arg: string }[] }[] };
export const INSTANCE_DATA_ATTR = "data-ffl-class-instances";
// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function transformKaTeXHTML(root: any, katexHtmlMain: any,
  classesState?: [style: string, instanceIdx: number][]): string | undefined {
  let invocId: string | undefined;
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
            let style: any[] = JSON.parse(ffl.arg.replaceAll('\xA0', '\x20'));
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
              const parsePx = (s: string) => {
                let s_ = (s ?? "").trim();
                let f = parseFloat(
                  s_.toLowerCase().endsWith('px')
                    ? s_.slice(0, s_.length - 2).trimEnd() : s_);
                return (f && !isNaN(f)) ? f : 0;
              }
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
            classesState.push(ffl.arg.split('}{')); break;
          case "endStyle":
            classesState.splice(classesState.indexOf(ffl.arg.split('}{')), 1); break;
          case "endInvoc":
            // nothing to do here since we are using the descendant combinator
            break;
        }
        katexHtmlMain.children.splice(i--, 1);
      } else {
        let id = transformKaTeXHTML(root, childNode, classesState);
        if (!invocId) invocId = id;
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
      } else {
        let _toNode = katexHtmlMain.toNode;
        katexHtmlMain.toNode = () => {
          let node = _toNode.call(katexHtmlMain, "span")
          node.setAttribute(INSTANCE_DATA_ATTR, JSON.stringify(classesState));
          return node;
        }
        let _toMarkup = katexHtmlMain.toMarkup;
        let _classesState = _.escape(JSON.stringify(classesState));
        katexHtmlMain.toMarkup = () => _toMarkup.call(katexHtmlMain, "span").replace(/(?<!\\)>/,
          ` ${INSTANCE_DATA_ATTR}="${_classesState}">`);
      }
    }
  }
  return invocId;
}

function findKatexHTMLRoot(htmlTree: any): any | undefined {
  return htmlTree.children.find((span: any) => span.classes.includes("katex-html"))
    ?? htmlTree.children.map(findKatexHTMLRoot).find((e: any) => e);
}

function renderToHTMLTree(ffl: string, expression: string, options?: KatexOptions): any {
  let __renderToHTMLTree = (window as any).renderToHTMLTree ?? katex.__renderToHTMLTree;
  try {
    __renderToHTMLTree(expression, { ...options, throwOnError: true });
  } catch (err) {
    if (options?.throwOnError) {
      throw err;
    } else {
      return __renderToHTMLTree(expression, options ?? {});
    }
  }
  var parsedFFL = grammar.parse(ffl, { startRule: "blocks" }) as grammar.FFLStyleSheet;
  var htmlTree = __renderToHTMLTree(`\\ffl{${expression}}`, overrideOptions(options, parsedFFL));
  var katexHtmlMain = findKatexHTMLRoot(htmlTree);
  transformKaTeXHTML(htmlTree, katexHtmlMain);
  htmlTree.style.display = 'inline-block';
  return htmlTree;
}

function drawOverlays(root: HTMLElement, scopeKey: string,
  labels?: LabelInfo, backgroundInfo?: BackgroundInfo, borderInfo?: BorderInfo,
  options?: KatexOptions) {
  if (!isServer()) {
    if (borderInfo) drawBorders(borderInfo, root, scopeKey);
    if (backgroundInfo) drawBackground(backgroundInfo, root, scopeKey);
    if (labels && options?.displayMode) drawLabels(labels, root, scopeKey);
  }
}

/**
 * labels are only supported when running on browser client
 * TODO: disable labels for inline?
 */
class ffl {
  static render(latex: string, ffl: string, baseNode: HTMLElement, options?: KatexOptions): void {
    let htmlTree = renderToHTMLTree(ffl, latex, options);
    let htmlNode = htmlTree.toNode();
    drawOverlays(htmlNode, htmlTree.ffl?.invocId, htmlTree.ffl?.labels, htmlTree.ffl?.backgroundColors, htmlTree.ffl?.borders, options);
    baseNode.textContent = "";
    baseNode.appendChild(htmlNode);
  }

  static renderToString(latex: string, ffl: string, options?: KatexOptions): string {
    let htmlTree = renderToHTMLTree(ffl, latex, options);
    if (!isServer()) {
      let htmlNode;
      try {
        htmlNode = toHTMLElement(htmlTree.toMarkup());
        drawOverlays(htmlNode, htmlTree.ffl?.invocId, htmlTree.ffl?.labels, htmlTree.ffl?.backgroundColors, htmlTree.ffl?.borders, options);
        var htmlStr = htmlNode.outerHTML;
      } finally {
        if (htmlNode) htmlNode.remove();
      }
      return htmlStr;
    } else {
      return htmlTree.toMarkup();
    }
  }

  // can be used to pre-validate
  static parseFFL(ffl: string) {
    return grammar.parse(ffl, { startRule: "blocks" });
  }
}

export default ffl;
