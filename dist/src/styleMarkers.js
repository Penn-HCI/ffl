"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flatten = exports.markClasses = exports.markConstants = exports.markMatches = exports.getFFLMarker = exports.fflMarker = exports.fflMarkerCmd = exports.fflPrefix = void 0;
const lodash_1 = __importDefault(require("lodash"));
const utils_1 = require("./utils");
// TODO: lift out more shared constants
exports.fflPrefix = "\\ffl@";
exports.fflMarkerCmd = "\\fflMarker";
function fflMarker(cmd, ...arg) { return `${exports.fflMarkerCmd}{${cmd}{${arg.join('}{')}}}`; }
exports.fflMarker = fflMarker;
function getFFLMarker(node) {
    var _a, _b;
    if (['mord', 'text'].every((name) => { var _a; return ((_a = node === null || node === void 0 ? void 0 : node.classes) !== null && _a !== void 0 ? _a : []).includes(name); })
        && ((_b = (_a = node.children[0]) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '').startsWith(exports.fflPrefix)) {
        let ffl = node.children[0].text.replace(new RegExp(`^${exports.fflPrefix.replaceAll("\\", "\\\\")}`), "").trim();
        let argIdx = ffl.indexOf("{");
        return {
            command: ffl.slice(0, argIdx),
            arg: ffl.slice(argIdx + 1, -1), // all of our markers are assumed to have single arg and no surrounding space
            // more advanced parsing could be done here or in \fflMarker macro impl if this is not enough
            // label has two args but first arg is a CSS query string which does not have '}{'
        };
    }
    else {
        return undefined;
    }
}
exports.getFFLMarker = getFFLMarker;
// TODO: this is inefficient, we need better representations
function markMatches(src, matchers, wildcardSingle, wildcardAny, escapes) {
    var source = lodash_1.default.cloneDeep(src);
    var startStyles = {};
    var endStyles = {};
    let matchTableState = [];
    function match(selector, target) {
        if ([target, wildcardSingle, wildcardAny].some(tok => lodash_1.default.isEqual(selector, tok))
            || lodash_1.default.isEqual(target, escapes[selector]))
            return true;
        if (Array.isArray(selector) && Array.isArray(target)) {
            var matchState = [[...selector]]; // clones
            for (var i = 0; i < target.length; i++) {
                if (!(typeof target[i] === 'string' && (0, utils_1.isWhitespace)(target[i]))) {
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
        if (!(typeof tok === 'string' && (0, utils_1.isWhitespace)(tok))) {
            matchTableState.push(...matchers, ...matchTableState.filter(matcher => matcher.matcher[0] === wildcardAny)
                .map(matcher => { return Object.assign(Object.assign({}, matcher), { matcher: matcher.matcher.slice(1) }); }));
            matchTableState = [
                ...matchTableState.filter(matcher => match(matcher.matcher[0], tok))
                    .map(matcher => { return Object.assign(Object.assign({}, matcher), { matcher: matcher.matcher.slice(1) }); }),
                ...matchTableState.filter(matcher => matcher.matcher[0] === wildcardAny),
            ].map(matcher => {
                var _a;
                return Object.assign(Object.assign({}, matcher), { startIdx: (_a = matcher.startIdx) !== null && _a !== void 0 ? _a : idx });
            });
            matchTableState.filter(matcher => matcher.matcher.length == 0 && matcher.startIdx !== undefined)
                .forEach(matcher => {
                var _a, _b;
                var _c, _d;
                (_a = startStyles[_c = matcher.startIdx]) !== null && _a !== void 0 ? _a : (startStyles[_c] = []);
                startStyles[matcher.startIdx].push({
                    end: idx + 1,
                    style: matcher.key
                });
                (_b = endStyles[_d = idx + 1]) !== null && _b !== void 0 ? _b : (endStyles[_d] = []);
                endStyles[idx + 1].push({
                    start: matcher.startIdx,
                    style: matcher.key
                });
            });
        }
        if (Array.isArray(tok)) {
            source[idx] = markMatches(tok, matchers, wildcardSingle, wildcardAny, escapes);
        }
    }
    /// mark style groupings
    var latexWithMarkers = [];
    for (var i = 0; i <= source.length; i++) {
        if (endStyles[i]) {
            latexWithMarkers.push(...endStyles[i]
                .map((e) => [e.start, e.style])
                .sort().reverse().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => fflMarker("endStyle", val[1])));
        }
        if (startStyles[i]) {
            latexWithMarkers.push(...startStyles[i]
                .map((e) => [e.end, e.style])
                .sort().filter((v, i, a) => a.indexOf(v) === i)
                .map((val) => fflMarker("startStyle", val[1])));
        }
        if (source[i])
            latexWithMarkers.push(source[i]);
    }
    // FIXME: if this is right after a macro we should insert {} but be mindful of _/^
    // How to distinguish macros with v.s. w/o argument
    return latexWithMarkers;
}
exports.markMatches = markMatches;
// note that this mutates the array
function markConstants(latex) {
    var _a, _b;
    var tree = !Array.isArray(latex) ? [latex] : latex;
    for (var i = 0; i < tree.length; i++) {
        if (Array.isArray(tree[i])) {
            tree[i] = markConstants(tree[i]);
        }
        else {
            if (((_a = tree[i]) !== null && _a !== void 0 ? _a : '').match(/^\d+$/g)) {
                tree.splice(i, 0, fflMarker("startStyle", "constant"));
                do {
                    i++;
                } while (((_b = tree[i]) !== null && _b !== void 0 ? _b : '').match(/^\d+$/g));
                tree.splice(i, 0, fflMarker("endStyle", "constant"));
            }
        }
    }
    return tree;
}
exports.markConstants = markConstants;
const classes = {
    '^': ['superscript'],
    '_': ['subscript'],
    '\\text': ['text'],
    '\\frac': ['numerator', 'denominator'],
};
function markClasses(tokens) {
    var _a, _b;
    let _tokens = lodash_1.default.cloneDeep(tokens);
    if (Array.isArray(_tokens)) {
        var ret = [];
        var tok;
        while (tok = _tokens.pop()) {
            if (Array.isArray(tok)) {
                ret.push(markClasses(tok));
            }
            else {
                let cmdClasses = classes[tok];
                let expandedArgs = [];
                for (var j = 0; j < ((_a = cmdClasses === null || cmdClasses === void 0 ? void 0 : cmdClasses.length) !== null && _a !== void 0 ? _a : 0); j++) {
                    let arg = (_b = ret.pop()) !== null && _b !== void 0 ? _b : [];
                    if (!Array.isArray(arg))
                        arg = [arg];
                    expandedArgs.push([
                        fflMarker("startStyle", cmdClasses[j]),
                        ...arg,
                        fflMarker("endStyle", cmdClasses[j])
                    ]);
                }
                ret.push(...expandedArgs.reverse(), tok);
            }
        }
        return ret.reverse();
    }
    else {
        return _tokens;
    }
}
exports.markClasses = markClasses;
function flatten(tokens) {
    if (Array.isArray(tokens)) {
        return ['{', ...tokens.map(flatten), '}'].flat();
    }
    else {
        return tokens;
    }
}
exports.flatten = flatten;
//# sourceMappingURL=styleMarkers.js.map