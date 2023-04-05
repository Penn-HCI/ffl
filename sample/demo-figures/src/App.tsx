import React, { useState } from 'react';
import './App.css';
import 'github-markdown-css/github-markdown.css';
import { Card, Container, Stack } from '@mui/material';
import MarkdownIt from 'markdown-it';
import * as ffl from 'ffl';
declare function require(path: string): any;
var fflPlugin = require('markdown-it-ffl');

const mdSrc0 = `
Consider a dataset $D = \\{(x_i ,y_i)\\}^N$ of $N$ data points, where $x_i = (x_{i1}, x_{i2},\\cdots , x_{iM} )$ is a feature vector with $M$ features, and $y_i$ is the target, i.e., the response, variable. Let $x_j$ denote the $j$th variable in feature space. A typical linear regression model can then be expressed mathematically as:
$$ y = \\beta_0 + \\beta_1 x_1 + \\beta_2 x_2 + \\dots + \\beta_M x_M $$
This model assumes that the relationships between the target variable $y_i$ and features $x_j$ are linear and can be captured in slope terms $\\beta_1$, $\\beta_2$, . . . , $\\beta_M$.`;

const mdSrc_ = `
Consider a dataset $D = \\{(x_i ,y_i)\\}^N$ of $N$ data points, where $x_i = (x_{i1}, x_{i2},\\cdots , x_{iM} )$ is a <span class="feat">feature vector</span> with $M$ features, and $y_i$ is the <span class="target">target, i.e., the response, variable</span>. Let $x_j$ denote the $j$th variable in feature space. A typical linear regression model can then be expressed mathematically as:
$$ y = \\beta_0 + \\beta_1 x_1 + \\beta_2 x_2 + \\dots + \\beta_M x_M $$
This model assumes that the relationships between the target variable $y_i$ and features $x_j$ are linear and can be captured in <span class="slope">slope terms</span> $\\beta_1$, $\\beta_2$, . . . , $\\beta_M$.`;

const form = "$$ y = \\beta_0 + \\beta_1 x_1 + \\beta_2 x_2 + \\dots + \\beta_M x_M $$"

function step(fflSrc: string, mdSrc?: string) {
  mdSrc ??= mdSrc_;
  var md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(fflPlugin, { globalStyle: fflSrc, });
  return [<Card sx={{ padding: '12pt', paddingLeft: "32pt", paddingRight: "32pt", textAlign: "start" }} variant='outlined'>
    {fflSrc.replaceAll(" ", '\xa0').split("\n").map(l => [<code>{l}</code>,<br/>])}
  </Card>,
  <Card sx={{ paddingTop: '12pt', paddingLeft: "32pt", paddingRight: "32pt", textAlign: "start" }}
    variant='outlined' className='markdown-body'>
    <div dangerouslySetInnerHTML={{ __html: md.render(mdSrc) }} />
  </Card>
  ]
}

function App() {

  return (
    <div className="App">
      <Container maxWidth='sm' sx={{ height: '100vh' }}>
        <Stack spacing={2} alignItems='stretch' justifyContent='space-around'>
          {/* 1 */}
          {step("", mdSrc0)}
          {step("$y$ { color: red }", mdSrc0)}
          {step("$y$, *.target { color: red }", mdSrc_)}
          {/* 2 */}
          <Card sx={{ padding: '12pt', paddingLeft: "32pt", paddingRight: "32pt", textAlign: "start" }} variant='outlined'>
            <code>{"$y$, *.target { color: "}</code>
            <s><code>DarkRed</code></s>
            <code>{"Crimson }"}</code>
          </Card>
          {step("$y$, *.target { color: Crimson }", mdSrc_)}
          {step("$y$, $y_*$, *.target { color: Crimson }", mdSrc_)}
          {/* 3 */}
          {step("$y_?$, $y$, *.target { color: Crimson      }\n$x_*$, *.feat        { color: DodgerBlue   }\n$\\beta_*$, *.slope   { color: MediumPurple }")}
          {step("$y_?$, $y$, *.target { color: Crimson      }\n$x_*$, *.feat        { color: DodgerBlue   }\n$\\beta_*$, *.slope   { color: MediumPurple }\n$\\beta_0$            { color: inherit      }")}
          {step("$y$ { label: target }", form)}
          {step("$y$              { label: target     }\n$\\beta_0$        { label: intercept  }\n$\\beta_?$:nth(1) { label: slope term }\n$x_1$ {\n  label: feature;\n  label-position: below\n}\n$M$ { label: # of features }", form)}
        </Stack>
      </Container>
    </div>
  );
}

export default App;
