export function setVisible(node, displayMode) {
    // use shadow DOM here?
    let display = node.style.display;
    if (!display || display == "none")
        node.style.display = displayMode ?? "inline-block";
    let visibility = node.getAttributeNS(null, "visibility");
    node.setAttributeNS(null, "visibility", "hidden");
    if (!node.isConnected)
        document.body.appendChild(node);
    return { display, visibility, isConnected: node.isConnected };
}
export function resetVisibility(node, visibility) {
    node.style.display = visibility.display;
    node.setAttributeNS(null, "visibility", visibility.visibility ?? '');
    if (!visibility.isConnected)
        node.remove();
}
//# sourceMappingURL=visibility.js.map