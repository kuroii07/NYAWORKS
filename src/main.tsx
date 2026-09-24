import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DensityProvider } from "./density/DensityProvider";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { SettingsProvider } from "./settings/SettingsProvider";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SettingsProvider>
          <DensityProvider>
            <App />
          </DensityProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
