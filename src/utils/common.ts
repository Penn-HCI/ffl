import { isWhiteSpaceLike } from 'typescript';
declare function require(path: string): any;

export function isServer() { return typeof window === "undefined"; }

// custom group then map for building state map
export function mapGroup(
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

export function isWhitespace(str: string): boolean {
  return str.split("").map(c => c.charCodeAt(0)).every(isWhiteSpaceLike);
}

function isObject(obj: any) {
  return obj === Object(obj) && !Array.isArray(obj);
}

// custom merge for merging state map, used during handling wildcards
// not this modifies dest
export function merge(dest: { [key: string]: any }, src: { [key: string]: any },
  merge_obj_other: (a: { [key: string]: any }, b: any) => any,
  merge_others: (a: any, b: any) => any) {
  let isDestObj = isObject(dest), isSrcObj = isObject(src);
  if (isDestObj) {
    if (isSrcObj) {
      for (var k in src) {
        if (dest[k]) {
          dest[k] = merge(dest[k], src[k], merge_obj_other, merge_others);
        } else {
          dest[k] = src[k];
        }
      }
      return dest;
    } else {
      return merge_obj_other(dest, src);
    }
  } else if (isSrcObj) {
    return merge_obj_other(src, dest);
  } else {
    return merge_others(dest, src);
  }
}

export function asKaTeXVirtualNode(element: HTMLElement) {
  return new Proxy(element, {
    get(target, prop, receiver) {
      switch (prop) {
        case "hasClass": return target.classList.contains;
        case "toNode": return () => target;
        case "toMarkup": return () => target.outerHTML;
      }
      return Reflect.get(target, prop, receiver);
    },
  })
}