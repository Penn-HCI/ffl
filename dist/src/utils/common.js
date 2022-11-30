"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asKaTeXVirtualNode = exports.merge = exports.isWhitespace = exports.mapGroup = exports.isServer = void 0;
const typescript_1 = require("typescript");
function isServer() { return typeof window === "undefined"; }
exports.isServer = isServer;
// custom group then map for building state map
function mapGroup(arr, groupFn, mapFn) {
    return arr.reduce((acc, elem, idx, arr) => {
        var _a;
        let k = groupFn(elem, idx, arr);
        (_a = acc[k]) !== null && _a !== void 0 ? _a : (acc[k] = []);
        acc[k].push(mapFn(elem, idx, arr));
        return acc;
    }, {});
}
exports.mapGroup = mapGroup;
function isWhitespace(str) {
    return str.split("").map(c => c.charCodeAt(0)).every(typescript_1.isWhiteSpaceLike);
}
exports.isWhitespace = isWhitespace;
function isObject(obj) {
    return obj === Object(obj) && !Array.isArray(obj);
}
// custom merge for merging state map, used during handling wildcards
// not this modifies dest
function merge(dest, src, merge_obj_other, merge_others) {
    let isDestObj = isObject(dest), isSrcObj = isObject(src);
    if (isDestObj) {
        if (isSrcObj) {
            for (var k in src) {
                if (dest[k]) {
                    dest[k] = merge(dest[k], src[k], merge_obj_other, merge_others);
                }
                else {
                    dest[k] = src[k];
                }
            }
            return dest;
        }
        else {
            return merge_obj_other(dest, src);
        }
    }
    else if (isSrcObj) {
        return merge_obj_other(src, dest);
    }
    else {
        return merge_others(dest, src);
    }
}
exports.merge = merge;
function asKaTeXVirtualNode(element) {
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
exports.asKaTeXVirtualNode = asKaTeXVirtualNode;
//# sourceMappingURL=common.js.map