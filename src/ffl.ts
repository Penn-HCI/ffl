import katex, { KatexOptions, ParseError } from 'katex';
import reexport from "./reexport";
import * as grammar from "./grammar";
import _, { partition } from "lodash";
import { isServer, isWhitespace, resetVisibility, setVisible, toHTMLElement, toKaTeXVirtualNode, BoundingBox } from './utils';
import * as labella from 'labella';
import { TokenTree, parseAtomics } from './groupParser';
import { v4 as uuidv4 } from 'uuid';

// TODO: lift out more shared constants
const fflPrefix = "\\ffl@";
const fflMarkerCmd = "\\fflMarker";
function fflMarker(s: string): string { return `${fflMarkerCmd}{${s}}`; }

// TODO: this is inefficient, we need better representations
function markMatches(src: TokenTree[], matchers: { key: string, matcher: TokenTree[] }[], wildcardSingle: string, wildcardAny: string) {
  var source = _.cloneDeep(src);
  var startStyles: { [idx: number]: { end: number, style: string }[] } = {};
  var endStyles: { [idx: number]: { start: number, style: string }[] } = {};
  let matchTableState: { startIdx?: number, key: string, matcher: TokenTree }[] = [];

  function match(selector: TokenTree, target: TokenTree): boolean {
    if ([target, wildcardSingle, wildcardAny].some(tok => selector === tok)) return true;
    if (Array.isArray(selector) && Array.isArray(target)) {
      var matchState = [[...selector]]; // clones
      for (var i = 0; i < target.length; i++) {
        if (!(typeof target[i] === 'string' && isWhitespace(target[i] as string))) {
          matchState.push(...matchState.filter(selector => selector[0] === wildcardAny)
            .map(selector => selector.slice(1)));
          matchState = [
            ...matchState.filter(selector => match(selector[0], target[i]))
              .map(selector => selector.slice(1)),
            ...matchState.filter(selector => selector[0] == wildcardAny)
          ];
        }
      }
      return matchState.some(m => m.length == 0);
    }
    return false;
  }

  for (var idx = 0; idx < source.length; idx++) {
    var tok = source[idx];
    if (!(typeof tok === 'string' && isWhitespace(tok))) {
      matchTableState.push(...matchers,
        ...matchTableState.filter(matcher => matcher.matcher[0] === wildcardAny)
          .map(matcher => { return { ...matcher, matcher: matcher.matcher.slice(1) }; }));
      matchTableState = [
        ...matchTableState.filter(matcher => match(matcher.matcher[0], tok))
          .map(matcher => { return { ...matcher, matcher: matcher.matcher.slice(1) }; }),
        ...matchTableState.filter(matcher => matcher.matcher[0] === wildcardAny),
      ].map(matcher => {
        return { ...matcher, startIdx: matcher.startIdx ?? idx };
      });
      matchTableState.filter(matcher => matcher.matcher.length == 0 && matcher.startIdx !== undefined)
        .forEach(matcher => {
          startStyles[matcher.startIdx!] ??= [];
          startStyles[matcher.startIdx!].push({
            end: idx + 1,
            style: matcher.key
          });
          endStyles[idx + 1] ??= [];
          endStyles[idx + 1].push({
            start: matcher.startIdx!,
            style: matcher.key
          });
        });
    }
    if (Array.isArray(tok)) {
      (source as any[])[idx] = markMatches(tok, matchers, wildcardSingle, wildcardAny)
    }
  }
  /// mark style groupings
  var latexWithMarkers: any[] = [];
  for (var i = 0; i <= source.length; i++) {
    if (endStyles[i]) {
      latexWithMarkers.push(
        ...endStyles[i]
          .map((e: { start: number, style: string }) => [e.start, e.style])
          .sort().reverse().filter((v, i, a) => a.indexOf(v) === i)
          .map((val) => fflMarker(`endStyle{${val[1]}}`))
      );
    }
    if (startStyles[i]) {
      latexWithMarkers.push(
        ...startStyles[i]
          .map((e: { end: number, style: string }) => [e.end, e.style])
          .sort().filter((v, i, a) => a.indexOf(v) === i)
          .map((val) => fflMarker(`startStyle{${val[1]}}`))
      );
    }
    if (source[i]) latexWithMarkers.push(source[i]);
  }
  // FIXME: if this is right after a macro we should insert {} but be mindful of _/^
  // How to distinguish macros with v.s. w/o argument
  return latexWithMarkers;
}

