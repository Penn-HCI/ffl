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
  const [mdSrc, setMdSrc] = useState('');
  const [fflSrc, setFflSrc] = useState('');
  var md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(fflPlugin, { globalStyle: fflSrc });
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
