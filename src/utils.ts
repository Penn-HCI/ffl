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

export function setVisible(node: HTMLElement, displayMode?: string): { display: any, visibility: any } {
  // use shadow DOM here?
  let display = node.style.display;
  if (!display || display == "none") node.style.display = displayMode ?? "inline-block";
  let visibility = node.getAttributeNS(null, "visibility");
  node.setAttributeNS(null, "visibility", "hidden");
  return { display, visibility };
}

export function resetVisibility(node: HTMLElement, visibility: { display: any, visibility: any }) {
  node.style.display = visibility.display;
  node.setAttributeNS(null, "visibility", visibility.visibility ?? '');
}

export type BoundingBoxProps = {
  top: number, bottom: number, left: number, right: number,
  relativeOrigin?: BoundingBox
};

// DOMRect is read-only, we need something mutable to avoid repeated copying
export class BoundingBox {
  top: number; bottom: number; left: number; right: number;
  relativeOrigin?: BoundingBox;
  constructor(props: BoundingBoxProps) {
    this.top = props.top;
    this.bottom = props.bottom;
    this.left = props.left;
    this.right = props.right;
    this.relativeOrigin = props.relativeOrigin;
  }

  get width() {
    return this.right - this.left;
  }

  get height() {
    return this.bottom - this.top;
  }

  get center() {
    return {
      horizontal: (this.left + this.right) / 2,
      vertical: (this.top + this.bottom) / 2,
    }
  }

  relativeTo(root: BoundingBox) {
    let top = this.top - root.top;
    let left = this.left - root.left;
    return new BoundingBox({
      top, left,
      bottom: top + this.height,
      right: left + this.width,
      relativeOrigin: root
    })
  }

  static of(...rects: BoundingBox[]) {
    if (!rects || rects.length == 0) return undefined;
    return rects.reduce((box, rect) =>
      new BoundingBox({
        top: Math.min(rect.top, box.top),
        left: Math.min(rect.left, box.left),
        bottom: Math.max(rect.bottom, box.bottom),
        right: Math.max(rect.right, box.right),
      })
    );
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

export function toKaTeXVirtualNode(html: string) {
  return new Proxy({}, {
    get(target, prop, receiver) {
      if (prop == "toMarkup") return () => html;
      else {
        var element = toHTMLElement(html);
        switch (prop) {
          case "toNode": return () => element;
          case "hasClass": return element.classList.contains;
        }
        return Reflect.get(element, prop, receiver);
      }
    },
  })
}

export function toHTMLElement(innerHTML: string): HTMLElement {
  var document: any;
  if (isServer()) {
    try {
      let { jsdom } = require('jsdom-jscore-rn');
      document = jsdom('<body></body>').window.document;
    } catch (err) {
      console.log("import 'jsdom-jscore': " + err);
    }
  } else {
    document = self.window.document;
  }
  let tempContainer = document.createElement('div');
  tempContainer.innerHTML = innerHTML;
  // wraps in div if is just text node
  return tempContainer.firstChild?.nodeType == 3 ? tempContainer :
    tempContainer.firstChild as HTMLElement;
}
