"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHTMLElement = exports.toKaTeXVirtualNode = void 0;
const common_1 = require("./common");
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
    if ((0, common_1.isServer)()) {
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
//# sourceMappingURL=dom.js.map