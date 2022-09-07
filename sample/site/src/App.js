import "./App.css";
import TextField from "@mui/material/TextField";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import ffl from "ffl";
import React, { useEffect, useState } from "react";

function App() {
  const [tex, setTeX] = useState("\\ffl{}{f(x)=m_0x+b}");
  var render;
  try {
    render = ffl.renderToString(tex, {})
  } catch (error) {
    console.log(error);
  };
  return (
    <div className="App">
      <Container maxWidth="sm" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            sx={{ width: "100%" }}
            inputProps={{
              sx: { fontFamily: "Monospace" },
            }}
            id="filled-multiline-static"
            label="Multiline"
            multiline
            rows={4}
            defaultValue=""
            value={tex}
            variant="filled"
            onChange={(e) => setTeX(e.target.value)}
          />
          <div dangerouslySetInnerHTML={{__html:render}}/>
        </Stack>
      </Container>
    </div>
  );
}

export default App;
