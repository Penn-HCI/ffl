import { isWhiteSpaceLike } from 'typescript';
export function isServer() { return typeof window === "undefined"; }
// custom group then map for building state map
export function mapGroup(arr, groupFn, mapFn) {
    return arr.reduce((acc, elem, idx, arr) => {
        let k = groupFn(elem, idx, arr);
        acc[k] ??= [];
        acc[k].push(mapFn(elem, idx, arr));
        return acc;
    }, {});
}
export function isWhitespace(str) {
    return str.split("").map(c => c.charCodeAt(0)).every(isWhiteSpaceLike);
}
function isObject(obj) {
    return obj === Object(obj) && !Array.isArray(obj);
}
// custom merge for merging state map, used during handling wildcards
// not this modifies dest
export function merge(dest, src, merge_obj_other, merge_others) {
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
export function asKaTeXVirtualNode(element) {
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
//# sourceMappingURL=common.js.map