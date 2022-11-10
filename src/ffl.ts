import katex, { KatexOptions } from 'katex';
import * as grammar from "./language/grammar";
import { isServer, isWhitespace } from './utils/common';
import { parseAtomics } from './language/groupParser';
import { v4 as uuidv4 } from 'uuid';
import {
  markClasses, flatten, markMatches, markConstants,
  fflMarker, fflPrefix, getFFLMarker
} from './language/styleMarkers';
import { BackgroundInfo, drawBackground, drawLabels, LabelInfo } from './render/overlay';
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

function overrideOptions(options: KatexOptions | any, fflParse: any): KatexOptions {
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
        // FIXME: this is too monolithic, refactoring needed
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
        let latexWithMarkers = markMatches(latex, fflLitSelectors, '?', '*', {
          '\\*': '*',
          '\\?': '?'
        });
        latexWithMarkers = flatten(markConstants(markClasses(latexWithMarkers))) as any[];
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
        let style = fflParse.map(
          (styleBlock: any) => ({
            selectorString: styleBlock.selectors.map(
              (selectorGroups: { type: 'literal' | 'class', str: string }[]) =>
                selectorGroups.map(
                  (singleSelector: { type: string, str: string }) => {
                    if (singleSelector.type === 'literal') {
                      return `.${fflLitSelectors[idx++].key}`;
                    }
                    if (singleSelector.type === 'class') {
                      let className = singleSelector.str;
                      switch (className) {
                        case 'operator': className = 'mbin'; break;
                        default: break;
                      }
                      return `.${className}`;
                    }
                  }
                ).join('')
            ).map((grpStr: string) => `.ffl-${sectionKey} ${grpStr}.visible`).join(', '),
            properties: styleBlock.attributes
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

// TODO: figure out how to use the reexported types, maybe use a more detailed .d.ts file instead of reexport
function transformKaTeXHTML(root: any, katexHtmlMain: any, classesState?: string[]) {
  if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
    classesState ??= [];
    if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
      katexHtmlMain.classes = [katexHtmlMain.classes];
    for (var i = 0; i <= (katexHtmlMain.children ?? []).length; i++) {
      var childNode = (katexHtmlMain.children ?? [])[i], ffl;
      if (ffl = getFFLMarker(childNode)) {
        switch (ffl.command) {
          case "startInvoc": katexHtmlMain.classes.push(`ffl-${ffl.arg}`); break;
          case "style":
            let style: any[] = JSON.parse(ffl.arg.replaceAll('\xA0', '\x20'));
            (root.children ??= []).push(
              toKaTeXVirtualNode(`<style>${style.map(block => `
                ${block.selectorString} {\n
                  ${Object.entries(block.properties).map(([k, v]: [any, any]) => {
                if (k === 'label') {
                  k = '--ffl-label';
                  v = `${v.renderType ?? ''}("${v.value ?? ''}")`;
                }
                return `${k}: ${v};\n`;
              })}}`).join('\n')}</style>`));
            (root.ffl ??= {}).labels = [];
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
            classesState.push(`${ffl.arg}`); break;
          case "endStyle": classesState.splice(classesState.indexOf(ffl.arg), 1); break;
          case "endInvoc":
            // nothing to do here since we are using the descendant combinator
            break;
        }
        katexHtmlMain.children.splice(i--, 1);
      } else {
        transformKaTeXHTML(root, childNode, classesState);
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
  var parsedFFL = grammar.parse(ffl, { startRule: "blocks" });
  var htmlTree = __renderToHTMLTree(`\\ffl{${expression}}`, overrideOptions(options, parsedFFL));
  var katexHtmlMain = htmlTree.children.find((span: any) => span.classes.includes("katex-html"));
  transformKaTeXHTML(htmlTree, katexHtmlMain);
  htmlTree.style.display = 'inline-block';
  return htmlTree;
}

function drawOverlays(root: HTMLElement, labels?: LabelInfo, backgroundInfo?: BackgroundInfo) {
  if (!isServer()) {
    if (backgroundInfo) drawBackground(backgroundInfo, root);
    if (labels) drawLabels(labels, root);
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
    drawOverlays(htmlNode, htmlTree.ffl?.labels, htmlTree.ffl?.backgroundColors);
    baseNode.textContent = "";
    baseNode.appendChild(htmlNode);
  }

  // TODO: defer label drawing to a <script> tag on client side
  // (to be compatible VSCode which runs extension on server side)
  static renderToString(latex: string, ffl: string, options?: KatexOptions): string {
    let htmlTree = renderToHTMLTree(ffl, latex, options);
    if (!isServer()) {
      let htmlNode;
      try {
        htmlNode = toHTMLElement(htmlTree.toMarkup());
        drawOverlays(htmlNode, htmlTree.ffl?.labels, htmlTree.ffl?.backgroundColors);
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
