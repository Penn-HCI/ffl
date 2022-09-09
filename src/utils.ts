import { isWhiteSpaceLike } from "typescript";

// custom group then map for building state map
export function __mapGroup(
    arr: any[],
    groupFn: (elem: any, idx?: number, arr?: any[]) => any,
    mapFn: (elem: any, idx?: number, arr?: any[]) => any
) {
    return arr.reduce((acc, elem, idx, arr) => {
        let k = groupFn(elem, idx, arr);
        acc[k] ??= [];
        acc[k].push(mapFn(elem, idx, arr));
        return acc;
    }, {});
}

export function __isWhitespace(str: string): boolean {
    return str.split("").map(c => c.charCodeAt(0)).every(isWhiteSpaceLike);
}

function __isObject(obj: any) {
    return obj === Object(obj) && !Array.isArray(obj);
}

// custom merge for merging state map, used during handling wildcards
export function __merge(obj1: { [key: string]: any }, obj2: { [key: string]: any },
    merge_obj_other: (a: { [key: string]: any }, b: any) => any,
    merge_others: (a: any, b: any) => any) {
    let isObj1 = __isObject(obj1), isObj2 = __isObject(obj2);
    if (isObj1) {
        if (isObj2) {
            var ret: { [key: string]: any } = {};
            Object.assign(ret, obj1);
            for (var k in obj2) {
                if (ret[k]) {
                    ret[k] = __merge(ret[k], obj2[k], merge_obj_other, merge_others);
                } else {
                    ret[k] = obj2[k];
                }
            }
            return ret;
        } else {
            return merge_obj_other(obj1, obj2);
        }
    } else if (isObj2) {
        return merge_obj_other(obj2, obj1);
    } else {
        return merge_others(obj1, obj2);
    }
}