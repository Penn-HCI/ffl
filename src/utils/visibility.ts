type Visibility = { display: any, visibility: any, isConnected: boolean };

export function setVisible(node: HTMLElement, displayMode?: string): Visibility {
  // use shadow DOM here?
  let display = node.style.display;
  if (!display || display == "none") node.style.display = displayMode ?? "inline-block";
  let visibility = node.getAttributeNS(null, "visibility");
  node.setAttributeNS(null, "visibility", "hidden");
  if (!node.isConnected) document.body.appendChild(node);
  return { display, visibility, isConnected: node.isConnected };
}

export function resetVisibility(node: HTMLElement, visibility: Visibility) {
  node.style.display = visibility.display;
  node.setAttributeNS(null, "visibility", visibility.visibility ?? '');
  if (!visibility.isConnected) node.remove();
}
