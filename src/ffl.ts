import katex, { KatexOptions } from 'katex';
import reexport from "./reexport";
import * as grammar from "./grammar";
import _, { partition } from "lodash";
import { GrammarError } from 'peggy';
import { BoundingBox, __isWhitespace, __mapGroup, __merge, __resetVisibility, __setVisible } from './utils';
import * as labella from 'labella';
import * as d3 from 'd3';

const __fflPrefix = "\\ffl@";
// TODO: lift out shared constants

function overrideOptions(options: KatexOptions | undefined): KatexOptions {
  options ??= { macros: {} }
  return {
    ...options,
    throwOnError: false,
    macros: {
      ...options.macros, "\\ffl": (context: any) => {
        // TODO: post-expansion matching
        // FIXME: this is too monolithic, refactoring needed
        var [fflTokens, latex]: [any[], any[]] = context.consumeArgs(2);
        /// parse FFL, (hacky:) copy tokenized literal selectors
        // TODO: double check escape tokenization
        var fflString = "", fflLitSelectors: any[] = [], fflParse;
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
        /// convert literal selectors to token state maps, removing spaces
        fflLitSelectors = fflLitSelectors.map(sel => sel.map((tok: any) => tok.text).filter((txt: string) => !__isWhitespace(txt)));
        function __collapse(arr: [key: any, tokens: any[]][]): any {
          return _.mapValues(__mapGroup(arr, ent => ent[1][0] ?? '\0',
            ent => [ent[0], ent[1].slice(1)]),
            (grp, key, _o) => key != '\0' ? __collapse(grp) : grp.map((idx: [any, any[]]) => idx[0]));
        }
        let fflLitSelectorsMap = __collapse(Object.entries(fflLitSelectors));
        /// mark all matches for literal selectors
        var startStyles: { [idx: number]: { end: number, styles: string[] }[] } = [];
        var endStyles: { [idx: number]: { start: number, styles: string[] }[] } = [];
        var fflLitSelectorsClassNames = fflLitSelectors.map((val: string[]) => val.join("").replaceAll(/[^-_A-Za-z]/g, '_'));
        latex = latex.reverse(); // can't use pop since we are doing 2 loops
        // FIXME: rewrite to consume atom/group rather than tokens
        // prereq: evaluate if it is actually faster than merges
        for (var start = 0; start < latex.length; start++) {
          let remainingMatchTable = fflLitSelectorsMap;
          for (var cur = start; cur < latex.length; cur++) {
            var tok = latex[cur].text;
            if (!__isWhitespace(tok)) {
              // note that we do not remove whitespaces in the LaTeX string only skip them in case of useful ones
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
                var newRemainingMatchTable = __merge({}, remainingMatchTable[tok], __merge_cont_style, __merge_style_arrs);
                __merge(newRemainingMatchTable, remainingMatchTable['\\?'] ?? {}, __merge_cont_style, __merge_style_arrs);
                // FIXME: \? should not match empty selection
                // FIXME: \* should respect groups
                if (remainingMatchTable['\\*']) {
                  newRemainingMatchTable =
                    __merge(newRemainingMatchTable, remainingMatchTable['\\*'] ?? {}, __merge_cont_style, __merge_style_arrs);
                  newRemainingMatchTable =
                    __merge(newRemainingMatchTable, { '\\*': remainingMatchTable['\\*'] }, __merge_cont_style, __merge_style_arrs);
                }
                remainingMatchTable = newRemainingMatchTable;
                if (Object.hasOwn(remainingMatchTable, '\0')) {
                  startStyles[start] ??= [];
                  startStyles[start].push({
                    end: cur + 1,
                    styles: remainingMatchTable['\0'].map((idx: number) => `fflMatch${idx}-${fflLitSelectorsClassNames[idx as number]}`)
                  });
                  endStyles[cur + 1] ??= [];
                  endStyles[cur + 1].push({
                    start: start,
                    styles: remainingMatchTable['\0'].map((idx: number) => `fflMatch${idx}-${fflLitSelectorsClassNames[idx as number]}`)
                  });
                }
              }
            }
          }
        }
        /// mark style groupings
        var latexWithMarkers: any[] = [];
        for (var i = 0; i <= latex.length; i++) {
          if (endStyles[i]) {
            latexWithMarkers.push(
              ...endStyles[i]
                .flatMap((e: { start: number, styles: string[] }) => e.styles.map((sty, idx, arr) => [e.start, sty]))
                .sort().reverse().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => `\\fflMarker{endStyle{${val[1]}}}`)
            );
          }
          if (startStyles[i]) {
            latexWithMarkers.push(
              ...startStyles[i]
                .flatMap((e: { end: number, styles: string[] }) => e.styles.map((sty, idx, arr) => [e.end, sty]))
                .sort().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => `\\fflMarker{startStyle{${val[1]}}}`)
            );
          }
          latexWithMarkers.push(latex[i]?.text ?? '');
        }
        /// fix groupings at markers after _/^, add markers for special classes
        function __markGroups(idx: number, clazz: string) {
          let isGroup = latexWithMarkers[idx] == '{';
          if (!isGroup) latexWithMarkers.splice(idx, 0, "{");
          latexWithMarkers.splice(++idx, 0, `\\fflMarker{startStyle{${clazz}}}`);
          while (latexWithMarkers[idx].startsWith("\\fflMarker")) idx++;
          if (isGroup) {
            let openGroups = 0;
            while (openGroups >= 0 && idx < latexWithMarkers.length) {
              let clazz = latexWithMarkers[idx] == '^' ? "superscript"
                : latexWithMarkers[idx] == '_' ? "subscript"
                  : latexWithMarkers[idx] == '\\frac' ? "frac"
                    : undefined;
              if (clazz) {
                let endGroup = __markGroups(idx + 1, clazz == "frac" ? "numerator" : clazz);
                if (clazz == "frac") endGroup = __markGroups(endGroup, "denominator");
                idx = endGroup;
              } else {
                idx++;
              }
              switch (latexWithMarkers[idx]) {
                case '{': openGroups++; break;
                case '}': openGroups--; break;
              }
            }
          } else {
            while (latexWithMarkers[++idx].startsWith("\\fflMarker{endStyle"));
          }
          latexWithMarkers.splice(idx++, 0, `\\fflMarker{endStyle{${clazz}}}`);
          if (!isGroup) latexWithMarkers.splice(idx, 0, "}");
          return idx + 1;
        }
        for (var i = 0; i < latexWithMarkers.length; i++) {
          let clazz = latexWithMarkers[i] == '^' ? "superscript"
            : latexWithMarkers[i] == '_' ? "subscript"
              : latexWithMarkers[i] == '\\frac' ? "frac"
                : undefined;
          if (clazz) {
            i = __markGroups(i + 1, clazz == "frac" ? "numerator" : clazz);
            if (clazz == "frac") i = __markGroups(i, "denominator");
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
        var labels: { selector: string, labelText: string }[] = [];
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
            ).map((grpStr: string) => `.ffl-${sectionId} ${grpStr}.visible`).join(', ');
            // preprocess labels here
            return `${classString} {\n${Object.entries(styleBlock.attributes).map(([k, v]) => {
              if (k == 'label') {
                labels.push({
                  selector: classString,
                  labelText: v as string,
                });
                k = '--ffl-label';
              }
              return `${k}: ${Array.isArray(v) ? v.join(' ') : v};`;
            }).join('\n')}\n}`;
          }
        ).join('\n');
        return `{\\fflMarker{startInvoc{${sectionId}}}\\fflMarker{styleString{${styleString}}}
          ${labels.map(({ selector, labelText }) => `\\fflMarker{label{${selector}}{${labelText}}}`).join('')}
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

// TODO: figure out how to use the reexported types, maybe use an actual .d.ts file instead of reexport
function __transformKaTeXHTML(root: any, katexHtmlMain: any, classesState?: string[]) {
  if (katexHtmlMain) { // TODO: figure out why there is an empty element at end of input, perhaps due to removal during the loop
    classesState ??= [];
    if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
      katexHtmlMain.classes = [katexHtmlMain.classes];
    for (var i = 0; i <= (katexHtmlMain.children ?? []).length; i++) {
      var childNode = (katexHtmlMain.children ?? [])[i], ffl;
      if (ffl = __getFFLMarker(childNode)) {
        switch (ffl.command) {
          case "startInvoc": katexHtmlMain.classes.push(`ffl-${ffl.arg}`); break;
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
            classesState.push(`${ffl.arg}`); break;
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
    (katexHtmlMain.classes ??= []).push(...new Set(classesState));
    // FIXME: this condition might not be exhaustive, need better way to find "contentful" elements
    // the TODO above this function might be helpful. Worst case just remove the condition and label everything
    if (['mord', 'mbin', 'vlist', 'mspace', 'mopen', 'mclose', 'mpunct', 'mrel', 'mop']
      .some(cls => katexHtmlMain.classes?.includes(cls))) {
      (katexHtmlMain.classes ??= []).push('visible');
    }
  }
}

function __renderToHTMLTree(expression: string, options?: KatexOptions): any {
  var htmlTree = reexport.katex.__renderToHTMLTree(expression, overrideOptions(options));
  var katexHtmlMain = htmlTree.children.find((span: any) => span.classes.includes("katex-html"));
  __transformKaTeXHTML(htmlTree, katexHtmlMain);
  return htmlTree;
}

function draw(nodes: labella.Node[], canvas: SVGElement) {
  nodes.forEach((node) => {
    node.data.labelText.setAttribute('x', `${node.x! + node.dx! / 2}`);
    node.data.labelText.setAttribute('dx', `${node.dx}`);
    node.data.labelText.setAttribute('y', `${node.y! + node.dy! / 2}`);
    node.data.labelText.setAttribute('dy', `${node.dy}`);
    canvas.appendChild(node.data.labelText);
  });
}

function __drawLabelGroup(labelInfo: { symbolBoundingBox?: BoundingBox, labelText: SVGTextElement }[],
  root: HTMLElement, rootBoundingBox: BoundingBox, direction?: "up" | "down") {

  var labelsOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  labelInfo.forEach((nodeInfo) => labelsOverlay.appendChild(nodeInfo.labelText));
  root.prepend(labelsOverlay);

  let force = new labella.Force({
    minPos: null, nodeSpacing: 12
  }).nodes(labelInfo.map(info => new labella.Node(
    info.symbolBoundingBox!.center.horizontal,
    info.labelText.getBBox().width,
    info
  ))).compute();
  let nodes = force.nodes();

  let nodeHeight = 12;
  var renderer = new labella.Renderer({
    layerGap: 16,
    nodeHeight,
    direction
  });
  renderer.layout(nodes);

  var viewBox = BoundingBox.of(...nodes.map((node, idx) => {
    let bBox: any = labelInfo[idx].labelText.getBBox();
    return new BoundingBox({
      top: node.y! - bBox.height,
      left: node.x! - bBox.width / 2,
      bottom: node.y! + bBox.height,
      right: node.x! + bBox.width / 2,
    });
  }), rootBoundingBox.relativeTo(rootBoundingBox))!;

  let anchorLineY = direction == "up" ? 0 : rootBoundingBox.height;
  Object.assign(labelsOverlay.style, {
    position: 'absolute',
    top: viewBox.top - nodeHeight / 2 + anchorLineY,
    left: viewBox.left,
    width: viewBox.width,
    height: viewBox.height + nodeHeight
  });
  labelsOverlay.setAttribute('viewBox',
    `${viewBox.left} ${viewBox.top - nodeHeight / 2 + anchorLineY} ${viewBox.width} ${viewBox.height + nodeHeight / 2}`);

  nodes.forEach((node) => {
    node.data.labelText.setAttribute('x', `${node.x! - node.dx! / 2}`);
    node.data.labelText.setAttribute('width', `${node.dx!}`);
    node.data.labelText.setAttribute('y', `${node.y}`);
    node.data.labelText.setAttribute('height', `${node.dy!}`);
    node.data.labelText.setAttribute('dy', `${anchorLineY}`);
    if (direction == 'down') node.data.labelText.setAttribute('dominant-baseline', `hanging`);
    let path: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',
      `M ${node.data.symbolBoundingBox.center.horizontal} `
      + `${direction == "up" ? node.data.symbolBoundingBox.top : (node.data.symbolBoundingBox.bottom - anchorLineY)} L`
      + renderer.generatePath(node).slice(1));
    path.setAttribute('transform', `translate(0, ${anchorLineY - nodeHeight / 2})`);
    Object.assign(path.style, { stroke: 'black', fill: 'none' });
    labelsOverlay.appendChild(path);
  });
}

function __drawLabels(labels: { selector: string, label: string }[], root: HTMLElement) {
  // need to make sure element is rendered to find the bounding box
  document.body.appendChild(root); // root is not guaranteed to be already in the tree, so we append our own first
  let visibility = __setVisible(root);
  let rootBoundingBox = new BoundingBox(root.getBoundingClientRect());
  let labelInfo = labels.map(({ selector, label }) => {
    let elements: Element[] = [...root.querySelectorAll(selector)];
    let labelText: SVGTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.textContent = label;
    return {
      symbolBoundingBox: BoundingBox.of(
        ...elements.map(node => new BoundingBox(node.getBoundingClientRect()))
      )?.relativeTo(rootBoundingBox), // we use relative coords since our element could be attached anywhere once returned
      labelText
    };
  }).filter(info => info.symbolBoundingBox);
  let center = rootBoundingBox.relativeTo(rootBoundingBox).center;
  let [bottom, top] = partition(labelInfo, info => info.symbolBoundingBox?.center.vertical! >= center.vertical);
  root.style.position = 'relative';
  if (bottom) __drawLabelGroup(bottom, root, rootBoundingBox, "down");
  if (top) __drawLabelGroup(top, root, rootBoundingBox, "up");
  __resetVisibility(root, visibility);
}

class ffl implements katex {
  static render(expression: string, baseNode: HTMLElement, options?: KatexOptions): void {
    let htmlTree = __renderToHTMLTree(expression, options);
    let htmlNode = htmlTree.toNode();
    if (htmlTree.ffl?.labels) __drawLabels(htmlTree.ffl.labels, htmlNode);

    baseNode.textContent = "";
    baseNode.appendChild(htmlNode);
  }

  /**
   * no labeling support here until we backport it to plain HTML
   */
  static renderToString(expression: string, options?: KatexOptions): string {
    return __renderToHTMLTree(expression, options).toMarkup();
  }
}

export default ffl;
