"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAtomics = void 0;
const katex_1 = require("katex");
const lodash_1 = __importDefault(require("lodash"));
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
const cmdArgLens = {
    '^': 1,
    '_': 1,
    '\\text': 1,
    '\\frac': 2,
};
function fixGroups(tokens) {
    var _a;
    let _tokens = lodash_1.default.cloneDeep(tokens);
    if (Array.isArray(_tokens)) {
        var ret = [];
        var tok;
        while (tok = _tokens.pop()) {
            if (Array.isArray(tok)) {
                ret.push(fixGroups(tok));
            }
            else {
                let numArgs = cmdArgLens[tok];
                let expandedArgs = [];
                for (var j = 0; j < (numArgs !== null && numArgs !== void 0 ? numArgs : 0); j++) {
                    let arg = (_a = ret.pop()) !== null && _a !== void 0 ? _a : [];
                    let isCmd = typeof arg === 'string' && cmdArgLens[arg];
                    if (!Array.isArray(arg))
                        arg = [arg];
                    if (isCmd) {
                        for (var k = 0; k < (isCmd !== null && isCmd !== void 0 ? isCmd : 0); j++) {
                            let arg_ = ret.pop();
                            if (arg_)
                                arg.push(arg_);
                        }
                    }
                    expandedArgs.unshift(arg);
                }
                ret.push(...expandedArgs, tok);
            }
        }
        return ret.reverse();
    }
    else {
        return _tokens;
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
    let tokenTree = fixGroups(children);
    return Array.isArray(tokenTree) ? tokenTree : [tokenTree];
}
exports.parseAtomics = parseAtomics;
//# sourceMappingURL=groupParser.js.map