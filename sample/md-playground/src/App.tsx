import React, { useState } from 'react';
import './App.css';
import 'github-markdown-css/github-markdown.css';
import { Card, Container, Stack } from '@mui/material';
import MarkdownIt from 'markdown-it';
import * as ffl from 'ffl';
import { GrammarError } from 'peggy';
import { Typography } from '@mui/joy';
declare function require(path: string): any;
var fflPlugin = require('markdown-it-ffl');

function App() {
  const [mdSrc, setMdSrc] = useState(`###### Haneen Mohammed, Ziyun Wei, Eugene Wu, and Ravi Netravali. 2020. Continuous prefetch for interactive data applications. Proc. VLDB Endow. 13, 12 (August 2020), 2297–2311. https://doi.org/10.14778/3407790.3407826

**Predictor decomposition.** Applications specify the predictor $P^t$ as <span class="server">server</span> and <span class="client">client</span> components:
$$ P^t(q|\\Delta, e_t) = P^t_s(q|\\Delta, s_t) P^t_c(st|\\Delta, e_t) $$
The client component <span class="client">$P^t_c$</span> collects user interaction events and requests $e_t$ and translates this information into a byte
array that represents the predictor state $s_t$. $s_t$ may be the most recent request(s), model parameters, the most recent
user events, or simply the predicted probabilities themselves. The server uses $s_t$ as input to <span class="server">$P^t_s$</span> in order to return future
request probabilities for the Khameleon scheduler’s joint optimization between prefetching and response tuning.
`);
  const [fflSrc, setFflSrc] = useState(``);
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
