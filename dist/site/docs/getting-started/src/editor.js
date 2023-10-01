import { Card, CardContent, Grid, Paper } from '@mui/material';
import MarkdownIt from 'markdown-it';
import 'github-markdown-css/github-markdown.css';
import fflPlugin from 'markdown-it-ffl';
import { useState } from 'react';
import Prism from 'prismjs';
import '../public/prism.css';
import PrismEditor from 'react-simple-code-editor';
import './editor.css';
export function Editor({ md, fflStyle }) {
    const [ffl, setFfl] = useState(fflStyle);
    const mdIt = new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true
    }).use(fflPlugin, { globalStyle: ffl });
    return (<Grid container spacing={2} width='100%' direction="row" justifyContent="center" alignItems="center" padding="4pt" marginBottom="12pt">
        <Grid item xs={10}>
            <Card sx={{ display: 'flex' }}>
                <CardContent sx={{ flex: 1 }}>
                    <div className='markdown-body' dangerouslySetInnerHTML={{ __html: mdIt.render(md) }}></div>
                </CardContent>
                {ffl && <Paper variant="outlined" sx={{ flex: 1, padding: '8pt', borderColor: 'error.main' }}>
                    <PrismEditor value={ffl} onValueChange={setFfl} highlight={(fflSrc) => Prism.highlight(fflSrc, Prism.languages['css'], 'css')} style={{
                flex: 1, fontSize: 16, height: '100%',
                fontFamily: '"Fira code", "Fira Mono", monospace',
            }} insertSpaces/>
                </Paper>}
            </Card>
        </Grid>
    </Grid>);
}
//# sourceMappingURL=editor.js.map