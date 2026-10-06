import React from "react";
import ReactDOM from "react-dom/client";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { TextLayerEditor } from "./TextLayerEditor";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("text-layer-editor-root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <TextLayerEditor />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
