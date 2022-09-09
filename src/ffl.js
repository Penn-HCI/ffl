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
const reexport_1 = __importDefault(require("./reexport"));
const grammar = __importStar(require("./grammar"));
const lodash_1 = __importDefault(require("lodash"));
const utils_1 = require("./utils");
const __fflPrefix = "\\ffl@";
function overrideOptions(options) {
    options ??= { macros: {} };
    return {
        ...options,
        throwOnError: false,
        macros: {
            ...options.macros, "\\ffl": (context) => {
                // FIXME: this is too monolithic, refactoring needed
                var [fflTokens, latex] = context.consumeArgs(2);
                // parse FFL, (hacky:) copy tokenized literal selectors
                // TODO: double check escape tokenization
                var fflString = "", fflLitSelectors = [], fflParse;
                var tok, litMode = false, litTokens = [];
                while (tok = fflTokens.pop()) {
                    if (tok.text == '$') {
                        litMode = !litMode;
                        if (litMode)
                            litTokens = [];
                        else
                            fflLitSelectors.push(litTokens);
                    }
                    else if (litMode) {
                        litTokens.push(tok);
                    }
                    fflString += tok.text;
                }
                try {
                    fflParse = grammar.parse(fflString, { startRule: "blocks" });
                    console.log(fflParse);
                }
                catch (error) {
                    // FIXME: error reporting doesn't always work
                    let grammarError = error;
                    return `\\texttt{\\textbackslash ffl\\{}{\\color{red}{
            \\verb!${fflString.slice(0, grammarError.location?.start.offset)}!
            \\underbrace{\\verb!${fflString.slice(grammarError.location?.start.offset, grammarError.location?.end.offset)}!}
            _{\\mathclap{\\text{${grammarError.location?.start.line}:${grammarError.location?.start.column}: 
              ${grammarError.message.replaceAll(/\\/g, "\\textbackslash ").replaceAll(/([&%$#_\{\}~])/g, "\\$&")}
            }}}\\verb!${fflString.slice(grammarError.location?.end.offset)}!
            }}{\\texttt{\\}\\{}${latex.reverse().map(tok => tok.text).join("")}\\texttt{\\}}}`;
                }
                // convert literal selectors to token state maps, removing spaces
                fflLitSelectors = Object.entries(fflLitSelectors.map(sel => sel.map(tok => tok.text).filter(txt => !(0, utils_1.__isWhitespace)(txt))));
                function __collapse(arr) {
                    return lodash_1.default.mapValues((0, utils_1.__mapGroup)(arr, ent => ent[1][0] ?? '\0', ent => [ent[0], ent[1].slice(1)]), (grp, key, _o) => key != '\0' ? __collapse(grp) : grp.map((idx) => idx[0]));
                }
                let fflLitSelectorsMap = __collapse(fflLitSelectors);
                // mark all matches for literal selectors
                var startStyles = [];
                var endStyles = [];
                latex = latex.reverse();
                // is there a better matching algo? maybe should have kept the array format
                // note our grammar does not allow empty selectors
                for (var start = 0; start < latex.length; start++) {
                    let remainingMatchTable = fflLitSelectorsMap;
                    for (var cur = start; cur < latex.length; cur++) {
                        var tok = latex[cur].text;
                        if (!(0, utils_1.__isWhitespace)(tok)) {
                            if (!(Object.hasOwn(remainingMatchTable, tok)
                                || Object.hasOwn(remainingMatchTable, '\\?')
                                || Object.hasOwn(remainingMatchTable, '\\*'))) {
                                break;
                            }
                            else {
                                // TODO: handle escapes ('\$')
                                // FIXME: wildcard '\*' still has weird behaviors
                                const __merge_cont_style = function (map, arr) {
                                    return arr ? { ...Object.assign({}, map), '\0': arr } : map;
                                };
                                const __merge_style_arrs = function (arr1, arr2) {
                                    if (!arr1)
                                        arr1 = [];
                                    if (!Array.isArray(arr1))
                                        arr1 = [arr1];
                                    return arr1.concat(arr2);
                                };
                                // merging all possible states after wildcard
                                var newRemainingMatchTable = (0, utils_1.__merge)(remainingMatchTable[tok], remainingMatchTable['\\?'] ?? {}, __merge_cont_style, __merge_style_arrs);
                                if (remainingMatchTable['\\*']) {
                                    newRemainingMatchTable =
                                        (0, utils_1.__merge)(newRemainingMatchTable, remainingMatchTable['\\*'] ?? {}, __merge_cont_style, __merge_style_arrs);
                                    newRemainingMatchTable =
                                        (0, utils_1.__merge)(newRemainingMatchTable, { '\\*': remainingMatchTable['\\*'] }, __merge_cont_style, __merge_style_arrs);
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
                var latexWithMarkers = [];
                var fflLitSelectorsClassNames = fflLitSelectors.map((val, idx, arr) => val[1].join("").replaceAll(/[^-_A-Za-z]/g, '_'));
                for (var i = 0; i < latex.length; i++) {
                    if (endStyles[i]) {
                        latexWithMarkers.push(...endStyles[i]
                            .flatMap((e) => e.styles.map((sty, idx, arr) => [e.start, sty]))
                            .sort().reverse().filter((v, i, a) => a.indexOf(v) === i)
                            .map((val) => `\\fflMarker{endStyle{${val[1]}-${fflLitSelectorsClassNames[val[1]]}}}`));
                    }
                    if (startStyles[i]) {
                        latexWithMarkers.push(...startStyles[i]
                            .flatMap((e) => e.styles.map((sty, idx, arr) => [e.end, sty]))
                            .sort().filter((v, i, a) => a.indexOf(v) === i)
                            .map((val) => `\\fflMarker{startStyle{${val[1]}-${fflLitSelectorsClassNames[val[1]]}}}`));
                    }
                    latexWithMarkers.push(latex[i].text);
                }
                // fix groupings at markers after _/^
                for (var i = 0; i < latexWithMarkers.length; i++) {
                    if ((latexWithMarkers[i] == '_' || latexWithMarkers[i] == '^')
                        && (latexWithMarkers[i + 1] ?? '').startsWith("\\fflMarker")) {
                        latexWithMarkers.splice(++i, 0, "{");
                        let toClose = i + 1;
                        while (latexWithMarkers[toClose].startsWith("\\fflMarker"))
                            toClose++;
                        let openGroups = latexWithMarkers[toClose] == '{' ? 1 : 0;
                        while (openGroups > 0) {
                            switch (latexWithMarkers[++toClose]) {
                                case '{':
                                    openGroups++;
                                    break;
                                case '}':
                                    openGroups--;
                                    break;
                            }
                        }
                        while (latexWithMarkers[toClose].startsWith("\\fflMarker"))
                            toClose++;
                        latexWithMarkers.splice(toClose + 1, 0, "}");
                    }
                }
                console.log(latexWithMarkers.join(''));
                // register styles, CSS only for now
                let sectionId = self.crypto.randomUUID();
                let fflLitSelectorsRevMap = Object.fromEntries(fflLitSelectors.map(val => [val[1].join(''), val[0]]));
                // this below needs to get clean up (too many nested call backs)
                let styleString = fflParse.map((styleBlock) => {
                    let classString = styleBlock.selectors.map((selectorGroups) => selectorGroups.map((singleSelector) => {
                        if (singleSelector.type == 'literal') {
                            let idx = fflLitSelectorsRevMap[singleSelector.str.replaceAll(/[ \t\r\n\v\f]/g, '')];
                            return `.fflMatch${idx}-${fflLitSelectorsClassNames[idx]}`;
                        }
                        if (singleSelector.type == 'class') {
                            return `.${singleSelector.str}`;
                        }
                    }).join('')).map((grpStr) => `.ffl-${sectionId} ${grpStr}`).join(', ');
                    // preprocess labels here
                    return `${classString} {\n${Object.entries(styleBlock.attributes).map(([k, v]) => {
                        return `${k}: ${Array.isArray(v) ? v.join(' ') : v};`;
                    }).join('\n')}\n}`;
                }).join('\n');
                return `{\\fflMarker{startInvoc{${sectionId}}}\\fflMarker{styleString{${styleString}}}
                  {${latexWithMarkers.join('')}}\\fflMarker{endInvoc{${sectionId}}}}`;
            },
            '\\fflMarker': (context) => {
                var arg = context.consumeArg();
                var tok = arg.start.range(arg.end, `${__fflPrefix}${arg.tokens.reverse().map((tok) => tok.text).join('').trim()}`);
                tok.noexpand = true;
                return { numArgs: 0, tokens: [tok], unexpandable: true };
            }
        }
    };
}
function __getFFLMarker(node) {
    if (['mord', 'text'].every((name) => (node.classes ?? []).includes(name))
        && node.children[0].text.startsWith(__fflPrefix)) {
        let ffl = node.children[0].text.replace(new RegExp(`^${__fflPrefix.replaceAll("\\", "\\\\")}`), "").trim();
        let argIdx = ffl.indexOf("{");
        return {
            command: ffl.slice(0, argIdx),
            arg: ffl.slice(argIdx + 1, -1), // all of our markers should have single arg and no surrounding space
            // more advanced parsing could be done here or in \fflMarker macro impl if this is not enough
        };
    }
    else {
        return undefined;
    }
}
function __asKaTeXVirtualNode(element) {
    return new Proxy(element, {
        get(target, prop, receiver) {
            switch (prop) {
                case "hasClass": return target.classList.contains;
                case "toNode": return () => target;
                case "toMarkup": return () => target.outerHTML;
            }
            return Reflect.get(target, prop, receiver);
        },
    });
}
// TODO: figure out how to use the reexported types
function __transformKaTeXHTML(root, katexHtmlMain, classesState) {
    if (katexHtmlMain) { // temp fix for empty element at the end of input
        classesState ??= [];
        if (katexHtmlMain.classes && !Array.isArray(katexHtmlMain.classes))
            katexHtmlMain.classes = [katexHtmlMain.classes];
        (katexHtmlMain.classes ??= []).push(...classesState);
        for (var i = 0; i < (katexHtmlMain.children ?? []).length; i++) {
            var childNode = katexHtmlMain.children[i], ffl;
            if (ffl = __getFFLMarker(childNode)) {
                switch (ffl.command) {
                    case "startInvoc":
                        katexHtmlMain.classes.push(`ffl-${ffl.arg}`);
                        break;
                    case "styleString":
                        var style = document.createElement('style');
                        style.appendChild(document.createTextNode(ffl.arg.replaceAll('\xA0', '\x20')));
                        (root.children ??= []).push(__asKaTeXVirtualNode(style));
                        break;
                    case "startStyle":
                        if (!classesState.includes(`fflMatch${ffl.arg}`))
                            classesState.push(`fflMatch${ffl.arg}`);
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
                __transformKaTeXHTML(root, childNode, classesState);
            }
        }
    }
}
function __renderToHTMLTree(expression, options) {
    var htmlTree = reexport_1.default.katex.__renderToHTMLTree(expression, overrideOptions(options));
    var katexHtmlMain = htmlTree.children.find((span) => span.classes.includes("katex-html"));
    __transformKaTeXHTML(htmlTree, katexHtmlMain);
    return htmlTree;
}
class ffl {
    static render(expression, baseNode, options) {
        baseNode.textContent = "";
        baseNode.appendChild(__renderToHTMLTree(expression, options).toNode());
    }
    static renderToString(expression, options) {
        return __renderToHTMLTree(expression, options).toMarkup();
    }
}
exports.default = ffl;
