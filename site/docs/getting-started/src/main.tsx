import { createRoot } from 'react-dom/client';
import './index.css'
import { Editor } from './editor';
import { NavBar, nav as defaultNav } from './navbar';

document.querySelectorAll('[nav-root]').forEach((el) => {
  const root = createRoot(el);
  root.render(<NavBar nav={defaultNav} />);
});

document.querySelectorAll('[latex-root]').forEach((el) => {
  const root = createRoot(el);
  const ffl = el.getAttribute('ffl-style');
  const md = `$$ ${el.innerHTML.replaceAll(/  +/g, ' ')} $$`;
  const showOpen = el.getAttribute('show-open') != null ? true : false;
  const expanded = el.getAttribute('expand') != null ? true : false;
  root.render(<Editor md={md} fflStyle={ffl} showOpen={showOpen} expand={expanded} />);
});

// Render your React component instead
document.querySelectorAll('[markdown-root]').forEach((el) => {
  const root = createRoot(el);
  const ffl = el.getAttribute('ffl-style');
  const md = el.innerHTML.replaceAll(/  +/g, ' ');
  const showToggle = el.getAttribute('show-toggle') != null ? true : false;
  const showOpen = el.getAttribute('show-open') != null ? true : false;
  const expanded = el.getAttribute('expand') != null ? true : false;
  root.render(<Editor md={md} fflStyle={ffl} showToggle={showToggle} showOpen={showOpen} expand={expanded} />);
});