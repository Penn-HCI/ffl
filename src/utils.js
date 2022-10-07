"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHTMLElement = exports.toKaTeXVirtualNode = exports.asKaTeXVirtualNode = exports.BoundingBox = exports.resetVisibility = exports.setVisible = exports.merge = exports.isWhitespace = exports.mapGroup = exports.isServer = void 0;
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
function setVisible(node, displayMode) {
    // use shadow DOM here?
    let display = node.style.display;
    if (!display || display == "none")
        node.style.display = displayMode !== null && displayMode !== void 0 ? displayMode : "inline-block";
    let visibility = node.getAttributeNS(null, "visibility");
    node.setAttributeNS(null, "visibility", "hidden");
    return { display, visibility };
}
exports.setVisible = setVisible;
function resetVisibility(node, visibility) {
    var _a;
    node.style.display = visibility.display;
    node.setAttributeNS(null, "visibility", (_a = visibility.visibility) !== null && _a !== void 0 ? _a : '');
}
exports.resetVisibility = resetVisibility;
// DOMRect is read-only, we need something mutable to avoid repeated copying
class BoundingBox {
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
function toKaTeXVirtualNode(html) {
    return new Proxy({}, {
        get(target, prop, receiver) {
            if (prop == "toMarkup")
                return () => html;
            else {
                var element = toHTMLElement(html);
                switch (prop) {
                    case "toNode": return () => element;
                    case "hasClass": return element.classList.contains;
                }
                return Reflect.get(element, prop, receiver);
            }
        },
    });
}
exports.toKaTeXVirtualNode = toKaTeXVirtualNode;
function toHTMLElement(innerHTML) {
    var _a;
    var document;
    if (isServer()) {
        try {
            let { jsdom } = require('jsdom-jscore-rn');
            document = jsdom('<body></body>').window.document;
        }
        catch (err) {
            console.log("import 'jsdom-jscore': " + err);
        }
    }
    else {
        document = self.window.document;
    }
    let tempContainer = document.createElement('div');
    tempContainer.innerHTML = innerHTML;
    // wraps in div if is just text node
    return ((_a = tempContainer.firstChild) === null || _a === void 0 ? void 0 : _a.nodeType) == 3 ? tempContainer :
        tempContainer.firstChild;
}
exports.toHTMLElement = toHTMLElement;
