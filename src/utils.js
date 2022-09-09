"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__merge = exports.__isWhitespace = exports.__mapGroup = void 0;
const typescript_1 = require("typescript");
// custom group then map for building state map
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
function __isObject(obj) {
    return obj === Object(obj) && !Array.isArray(obj);
}
// custom merge for merging state map, used during handling wildcards
function __merge(obj1, obj2, merge_obj_other, merge_others) {
    let isObj1 = __isObject(obj1), isObj2 = __isObject(obj2);
    if (isObj1) {
        if (isObj2) {
            var ret = {};
            Object.assign(ret, obj1);
            for (var k in obj2) {
                if (ret[k]) {
                    ret[k] = __merge(ret[k], obj2[k], merge_obj_other, merge_others);
                }
                else {
                    ret[k] = obj2[k];
                }
            }
            return ret;
        }
        else {
            return merge_obj_other(obj1, obj2);
        }
    }
    else if (isObj2) {
        return merge_obj_other(obj2, obj1);
    }
    else {
        return merge_others(obj1, obj2);
    }
}
exports.__merge = __merge;
