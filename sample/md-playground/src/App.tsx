import React, { useState } from 'react';
import './App.css';
import 'github-markdown-css/github-markdown.css';
import { Card, Container, CssBaseline, MenuItem, Select, Stack } from '@mui/material';
import MarkdownIt from 'markdown-it';
import * as ffl from 'ffl';
import { GrammarError } from 'peggy';
import { Typography } from '@mui/joy';
declare function require(path: string): any;
var fflPlugin = require('markdown-it-ffl');

function App() {
  const [mdSrc, setMdSrc] = useState(`
https://observablehq.com/@hzsteinberg/differential-equations
...
## Advanced Guess And Check

Looks like our guess of $x(t) = e^t$ led to a contradiction. But $x(t)$ still feels like exponential growth. We can try a variation of the strategy: try an infinite family of functions at the same time by introducing some extra constants, which we can then tweak to figure out the exact solutions that work.

Let's try guessing $x(t) = e^{ct}$, where $c$ is some unknown constant we can change at our will to satisfy the equation. Plug it in:

$$\\frac{dx}{dt} = 2$$

$$\\frac{d(e^{ct})}{dt} = 2e^{ct}$$

Now we need to use our calculus knowledge to find that $\\frac{d(e^{ct})}{dt}$ on the left. We can use the chain rule:

$$\\text{set}\\ x = e^u, u = ct$$

$$\\frac{d(e^{ct})}{dt} = \\frac{dx}{du} \\frac{du}{dt} = \\frac{d(e^u)}{du} \\frac{d(ct)}{dt}$$

This simplifies things since both of those rightmost derivatives are simple enough:

$\\frac{d(e^u)}{du} = e^u = e^{ct} \\text{ , and } \\frac{d(ct)}{dt} = c$

so we can plug them back in:

$$\\frac{d(e^{ct})}{dt} = \\frac{d(e^u)}{du} \\frac{d(ct)}{dt} = c e^{ct}$$

Finally, this makes our original differential equation turn into

$c e^{ct} = 2e^{ct}$
 
and now we can see that setting $c=2$ will satisfy the differential equation. And that's it. We now have an explicit formula for $x(t)$: it's $x(t) = e^{2t}$.

`);
  const [fflSrc, setFflSrc] = useState(`
$\\frac{*}{dt}$, $\\frac{*}{du}$ { color : green }
$c$ { color : fuchsia }
$u$ { color : blue }
`);
  const [vecMode, setVecMode] = useState('arrow');
  var md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(fflPlugin, {
    globalStyle: fflSrc,
    macros: {
      '\\vec': vecMode === 'bold' ? '\\boldsymbol{#1}' : undefined
    }
  });
  var errMsg: string | undefined, render = React.useRef('');
  try {
    ffl.default.parseFFL(fflSrc);
    errMsg = undefined;
    render.current = md.render(mdSrc);
  } catch (err) {
    let gErr = err as GrammarError;
    errMsg = `${gErr.location?.start.line}:${gErr.location?.start.column}:${gErr.message}`;
  }
  return (
    <div className="App">
      <Container maxWidth='lg' sx={{ height: '100vh', padding: '8pt' }}>
        <Stack
          spacing={2} direction='row'
          alignItems='stretch' justifyContent='space-around'
          sx={{ height: '100%', width: '100%' }}>
          <Stack spacing={2} sx={{ flex: 1 }}>
            <div style={{ textAlign: 'start', marginBottom: '-8pt' }}>Markdown</div>
            <textarea
              style={{ flex: 4, resize: 'none', overflow: 'auto' }}
              value={mdSrc} onChange={(e) => setMdSrc(e.target.value)}
            />
            <div style={{ textAlign: 'start', marginTop: '8pt', marginBottom: '-8pt' }}>FFL</div>
            {/* <div style={{ display: 'flex' }}>
              <Select label='Vector Notation'
                name="vec" id="vec" size='small' sx={{ textAlign: 'left', flex: 1 }}
                value={vecMode} onChange={(e) => setVecMode(e.target.value)}>
                <MenuItem value="arrow">Arrow (<span dangerouslySetInnerHTML={{ __html: md.renderInline('$\\vec{v}$') }} />)</MenuItem>
                <MenuItem value="bold">Bold (<span dangerouslySetInnerHTML={{ __html: md.renderInline('$\\boldsymbol{v}$') }} />)</MenuItem>
              </Select>
            </div> */}
            <textarea
              style={{ flex: 3, resize: 'none', overflow: 'auto' }}
              value={fflSrc} onChange={(e) => setFflSrc(e.target.value)}
            />
            {errMsg &&
              <Typography textColor="danger" sx={{ marginTop: '-4pt' }}>{errMsg}</Typography>}
          </Stack>
          <Card sx={{ flex: 1, textAlign: 'start', overflow: 'auto', padding: '16pt' }}
            variant='outlined' className='markdown-body'>
            <div dangerouslySetInnerHTML={{ __html: render.current }} />
          </Card>
        </Stack>
      </Container>
    </div>
  );
}

export default App;
