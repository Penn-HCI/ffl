import _ from "lodash";
import { isWhitespace } from "../utils/common";
// TODO: lift out more shared constants
export const fflPrefix = "\\ffl@";
export const fflMarkerCmd = "\\fflMarker";
export function fflMarker(cmd, ...arg) {
    return `${fflMarkerCmd}{${cmd}{${arg.join('}{')}}}`;
}
export function getFFLMarker(node) {
    if (['mord', 'text'].every((name) => (node?.classes ?? []).includes(name))
        && (node.children[0]?.text ?? '').startsWith(fflPrefix)) {
        let ffl = node.children[0].text.replace(new RegExp(`^${fflPrefix.replaceAll("\\", "\\\\")}`), "").trim();
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
export function markMatches(src, matchers, wildcardSingle, wildcardAny, escapes, instanceCounts) {
    var source = _.cloneDeep(src);
    var startStyles = {};
    var endStyles = {};
    let matchTableState = [];
    instanceCounts ??= {};
    function match(selector, target) {
        if ([target, wildcardSingle, wildcardAny].some(tok => _.isEqual(selector, tok))
            || _.isEqual(target, escapes[selector]))
            return true;
        if (Array.isArray(selector) && Array.isArray(target)) {
            var matchState = [[...selector]]; // clones
            for (var i = 0; i < target.length; i++) {
                if (!(typeof target[i] === 'string' && isWhitespace(target[i]))) {
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
            matchTableState.push(...matchers, ...matchTableState.filter(matcher => matcher.matcher[0] === wildcardAny)
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
                if (!(['^', '_'].includes(source[idx + 1])
                    && ['^', '_'].some(t => source.slice(matcher.startIdx, idx + 1).includes(t)))) {
                    startStyles[matcher.startIdx] ??= [];
                    startStyles[matcher.startIdx].unshift({
                        end: idx + 1,
                        style: matcher.key
                    });
                    endStyles[idx + 1] ??= [];
                    endStyles[idx + 1].push({
                        start: matcher.startIdx,
                        style: matcher.key
                    });
                }
            });
        }
    }
    for (var idx = 0; idx < source.length; idx++) {
        let tok = source[idx];
        if (Array.isArray(tok)) {
            source[idx] =
                markMatches(tok, matchers, wildcardSingle, wildcardAny, escapes, instanceCounts);
        }
    }
    // some duplicate work over here de-duping the match ranges
    // could do this in the previous loop to optimize once finalized
    // FIXME: this the finds the longest match starting at each idx
    // this will not work if we add non-greedy matches
    var styles = {};
    var markers = [];
    for (var idx = 0; idx <= source.length; idx++) {
        (startStyles[idx] ?? []).forEach(({ style, end }) => {
            instanceCounts[style] ??= 0;
            styles[idx] ??= {};
            Object.assign(styles[idx], {
                [style]: { instanceIdx: instanceCounts[style]++ }
            });
            if (!styles[idx][style].end || end > styles[idx][style].end)
                styles[idx][style].end = end;
        });
        if (styles[idx]) {
            Object.entries(styles[idx]).forEach(([style, { instanceIdx, end }]) => {
                (markers[idx] ??= []).push(fflMarker("startStyle", style, instanceIdx.toString()));
                (markers[end] ??= []).unshift(fflMarker("endStyle", style, instanceIdx.toString()));
            });
        }
    }
    var latexWithMarkers = [];
    for (var i = 0; i <= source.length; i++) {
        if (markers[i])
            latexWithMarkers.push(...markers[i]);
        if (source[i])
            latexWithMarkers.push(source[i]);
    }
    return latexWithMarkers;
}
// note that this mutates the array
export function markConstants(latex, counter) {
    var tree = _.clone(latex);
    counter ??= { count: 0 };
    if (Array.isArray(tree)) {
        for (var i = 0; i < tree.length; i++) {
            if (Array.isArray(tree[i])) {
                tree[i] = markConstants(tree[i], counter);
            }
            else {
                if (!Number.isNaN(parseFloat(tree[i]))) {
                    let count = counter.count++;
                    tree.splice(i, 0, fflMarker("startStyle", "constant", count.toString()));
                    do {
                        i++;
                    } while (!Number.isNaN(parseFloat(tree[i])));
                    tree.splice(i, 0, fflMarker("endStyle", "constant", count.toString()));
                }
            }
        }
    }
    else {
        if (!Number.isNaN(parseFloat(tree))) {
            let count = counter.count++;
            tree = [
                fflMarker("startStyle", "constant", count.toString()),
                tree,
                fflMarker("endStyle", "constant", count.toString())
            ];
        }
    }
    return tree;
}
export function markDoubleGroups(latex, counter, markRoot) {
    var tree = latex;
    let ret = tree;
    if ((markRoot ??= true))
        tree = Array.isArray(latex) ? [latex] : [[latex]];
    if (Array.isArray(tree)) {
        counter ??= { count: 0 };
        ret = [];
        let isDoubleGroup = tree.length == 1 && Array.isArray(tree[0]);
        let count = counter.count;
        if (isDoubleGroup) {
            count = counter.count++;
            ret.push(fflMarker("startStyle", "ffl-group", count.toString()));
        }
        tree.forEach(t => ret.push(markDoubleGroups(t, counter, false)));
        if (isDoubleGroup) {
            ret.push(fflMarker("endStyle", "ffl-group", count.toString()));
        }
    }
    return ret;
}
const classes = {
    '^': ['superscript'],
    '_': ['subscript'],
    '\\text': ['text'],
    '\\frac': ['numerator', 'denominator'],
};
function _normalizeAndCountClasses(tokens, instanceCounts) {
    let _tokens = _.clone(tokens);
    if (Array.isArray(_tokens)) {
        var ret = [];
        var tok;
        while (tok = _tokens.pop()) {
            if (Array.isArray(tok)) {
                ret.push(_normalizeAndCountClasses(tok, instanceCounts));
            }
            else {
                let cmdClasses = classes[tok];
                let expandedArgs = [];
                for (var j = 0; j < (cmdClasses?.length ?? 0); j++) {
                    let arg = ret.pop() ?? [];
                    expandedArgs.push(Array.isArray(arg) ? arg : [arg]);
                    instanceCounts[cmdClasses[j]] ??= 0;
                    instanceCounts[cmdClasses[j]]++;
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
function _markClasses(tokens, instanceCounts) {
    let _tokens = _.cloneDeep(tokens);
    instanceCounts ??= {};
    if (Array.isArray(_tokens)) {
        var ret = [];
        var tok;
        while (tok = _tokens.pop()) {
            if (Array.isArray(tok)) {
                ret.push(_markClasses(tok, instanceCounts));
            }
            else {
                let cmdClasses = classes[tok];
                let expandedArgs = [];
                for (var j = 0; j < (cmdClasses?.length ?? 0); j++) {
                    let arg = ret.pop() ?? [];
                    if (!Array.isArray(arg))
                        arg = [arg];
                    expandedArgs.push([
                        fflMarker("startStyle", cmdClasses[j], (--instanceCounts[cmdClasses[j]]).toString()),
                        ...arg,
                        fflMarker("endStyle", cmdClasses[j], instanceCounts[cmdClasses[j]].toString())
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
// TODO: can this be done in single pass?
export function markClasses(tokens, instanceCounts) {
    instanceCounts ??= {};
    let normalize = _normalizeAndCountClasses(tokens, instanceCounts);
    return _markClasses(tokens, instanceCounts);
}
export function flatten(tokens) {
    if (Array.isArray(tokens)) {
        return ['{', ...tokens.map(flatten), '}'].flat();
    }
    else {
        return [tokens];
    }
}
//# sourceMappingURL=styleMarkers.js.map