"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundingBox = void 0;
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
//# sourceMappingURL=boundingBox.js.map