// note that this mutates the array
const __markConstants = function (latex: TokenTree): any[] {
  var tree = !Array.isArray(latex) ? [latex] : latex;
  for (var i = 0; i < tree.length; i++) {
    if (Array.isArray(tree[i])) {
      tree[i] = __markConstants(tree[i])
    } else {
      if ((tree[i] as string).match(/^\d+$/g)) {
        tree.splice(i, 0, fflMarker("startStyle{constant}"))
        do {
          i++;
        } while ((tree[i] as string).match(/^\d+$/g))
        tree.splice(i, 0, fflMarker("endStyle{constant}"))
      }
    }
  }
  return tree;
}

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
        var tok: any, litMode = false, litTokens: any[] = [];
        while (tok = fflTokens.pop()) {
          if (tok.text == '$') {
            litMode = !litMode; // this flipping is should be fine if ffl parses
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
          return fflMarker(`error{${JSON.stringify(error)}}`);
        }
        // working with strings from now on, until we find a good way to implement katex's Token interface
        var isOpenGroup = (tok: string) => tok == '{';
        var isCloseGroup = (tok: string) => tok == '}';
        latex = parseAtomics(latex.reverse().map(tok => tok.text), isOpenGroup, isCloseGroup);
        fflLitSelectors = fflLitSelectors.map((selector: any[], idx) => {
          let selectorTexts = selector.map(tok => tok.text);
          return {
            key: `fflMatch${idx}-${selectorTexts.join("").replaceAll(/[^-_A-Za-z]/g, '_')}`,
            matcher: parseAtomics(selectorTexts.filter(tok => !isWhitespace(tok)), isOpenGroup, isCloseGroup)
          };
        });
        let latexWithMarkers = markMatches(latex, fflLitSelectors, '\\?', '\\*');
        // TODO: flatten groups and mark classes
        function deepFlattenAndMark(tokens: TokenTree): string | string[] {
          if (Array.isArray(tokens)) {
            var ret: string[] = [];
            for (var i = 0; i < tokens.length; i++) {
              let tok = tokens[i];
              switch (tok) {
                case "^":
                  ret.push(tok, '{', fflMarker("startStyle{superscript}"),
                    ...deepFlattenAndMark(tokens[++i]),
                    fflMarker("endStyle{superscript}"), '}'); break;
                case "_":
                  ret.push(tok, '{', fflMarker("startStyle{subscript}"),
                    ...deepFlattenAndMark(tokens[++i]),
                    fflMarker("endStyle{subscript}"), '}'); break;
                case "\\frac":
                  ret.push(tok, '{', fflMarker("startStyle{numerator}"),
                    ...deepFlattenAndMark(tokens[++i]),
                    fflMarker("endStyle{numerator}"), '}');
                  ret.push('{', fflMarker("startStyle{denominator}"),
                    ...deepFlattenAndMark(tokens[++i]),
                    fflMarker("endStyle{denominator}"), '}');
                  break;
                default:
                  if (Array.isArray(tok)) ret.push('{', ...deepFlattenAndMark(tok), '}');
                  else ret.push(deepFlattenAndMark(tok) as string);
              }
            }
            return ret;
          } else {
            return tokens;
          }
        }
        let _latexWithMarkers = deepFlattenAndMark(latexWithMarkers);
        _latexWithMarkers = Array.isArray(_latexWithMarkers) ? _latexWithMarkers : [_latexWithMarkers];
        latexWithMarkers = __markConstants(_latexWithMarkers);
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
        let sectionId = uuidv4();
        // this below needs to get clean up (too many nested call backs)
        var labels: { selector: string, labelText: string }[] = [];
        var idx = 0;
        let styleString = fflParse.map(
          (styleBlock: any) => {
            let classString = styleBlock.selectors.map((selectorGroups: { type: string, str: string }[]) =>
              selectorGroups.map(
                (singleSelector: { type: string, str: string }) => {
                  if (singleSelector.type == 'literal') {
                    return `.${fflLitSelectors[idx++].key}`;
                  }
                  if (singleSelector.type == 'class') {
                    let className = singleSelector.str;
                    switch (className) {
                      case 'operator': className = 'mbin'; break;
                      default: break;
                    }
                    return `.${className}`;
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
        return `{${fflMarker(`startInvoc{${sectionId}}`)}${fflMarker(`styleString{${styleString}}`)}
          ${labels.map(({ selector, labelText }) => fflMarker(`label{${selector}}{${labelText}}`)).join('')}
          {${latexWithMarkers.join('')}}${fflMarker(`endInvoc{${sectionId}}`)}}`;
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

function getFFLMarker(node: any): any {
  if (['mord', 'text'].every((name) => (node?.classes ?? []).includes(name))
    && node.children[0].text.startsWith(fflPrefix)) {
    let ffl = node.children[0].text.replace(new RegExp(`^${fflPrefix.replaceAll("\\", "\\\\")}`), "").trim();
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
          case "styleString":
            (root.children ??= []).push(
              toKaTeXVirtualNode(`<style>${ffl.arg.replaceAll('\xA0', '\x20')}</style>`));
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
          case "error":
            throw JSON.parse(ffl.arg);
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

function renderToHTMLTree(expression: string, options?: KatexOptions): any {
  var htmlTree = reexport.katex.__renderToHTMLTree(expression, overrideOptions(options));
  var katexHtmlMain = htmlTree.children.find((span: any) => span.classes.includes("katex-html"));
  transformKaTeXHTML(htmlTree, katexHtmlMain);
  htmlTree.style.display = 'inline-block';
  return htmlTree;
}

function drawLabelGroup(labelInfo: { symbolBoundingBox?: BoundingBox, labelText: HTMLElement }[],
  root: HTMLElement, rootBoundingBox: BoundingBox, direction?: "up" | "down") {

  var labelsOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  let foreignObjects = labelInfo.map((nodeInfo) => {
    var foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    nodeInfo.labelText.setAttribute('xmlns', "http://www.w3.org/1999/xhtml");
    foreignObject.appendChild(nodeInfo.labelText);
    return foreignObject;
  });
  foreignObjects.forEach((node) => labelsOverlay.appendChild(node));
  root.prepend(labelsOverlay);

  let boundingRects = labelInfo.map((info) => {
    var range = document.createRange();
    range.selectNode(info.labelText);
    return range.getBoundingClientRect();
  });
  let force = new labella.Force({
    minPos: null, nodeSpacing: 12
  }).nodes(labelInfo.map((info, idx) => new labella.Node(
    info.symbolBoundingBox!.center.horizontal,
    boundingRects[idx].width,
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
    let bBox: any = boundingRects[idx];
    return new BoundingBox({
      top: node.y! - bBox.height,
      left: node.x! - bBox.width / 2,
      bottom: node.y! + bBox.height,
      right: node.x! + bBox.width / 2,
    });
  }), rootBoundingBox.relativeTo(rootBoundingBox))!;

  let anchorLineY = direction == "up" ? 0 : rootBoundingBox.height;
  if (direction === "up") {
    let style = root.getAttribute('style');
    if (style && !style.endsWith(';')) style += ';';
    root.setAttribute('style', style + ` margin-top: ${-viewBox.top - nodeHeight * 1.5}px;`);
  }
  if (direction === "down") {
    let style = root.getAttribute('style');
    if (style && !style.endsWith(';')) style += ';';
    root.setAttribute('style', style + ` margin-bottom: ${viewBox.bottom - rootBoundingBox.height + nodeHeight * 2}px;`);
  }

  Object.assign(labelsOverlay.style, {
    position: 'absolute',
    top: viewBox.top - nodeHeight / 2 + anchorLineY,
    left: viewBox.left,
    width: viewBox.width,
    height: viewBox.height + nodeHeight
  });
  labelsOverlay.setAttribute('viewBox',
    `${viewBox.left} ${viewBox.top - nodeHeight / 2 + anchorLineY} ${viewBox.width} ${viewBox.height + nodeHeight / 2}`);

  nodes.forEach((node, idx) => {
    foreignObjects[idx].setAttribute('overflow', 'visible');
    foreignObjects[idx].setAttribute('x', `${node.x! - node.dx! / 2}`);
    foreignObjects[idx].setAttribute('width', `${node.dx!}`);
    foreignObjects[idx].setAttribute('y', `${anchorLineY + node.y! -
      (direction === 'up' ? boundingRects[idx].height - node.dy! : node.dy! / 2)}`);
    foreignObjects[idx].setAttribute('height', `${node.dy!}`);
    if (direction == 'down') foreignObjects[idx].setAttribute('dominant-baseline', `hanging`);
    let path: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',
      `M ${node.data.symbolBoundingBox.center.horizontal} `
      + `${direction == "up" ? node.data.symbolBoundingBox.top - node.dy! / 2 : node.data.symbolBoundingBox.bottom - anchorLineY} L`
      + renderer.generatePath(node).slice(1));
    path.setAttribute('transform', `translate(0, ${anchorLineY - (direction == "up" ? 0 : 0)})`);
    Object.assign(path.style, { stroke: 'black', fill: 'none' });
    labelsOverlay.appendChild(path);
  });
}

function drawLabels(labels: { selector: string, label: string }[], root: HTMLElement) {
  // need to make sure element is rendered to find the bounding box
  document.body.appendChild(root); // root is not guaranteed to be already in the tree, so we append our own first
  let visibility = setVisible(root);
  let rootBoundingBox = new BoundingBox(root.getBoundingClientRect());
  let labelInfo = labels.map(({ selector, label }) => {
    let elements: Element[] = [...root.querySelectorAll(selector)];
    return {
      symbolBoundingBox: BoundingBox.of(
        ...elements.map(node => new BoundingBox(node.getBoundingClientRect()))
      )?.relativeTo(rootBoundingBox), // we use relative coords since our element could be attached anywhere once returned
      labelText: toHTMLElement(label)
    };
  }).filter(info => info.symbolBoundingBox);
  let center = rootBoundingBox.relativeTo(rootBoundingBox).center;
  let [bottom, top] = partition(labelInfo, info => info.symbolBoundingBox?.center.vertical! >= center.vertical);
  root.style.position = 'relative';
  if (bottom.length > 0) drawLabelGroup(bottom, root, rootBoundingBox, "down");
  if (top.length > 0) drawLabelGroup(top, root, rootBoundingBox, "up");
  resetVisibility(root, visibility);
}

/**
 * labels are only supported when running on browser client
 */
class ffl implements katex {
  static render(latex: string, ffl: string, baseNode: HTMLElement, options?: KatexOptions): void {
    let htmlTree = renderToHTMLTree(ffl ? `\\ffl{${ffl}}{${latex}}` : latex, options);
    let htmlNode = htmlTree.toNode();
    if (typeof window !== "undefined" && htmlTree.ffl?.labels)
      drawLabels(htmlTree.ffl.labels, htmlNode);

    baseNode.textContent = "";
    baseNode.appendChild(htmlNode);
  }

  // TODO: defer label drawing to a <script> tag on client side
  // (to be compatible VSCode which runs extension on server side)
  static renderToString(latex: string, ffl: string, options?: KatexOptions): string {
    let htmlTree = renderToHTMLTree(ffl ? `\\ffl{${ffl}}{${latex}}` : latex, options);
    if (!isServer() && htmlTree.ffl?.labels) {
      let htmlNode = toHTMLElement(htmlTree.toMarkup());
      drawLabels(htmlTree.ffl.labels, htmlNode);
      var htmlStr = htmlNode.outerHTML;
      htmlNode.remove();
      return htmlStr;
    } else {
      return htmlTree.toMarkup();
    }
  }

  static parseFFL(ffl: string) {
    return grammar.parse(ffl, { startRule: "blocks" });
  }
}

export default ffl;
