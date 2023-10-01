import { createRoot } from 'react-dom/client';
import './index.css';
import { Editor } from './editor';
// Render your React component instead
document.querySelectorAll('[markdown-root]').forEach((el) => {
    const root = createRoot(el);
    const ffl = el.getAttribute('ffl-style');
    const md = el.innerHTML.replaceAll(/  +/g, ' ');
    root.render(<Editor md={md} fflStyle={ffl}/>);
});
document.querySelectorAll('[latex-root]').forEach((el) => {
    const root = createRoot(el);
    root.render(<div>{el.innerHTML}</div>);
});
//# sourceMappingURL=main.js.map