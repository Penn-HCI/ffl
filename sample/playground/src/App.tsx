import "./App.css";
import TextField from "@mui/material/TextField";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import ffl from "ffl";
import Grid from '@mui/material/Unstable_Grid2'; // Grid version 2
import { useRef, useState } from "react";
import { GrammarError } from "peggy";

function App() {
  const [fflStr, setFFL] = useState("$x$ { color: blue; }\n$m_?$ { color: red; }\n.subscript { label : sub; }");
  const [texStr, setTeX] = useState("f(x)=\\frac{x}{m_0}+b");
  const prevHTML = useRef('');
  var renderHTML, errMsg;
  try {
    ffl.parseFFL(fflStr.replaceAll('\n', '\r\n'));
    prevHTML.current = renderHTML = ffl.renderToString(texStr, fflStr, {});
  } catch (error) {
    let gErr = error as GrammarError;
    errMsg = `${gErr.location?.start.line}:${gErr.location?.start.column}:${gErr.message}`;
    renderHTML = prevHTML.current;
    console.log(error);
  };
  return (
    <div className="App">
      <Container maxWidth="sm" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid xs={6}>
              <TextField
                sx={{ width: "100%" }}
                inputProps={{
                  sx: { fontFamily: "Monospace", fontSize: 12, lineHeight: 'normal' },
                }}
                id="filled-multiline-static"
                label="FFL"
                multiline
                rows={8}
                defaultValue=""
                value={fflStr}
                error={errMsg ? true : false}
                variant="filled"
                helperText={errMsg ? errMsg : ''}
                onChange={(e) => setFFL(e.target.value)}
              />
            </Grid>
            <Grid xs={6}>
              <TextField
                sx={{ width: "100%" }}
                inputProps={{
                  sx: { fontFamily: "Monospace", fontSize: 12, lineHeight: 'normal' },
                }}
                id="filled-multiline-static"
                label="LaTeX"
                multiline
                rows={8}
                defaultValue=""
                value={texStr}
                variant="filled"
                onChange={(e) => setTeX(e.target.value)}
              />
            </Grid>
          </Grid>
          <div dangerouslySetInnerHTML={{ __html: renderHTML ?? prevHTML ?? "" }} />
        </Stack>
      </Container>
    </div>
  );
}

export default App;
