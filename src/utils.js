"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundingBox = exports.__resetVisibility = exports.__setVisible = exports.__merge = exports.__isWhitespace = exports.__mapGroup = void 0;
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
// not this modifies dest
function __merge(dest, src, merge_obj_other, merge_others) {
    let isDestObj = __isObject(dest), isSrcObj = __isObject(src);
    if (isDestObj) {
        if (isSrcObj) {
            for (var k in src) {
                if (dest[k]) {
                    dest[k] = __merge(dest[k], src[k], merge_obj_other, merge_others);
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
exports.__merge = __merge;
function __setVisible(node, displayMode) {
    // use shadow DOM here?
    let display = node.style.display;
    if (!display || display == "none")
        node.style.display = displayMode ?? "inline-block";
    let visibility = node.getAttributeNS(null, "visibility");
    node.setAttributeNS(null, "visibility", "hidden");
    return { display, visibility };
}
exports.__setVisible = __setVisible;
function __resetVisibility(node, visibility) {
    node.style.display = visibility.display;
    node.setAttributeNS(null, "visibility", visibility.visibility ?? '');
}
exports.__resetVisibility = __resetVisibility;
// DOMRect is read-only, we need something mutable to avoid repeated copying
class BoundingBox {
    top;
    bottom;
    left;
    right;
    relativeOrigin;
    constructor(props) {
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
        };
    }
    relativeTo(root) {
        let top = this.top - root.top;
        let left = this.left - root.left;
        return new BoundingBox({
            top, left,
            bottom: top + this.height,
            right: left + this.width,
            relativeOrigin: root
        });
    }
    static of(...rects) {
        if (!rects || rects.length == 0)
            return undefined;
        return rects.reduce((box, rect) => new BoundingBox({
            top: Math.min(rect.top, box.top),
            left: Math.min(rect.left, box.left),
            bottom: Math.max(rect.bottom, box.bottom),
            right: Math.max(rect.right, box.right),
        }));
    }
}
exports.BoundingBox = BoundingBox;
