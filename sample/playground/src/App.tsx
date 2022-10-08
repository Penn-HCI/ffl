import "./App.css";
import TextField from "@mui/material/TextField";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import ffl from "ffl";
import Grid from '@mui/material/Unstable_Grid2'; // Grid version 2
import { useState } from "react";

function App() {
  const [fflStr, setFFL] = useState("$x$ { color: blue; }\n$m_\\?$ { color: red; }\n.subscript { label : sub; }");
  const [texStr, setTeX] = useState("f(x)=\\frac{x}{m_0}+b");
  var renderHTML, prevHTML;
  try {
    renderHTML = ffl.renderToString(texStr, fflStr, {});
    prevHTML = renderHTML;
  } catch (error) {
    renderHTML = prevHTML;
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
                variant="filled"
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
