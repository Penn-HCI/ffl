import React, { useState } from 'react';
import './App.css';
import 'github-markdown-css/github-markdown.css';
import { Container, Divider, Stack, Typography } from '@mui/material';
import MarkdownIt from 'markdown-it';
import ffl from 'ffl';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import fflPlugin from 'markdown-it-ffl';
function App() {
    const [mdSrc, setMdSrc] = useState(`Consider a dataset $D = \\{(x_i ,y_i)\\}^N$ of $N$ data points, where $x_i = (x_{i1}, x_{i2},\\cdots , x_{iM} )$ is a <span class="feat">feature vector</span> with $M$ features, and $y_i$ is the <span class="target">target</span>, i.e., the response, variable. Let $x_j$ denote the $j$th variable in feature space. A typical linear regression model can then be expressed mathematically as:
  
  $$ y = \\beta_0 + \\beta_1 x_1 + \\beta_2 x_2 + \\dots + \\beta_M x_M $$

  This model assumes that the relationships between the target variable $y_i$ and features $x_j$ are linear and can be captured in <span class="slope">slope terms</span> $\\beta_1$, $\\beta_2$, . . . , $\\beta_M$.
  `);
    const [fflSrc, setFflSrc] = useState(`
$y$, *.target { color: red }

$\\beta_0$ {
  label: intercept;
}

$\\beta_?$:nth(1) {
  label: slope term;
  label-marker: extent;
}

$x_1$ {
  background-color: rgba(0,0,0,0.1);
}`);
    const [vecMode, setVecMode] = useState('arrow');
    var md = MarkdownIt({
        html: true,
        linkify: true,
        typographer: true
    }).use(fflPlugin, {
        globalStyle: fflSrc
    });
    var errMsg, render = React.useRef('');
    var parseTime, renderTime;
    try {
        const parseStart = performance.now();
        ffl.parseFFL(fflSrc);
        const parseEnd = performance.now();
        parseTime = parseEnd - parseStart;
        errMsg = undefined;
        const renderStart = performance.now();
        render.current = md.render(mdSrc);
        const renderEnd = performance.now();
        renderTime = renderEnd - renderStart;
    }
    catch (err) {
        let gErr = err;
        errMsg = `${gErr.location?.start.line}:${gErr.location?.start.column}:${gErr.message}`;
    }
    return (<div className="App">
      <Container maxWidth='lg' sx={{ height: '100vh', padding: '8pt' }}>
        <Stack spacing={2} direction='row' alignItems='stretch' justifyContent='space-around' sx={{ height: '100%', width: '100%' }}>
          <Divider orientation='vertical'/>
          <Stack spacing={2} sx={{ flex: 3, textAlign: 'start', display: 'flex' }}>
            <Typography variant='h2' align='left' fontSize={24} marginTop="12pt">
              Markdown Document
            </Typography>
            <div style={{ flex: 8 }} dangerouslySetInnerHTML={{ __html: render.current }}/>
            {/* </Card> */}
            <Divider component="div" style={{ margin: '2pt' }}/>
            {/* <Card sx={{ flex: 6, textAlign: 'start', overflow: 'clip', padding: '12pt', justifyContent: 'space-evenly', alignItems: 'center' }}
          variant='outlined' className='markdown-body'> */}
            <Editor value={mdSrc} onValueChange={setMdSrc} highlight={mdSrc => Prism.highlight(mdSrc, Prism.languages['html'], 'html')} style={{
            flex: 6, fontSize: 12,
            fontFamily: '"Fira code", "Fira Mono", monospace',
        }}/><Divider component="div" style={{ marginBottom: '-4pt' }}/>
            <Typography align='justify' variant="inherit" display="inline-block" fontSize={10}>
              Initial excerpt adapted from <span style={{ fontStyle: 'italic' }}>
                Hohman et al., Gamut, CHI '19
              </span>
            </Typography>

          </Stack>
          <Divider orientation='vertical'/>
          <Stack spacing={2} sx={{ flex: 2 }}>
            <Typography variant='h2' align='left' fontSize={24} marginTop="12pt">FFL</Typography>
            <Editor value={fflSrc} onValueChange={setFflSrc} highlight={fflSrc => Prism.highlight(fflSrc, Prism.languages['css'], 'css')} style={{
            flex: 1, fontSize: 16,
            fontFamily: '"Fira code", "Fira Mono", monospace',
        }} insertSpaces/>
            <Typography variant='caption' align='left'>{errMsg}</Typography>
            {/* <Chip icon={<TimerOutlinedIcon />} size='small' label={`Parse: ${parseTime} ms / Render: ${renderTime} ms`} variant="outlined" /> */}
          </Stack>
        </Stack>

      </Container>
    </div>);
}
export default App;
//# sourceMappingURL=App.js.map