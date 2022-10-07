"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAtomics = void 0;
const katex_1 = require("katex");
// almost a parsec but we need some special parameterization so it is not actually combinable directly
function consumeToken(tokens, startIdx) {
    return [tokens[startIdx], startIdx + 1];
}
function consumeGroup(tokens, startIdx, isOpenGroup, isCloseGroup) {
    let children = [], idx = startIdx;
    if (isOpenGroup(tokens[idx])) {
        idx++;
        while (!isCloseGroup(tokens[idx]) && startIdx < tokens.length) {
            let [tryConsume, contIdx] = consumeAtomic(tokens, idx, isOpenGroup, isCloseGroup);
            children.push(tryConsume);
            idx = contIdx;
        }
        if (!isCloseGroup(tokens[idx]))
            throw new katex_1.ParseError("dangling open group", undefined, startIdx);
        return [children, idx + 1];
    }
    else {
        return [null, idx];
    }
}
function consumeAtomic(tokens, startIdx, isOpenGroup, isCloseGroup) {
    let [tryConsume, contIdx] = consumeGroup(tokens, startIdx, isOpenGroup, isCloseGroup);
    if (!tryConsume)
        [tryConsume, contIdx] = consumeToken(tokens, startIdx);
    if (contIdx == startIdx)
        throw new katex_1.ParseError("unexpected / internal error", undefined, startIdx);
    startIdx = contIdx;
    return [tryConsume, startIdx];
}
// this mutates tokens to group any command arguments and super/subscripts
function fixGroups(tokens) {
    if (Array.isArray(tokens)) {
        for (var idx = 0; idx < tokens.length - 1; idx++) {
            let tok = tokens[idx];
            if (Array.isArray(tok)) {
                fixGroups(tok);
            }
            else {
                // how to get a list of macros and their # of args?
                if (tok === '_' || tok === '^' || tok === '\\frac') {
                    if (!Array.isArray(tokens[idx + 1]))
                        tokens[idx + 1] = [tokens[idx + 1]];
                }
                if (tok === '\\frac') {
                    if (!Array.isArray(tokens[idx + 2]))
                        tokens[idx + 2] = [tokens[idx + 2]];
                }
            }
        }
    }
}
// this assumes token already passes parsing by katex
function parseAtomics(tokens, isOpenGroup, isCloseGroup) {
    let children = [];
    for (var idx = 0; idx < tokens.length;) {
        let [tryConsume, contIdx] = consumeAtomic(tokens, idx, isOpenGroup, isCloseGroup);
        children.push(tryConsume);
        idx = contIdx;
    }
    // could better to do this during parsing but we are not too worried about performance
    fixGroups(children);
    return children;
}
exports.parseAtomics = parseAtomics;
