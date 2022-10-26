import _ from "lodash";
import { TokenTree } from "./groupParser";
import { isWhitespace } from "./utils";

// TODO: lift out more shared constants
export const fflPrefix = "\\ffl@";
export const fflMarkerCmd = "\\fflMarker";
export function fflMarker(s: string): string { return `${fflMarkerCmd}{${s}}`; }

export function getFFLMarker(node: any): any {
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
    } else {
        return undefined;
    }
}

// TODO: this is inefficient, we need better representations
export function markMatches(src: TokenTree[], matchers: { key: string, matcher: TokenTree[] }[], wildcardSingle: string, wildcardAny: string) {
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
export function markConstants(latex: TokenTree): any[] {
    var tree = !Array.isArray(latex) ? [latex] : latex;
    for (var i = 0; i < tree.length; i++) {
        if (Array.isArray(tree[i])) {
            tree[i] = markConstants(tree[i])
        } else {
            if ((tree[i] as string ?? '').match(/^\d+$/g)) {
                tree.splice(i, 0, fflMarker("startStyle{constant}"))
                do {
                    i++;
                } while ((tree[i] as string ?? '').match(/^\d+$/g))
                tree.splice(i, 0, fflMarker("endStyle{constant}"))
            }
        }
    }
    return tree;
}

export function deepFlattenAndMark(tokens: TokenTree): string | string[] {
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