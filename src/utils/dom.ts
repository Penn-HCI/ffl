import { isServer } from "./common";

export function toKaTeXVirtualNode(html: string) : any {
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
    console.error("server-side rendering not supported yet");
  } else {
    document = self.window.document;
  }
  let tempContainer = document.createElement('div');
  tempContainer.innerHTML = innerHTML;
  // wraps in div if is just text node
  return tempContainer.firstChild?.nodeType == 3 ? tempContainer :
    tempContainer.firstChild as HTMLElement;
}
