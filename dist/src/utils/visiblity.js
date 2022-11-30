"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetVisibility = exports.setVisible = void 0;
function setVisible(node, displayMode) {
    // use shadow DOM here?
    let display = node.style.display;
    if (!display || display == "none")
        node.style.display = displayMode !== null && displayMode !== void 0 ? displayMode : "inline-block";
    let visibility = node.getAttributeNS(null, "visibility");
    node.setAttributeNS(null, "visibility", "hidden");
    if (!node.isConnected)
        document.body.appendChild(node);
    return { display, visibility, isConnected: node.isConnected };
}
exports.setVisible = setVisible;
function resetVisibility(node, visibility) {
    var _a;
    node.style.display = visibility.display;
    node.setAttributeNS(null, "visibility", (_a = visibility.visibility) !== null && _a !== void 0 ? _a : '');
    if (!visibility.isConnected)
        node.remove();
}
exports.resetVisibility = resetVisibility;
//# sourceMappingURL=visiblity.js.map