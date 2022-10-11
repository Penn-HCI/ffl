import React, { useState } from 'react';
import './App.css';
import 'github-markdown-css/github-markdown.css';
import { Card, Container, Stack } from '@mui/material';
import HTMLReactParser from 'html-react-parser';
import MarkdownIt from 'markdown-it';
declare function require(path: string): any;
var ffl = require('markdown-it-ffl');

function App() {
  const [mdSrc, setMdSrc] = useState('');
  const [fflSrc, setFflSrc] = useState('');
  var md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(ffl, { globalStyle: fflSrc });
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
              style={{ flex: 3, resize: 'none', overflow: 'auto' }}
              value={mdSrc} onChange={(e) => setMdSrc(e.target.value)}
            />
            <div style={{ textAlign: 'start', marginTop: '8pt', marginBottom: '-8pt' }}>FFL</div>
            <textarea
              style={{ flex: 1, resize: 'none', overflow: 'auto' }}
              value={fflSrc} onChange={(e) => setFflSrc(e.target.value)}
            />
          </Stack>
          <Card sx={{ flex: 1, textAlign: 'start', overflow: 'auto', padding: '16pt' }}
            variant='outlined' className='markdown-body'>
            {HTMLReactParser(md.render(mdSrc))}
          </Card>
        </Stack>
      </Container>
    </div>
  );
}

export default App;
