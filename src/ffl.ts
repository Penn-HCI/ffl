import katex, { KatexOptions } from 'katex';
import reexport from "./reexport";
import * as grammar from "./grammar";
import _, { map } from "lodash";
import { __isWhitespace, __mapGroup, __merge } from './utils';
import { GrammarError } from 'peggy';

const __fflPrefix = "\\ffl@";

function overrideOptions(options: KatexOptions | undefined): KatexOptions {
  options ??= { macros: {} }
  return {
    ...options,
    throwOnError: false,
    macros: {
      ...options.macros, "\\ffl": (context: any) => {
        // FIXME: this is too monolithic, refactoring needed
        var [fflTokens, latex]: [any[], any[]] = context.consumeArgs(2);
        // parse FFL, (hacky:) copy tokenized literal selectors
        // TODO: double check escape tokenization
        var fflString = "", fflLitSelectors = [], fflParse;
        var tok: any, litMode = false, litTokens = [];
        while (tok = fflTokens.pop()) {
          if (tok.text == '$') {
            litMode = !litMode;
            if (litMode) litTokens = [];
            else fflLitSelectors.push(litTokens);
          } else if (litMode) {
            litTokens.push(tok);
          }
          fflString += tok.text;
        }
        try {
          fflParse = grammar.parse(fflString, { startRule: "blocks" });
          console.log(fflParse);
        } catch (error) {
          // FIXME: error reporting doesn't always work
          let grammarError: GrammarError = error as GrammarError;
          return `\\texttt{\\textbackslash ffl\\{}{\\color{red}{
            \\verb!${fflString.slice(0, grammarError.location?.start.offset)}!
            \\underbrace{\\verb!${fflString.slice(grammarError.location?.start.offset, grammarError.location?.end.offset)}!}
            _{\\mathclap{\\text{${grammarError.location?.start.line}:${grammarError.location?.start.column}: 
              ${grammarError.message.replaceAll(/\\/g, "\\textbackslash ").replaceAll(/([&%$#_\{\}~])/g, "\\$&")}
            }}}\\verb!${fflString.slice(grammarError.location?.end.offset)}!
            }}{\\texttt{\\}\\{}${latex.reverse().map(tok => tok.text).join("")}\\texttt{\\}}}`
        }
        // convert literal selectors to token state maps, removing spaces
        fflLitSelectors = Object.entries(
          fflLitSelectors.map(sel =>
            sel.map(tok => tok.text).filter(txt => !__isWhitespace(txt)))
        );
        function __collapse(arr: [key: any, tokens: any[]][]): any {
          return _.mapValues(__mapGroup(arr, ent => ent[1][0] ?? '\0',
            ent => [ent[0], ent[1].slice(1)]),
            (grp, key, _o) => key != '\0' ? __collapse(grp) : grp.map((idx: [any, any[]]) => idx[0]));
        }
        let fflLitSelectorsMap = __collapse(fflLitSelectors);
        // mark all matches for literal selectors
        var startStyles: { [idx: number]: { end: number, styles: any }[] } = [];
        var endStyles: { [idx: number]: { start: number, styles: any }[] } = [];
        latex = latex.reverse();
        // is there a better matching algo? maybe should have kept the array format
        // note our grammar does not allow empty selectors
        for (var start = 0; start < latex.length; start++) {
          let remainingMatchTable = fflLitSelectorsMap;
          for (var cur = start; cur < latex.length; cur++) {
            var tok = latex[cur].text;
            if (!__isWhitespace(tok)) {
              if (!(Object.hasOwn(remainingMatchTable, tok)
                || Object.hasOwn(remainingMatchTable, '\\?')
                || Object.hasOwn(remainingMatchTable, '\\*'))) {
                break;
              } else {
                // TODO: handle escapes ('\$')
                // FIXME: wildcard '\*' still has weird behaviors
                const __merge_cont_style = function (map: object, arr: any[]) {
                  return arr ? { ...Object.assign({}, map), '\0': arr } : map;
                }
                const __merge_style_arrs = function (arr1: any, arr2: any) {
                  if (!arr1) arr1 = [];
                  if (!Array.isArray(arr1)) arr1 = [arr1];
                  return arr1.concat(arr2);
                }
                // merging all possible states after wildcard
                var newRemainingMatchTable =
                  __merge(remainingMatchTable[tok], remainingMatchTable['\\?'] ?? {}, __merge_cont_style, __merge_style_arrs);
                if (remainingMatchTable['\\*']) {
                  newRemainingMatchTable =
                    __merge(newRemainingMatchTable, remainingMatchTable['\\*'] ?? {}, __merge_cont_style, __merge_style_arrs);
                  newRemainingMatchTable =
                    __merge(newRemainingMatchTable, { '\\*': remainingMatchTable['\\*'] }, __merge_cont_style, __merge_style_arrs);
                }
                remainingMatchTable = newRemainingMatchTable;
                if (Object.hasOwn(remainingMatchTable, '\0')) {
                  startStyles[start] ??= [];
                  startStyles[start].push({ end: cur + 1, styles: remainingMatchTable['\0'] });
                  endStyles[cur + 1] ??= [];
                  endStyles[cur + 1].push({ start: start, styles: remainingMatchTable['\0'] });
                }
              }
            }
          }
        }
        // mark style groupings
        var latexWithMarkers: any[] = [];
        var fflLitSelectorsClassNames =
          fflLitSelectors.map((val: [any, string[]], idx, arr) => val[1].join("").replaceAll(/[^-_A-Za-z]/g, '_'));
        for (var i = 0; i < latex.length; i++) {
          if (endStyles[i]) {
            latexWithMarkers.push(
              ...endStyles[i]
                .flatMap((e: { start: number, styles: number[] }) => e.styles.map((sty, idx, arr) => [e.start, sty]))
                .sort().reverse().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => `\\fflMarker{endStyle{${val[1]}-${fflLitSelectorsClassNames[val[1]]}}}`)
            );
          }
          if (startStyles[i]) {
            latexWithMarkers.push(
              ...startStyles[i]
                .flatMap((e: { end: number, styles: number[] }) => e.styles.map((sty, idx, arr) => [e.end, sty]))
                .sort().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => `\\fflMarker{startStyle{${val[1]}-${fflLitSelectorsClassNames[val[1]]}}}`)
            );
          }
          latexWithMarkers.push(latex[i].text);
        }
        // fix groupings at markers after _/^
        for (var i = 0; i < latexWithMarkers.length; i++) {
          if ((latexWithMarkers[i] == '_' || latexWithMarkers[i] == '^')
            && (latexWithMarkers[i + 1] ?? '').startsWith("\\fflMarker")) {
            latexWithMarkers.splice(++i, 0, "{");
            let toClose = i + 1;
            while (latexWithMarkers[toClose].startsWith("\\fflMarker")) toClose++;
            let openGroups = latexWithMarkers[toClose] == '{' ? 1 : 0;
            while (openGroups > 0) {
              switch (latexWithMarkers[++toClose]) {
                case '{': openGroups++; break;
                case '}': openGroups--; break;
              }
            }
            while (latexWithMarkers[toClose].startsWith("\\fflMarker")) toClose++;
            latexWithMarkers.splice(toClose + 1, 0, "}");
          }
        }
        console.log(latexWithMarkers.join(''));
        // register styles, CSS only for now
        let sectionId = self.crypto.randomUUID();
        let fflLitSelectorsRevMap = Object.fromEntries(fflLitSelectors.map(val => [val[1].join(''), val[0]]));
        // this below needs to get clean up (too many nested call backs)
        let styleString = fflParse.map(
          (styleBlock: any) => {
            let classString = styleBlock.selectors.map((selectorGroups: { type: string, str: string }[]) =>
              selectorGroups.map(
                (singleSelector: { type: string, str: string }) => {
                  if (singleSelector.type == 'literal') {
                    let idx: any = fflLitSelectorsRevMap[singleSelector.str.replaceAll(/[ \t\r\n\v\f]/g, '')];
                    return `.fflMatch${idx}-${fflLitSelectorsClassNames[idx]}`;
                  }
                  if (singleSelector.type == 'class') {
                    return `.${singleSelector.str}`;
                  }
                }
              ).join('')
            ).map((grpStr: string) => `.ffl-${sectionId} ${grpStr}`).join(', ');
            // preprocess labels here
            return `${classString} {\n${Object.entries(styleBlock.attributes).map(([k, v]) => {
              return `${k}: ${Array.isArray(v) ? v.join(' ') : v};`;
            }).join('\n')}\n}`;
          }
        ).join('\n');
        return `{\\fflMarker{startInvoc{${sectionId}}}\\fflMarker{styleString{${styleString}}}
                  {${latexWithMarkers.join('')}}\\fflMarker{endInvoc{${sectionId}}}}`;
      },
      '\\fflMarker': (context: any) => {
        var arg = context.consumeArg();
        var tok = arg.start.range(
          arg.end,
          `${__fflPrefix}${arg.tokens.reverse().map((tok: any) => tok.text).join('').trim()}`,
        );
        tok.noexpand = true;
        return { numArgs: 0, tokens: [tok], unexpandable: true };
      }
    }
  };
}

