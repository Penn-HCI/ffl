import { Box, Button, Card, CardActions, CardContent, Collapse, Divider, Grid, Paper, styled } from '@mui/material';
import MarkdownIt from 'markdown-it';
import 'github-markdown-css/github-markdown.css';
import fflPlugin from 'markdown-it-ffl';
import { useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import '../public/prism.css'
import PrismEditor from 'react-simple-code-editor';
import './editor.css';
import FFL from 'ffl';
import { ExpandMoreRounded } from '@mui/icons-material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const ExpandMoreIcon = styled((props: { expand: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { expand, ...other } = props;
    return <ExpandMoreRounded {...other} />;
})(({ theme, expand }) => ({
    transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
    }),
}));

export function Editor({ md, fflStyle, showToggle, showOpen, expand }: {
    md: string, fflStyle: string | null, showToggle?: boolean, showOpen?: boolean, expand?: boolean
}) {
    const [markdown, setMd] = useState(md);
    const [ffl, setFfl] = useState(fflStyle ?? '');
    const mdIt = new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true
    }).use(fflPlugin, { globalStyle: ffl });
    const render = useRef(mdIt.render(markdown));
    const [expanded, setExpanded] = useState(expand);
    let error;
    try {
        if (ffl) FFL.parseFFL(ffl);
        render.current = mdIt.render(markdown);
        error = null;
    } catch (e) {
        error = e;
    }

    return (<Grid container spacing={2} width='100%' direction="row" justifyContent="center" alignItems="center"
        padding="4pt" marginBottom="12pt">
        <Grid item xs={10}>
            <Card>
                <Box sx={{ display: 'flex' }}>
                    <CardContent sx={{ flex: 1, display: 'flex', alignContent: 'center', alignItems: 'center', overflow: 'auto' }}>
                        <div className='markdown-body' style={{ margin: 'auto' }}
                            dangerouslySetInnerHTML={{ __html: render.current }}></div>
                    </CardContent>
                    {fflStyle && <Paper variant="outlined" sx={{
                        flex: 1, padding: '8pt', borderColor: error ? 'error.main' : undefined
                    }}>
                        <PrismEditor
                            value={ffl}
                            onValueChange={setFfl}
                            highlight={(fflSrc: string) => Prism.highlight(fflSrc, Prism.languages['css'], 'css')}
                            style={{
                                flex: 1, fontSize: 16, height: '100%',
                                fontFamily: '"Fira Code", "Fira Mono", monospace',
                            }} insertSpaces
                        />
                    </Paper>}
                </Box>
                {(showToggle || showOpen || expanded) && <Divider />}
                {(showToggle || showOpen) &&
                    <CardActions disableSpacing sx={{
                        alignSelf: "stretch",
                        display: "flex",
                        justifyContent: "space-around",
                    }}>
                        {showToggle &&
                            <Button startIcon={<ExpandMoreIcon expand={expanded ?? false} />} size="small" onClick={() => setExpanded(!expanded)}>
                                {expanded ? "Hide" : "Show"} Markdown Source
                            </Button>
                        }
                        <span style={{ flex: 1 }} />
                        {showOpen &&
                            <Button size="small" color="primary" endIcon={<OpenInNewIcon />} disabled>
                                Open in Playground
                            </Button>
                        }
                    </CardActions>
                }
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <CardContent>
                        <PrismEditor
                            value={markdown}
                            onValueChange={setMd}
                            highlight={(mdSrc: string) => Prism.highlight(mdSrc, Prism.languages['md'], 'md')}
                            style={{
                                flex: 1, fontSize: 14, height: '100%',
                                fontFamily: '"Fira code", "Fira Mono", monospace',
                            }} insertSpaces
                        />
                    </CardContent>
                </Collapse>
            </Card>
        </Grid>
    </Grid >)
}