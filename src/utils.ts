import { isWhiteSpaceLike } from "typescript";

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