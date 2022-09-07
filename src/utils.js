"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__isWhitespace = exports.__mapGroup = void 0;
const typescript_1 = require("typescript");
function __mapGroup(arr, groupFn, mapFn) {
    return arr.reduce((acc, elem, idx, arr) => {
        let k = groupFn(elem, idx, arr);
        acc[k] ??= [];
        acc[k].push(mapFn(elem, idx, arr));
        return acc;
    }, {});
}
exports.__mapGroup = __mapGroup;
function __isWhitespace(str) {
    return str.split("").map(c => c.charCodeAt(0)).every(typescript_1.isWhiteSpaceLike);
}
exports.__isWhitespace = __isWhitespace;