function __getFFLMarker(node: any): any {
  if (['mord', 'text'].every((name) => (node.classes ?? []).includes(name))
    && node.children[0].text.startsWith(__fflPrefix)) {
    let ffl = node.children[0].text.replace(new RegExp(`^${__fflPrefix.replaceAll("\\", "\\\\")}`), "").trim();
    let argIdx = ffl.indexOf("{");
    return {
      command: ffl.slice(0, argIdx),
      arg: ffl.slice(argIdx + 1, -1), // all of our markers should have single arg and no surrounding space
      // more advanced parsing could be done here or in \fflMarker macro impl if this is not enough
    };
  } else {
    return undefined;
  }
}

function __asKaTeXVirtualNode(element: HTMLElement) {
  return new Proxy(element, {
    get(target, prop, receiver) {
      switch (prop) {
        case "hasClass": return target.classList.contains;
        case "toNode": return () => target;
        case "toMarkup": return () => target.outerHTML;
      }
      return Reflect.get(target, prop, receiver);
    },
  })
}

// TODO: figure out how to use the reexported types
function __transformKaTeXHTML(root: any, katexHtmlMain: any, classesState?: string[]) {
  if (katexHtmlMain) { // temp fix for empty element at the end of input
    classesState ??= [];
    if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes)) katexHtmlMain.classes = [katexHtmlMain.classes];
    (katexHtmlMain.classes ??= []).push(...classesState);
    for (var i = 0; i < (katexHtmlMain.children ?? []).length; i++) {
      var childNode = katexHtmlMain.children[i], ffl;
      if (ffl = __getFFLMarker(childNode)) {
        switch (ffl.command) {
          case "startInvoc": katexHtmlMain.classes.push(`ffl-${ffl.arg}`); break;
          case "styleString":
            var style = document.createElement('style');
            style.appendChild(document.createTextNode(ffl.arg.replaceAll('\xA0', '\x20')));
            (root.children ??= []).push(__asKaTeXVirtualNode(style));
            break;
          case "startStyle":
            if (!classesState.includes(`fflMatch${ffl.arg}`))
              classesState.push(`fflMatch${ffl.arg}`);
            break;
          case "endStyle": classesState.splice(classesState.indexOf(ffl.arg), 1); break;
          case "endInvoc":
            // nothing to do here since we are using the descendant combinator
            break;
        }
        katexHtmlMain.children.splice(i--, 1);
      } else {
        __transformKaTeXHTML(root, childNode, classesState);
      }
    }
  }
}

function __renderToHTMLTree(expression: string, options?: KatexOptions): any {
  var htmlTree = reexport.katex.__renderToHTMLTree(expression, overrideOptions(options));
  var katexHtmlMain = htmlTree.children.find((span: any) => span.classes.includes("katex-html"));
  __transformKaTeXHTML(htmlTree, katexHtmlMain);
  return htmlTree;
}

class ffl implements katex {
  static render(expression: string, baseNode: HTMLElement, options?: KatexOptions): void {
    baseNode.textContent = "";
    baseNode.appendChild(__renderToHTMLTree(expression, options).toNode());
  }

  static renderToString(expression: string, options?: KatexOptions): string {
    return __renderToHTMLTree(expression, options).toMarkup();
  }
}

export default ffl;
