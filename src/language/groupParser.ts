import { ParseError } from "katex";
import _ from "lodash";

export type TokenTree = string | TokenTree[];

// almost a parsec but we need some special parameterization so it is not actually combinable directly
function consumeToken(tokens: any[], startIdx: number): [any, number] {
    return [tokens[startIdx], startIdx + 1];
}

function consumeGroup(tokens: any[], startIdx: number, isOpenGroup: (token: any) => boolean, isCloseGroup: (token: any) => boolean): [any, number] {
    let children: any[] = [], idx = startIdx;
    if (isOpenGroup(tokens[idx])) {
        idx++;
        while (!isCloseGroup(tokens[idx]) && startIdx < tokens.length) {
            let [tryConsume, contIdx] = consumeAtomic(tokens, idx, isOpenGroup, isCloseGroup);
            children.push(tryConsume);
            idx = contIdx;
        }
        if (!isCloseGroup(tokens[idx])) throw new ParseError("dangling open group", undefined, startIdx);
        return [children, idx + 1];
    } else {
        return [null, idx];
    }
}

function consumeAtomic(tokens: any[], startIdx: number, isOpenGroup: (token: any) => boolean, isCloseGroup: (token: any) => boolean): [any, number] {
    let [tryConsume, contIdx] = consumeGroup(tokens, startIdx, isOpenGroup, isCloseGroup);
    if (!tryConsume) [tryConsume, contIdx] = consumeToken(tokens, startIdx);
    if (contIdx == startIdx) throw new ParseError("unexpected / internal error", undefined, startIdx);
    startIdx = contIdx;
    return [tryConsume, startIdx];
}

const cmdArgLens: { [key: string]: number } = {
    '^': 1,
    '_': 1,
    '\\text': 1,
    '\\frac': 2,
};

function fixGroups(tokens: TokenTree): TokenTree {
    let _tokens = _.cloneDeep(tokens);
    if (Array.isArray(_tokens)) {
        var ret: TokenTree[] = [];
        var tok: TokenTree | undefined;
        while (tok = _tokens.pop()) {
            if (Array.isArray(tok)) {
                ret.push(fixGroups(tok));
            } else {
                let numArgs = cmdArgLens[tok];
                let expandedArgs: TokenTree[] = [];
                for (var j = 0; j < (numArgs ?? 0); j++) {
                    let arg = ret.pop() ?? [];
                    let isCmd = typeof arg === 'string' && cmdArgLens[arg];
                    if (!Array.isArray(arg)) arg = [arg];
                    if (isCmd) {
                        for (var k = 0; k < (isCmd ?? 0); k++) {
                            let arg_ = ret.pop();
                            if (arg_) arg.push(arg_);
                        }
                    }
                    expandedArgs.unshift(arg);
                }
                ret.push(...expandedArgs, tok);
            }
        }
        return ret.reverse();
    } else {
        return _tokens;
    }
}

// this assumes token already passes parsing by katex
export function parseAtomics(tokens: any[],
    isOpenGroup: (token: any) => boolean, isCloseGroup: (token: any) => boolean
): any[] {
    let children: any[] = [];
    for (var idx = 0; idx < tokens.length;) {
        let [tryConsume, contIdx] = consumeAtomic(tokens, idx, isOpenGroup, isCloseGroup);
        children.push(tryConsume);
        idx = contIdx;
    }
    let tokenTree = fixGroups(children);
    return Array.isArray(tokenTree) ? tokenTree : [tokenTree];
}