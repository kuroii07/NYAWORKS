import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DensityProvider } from "./density/DensityProvider";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { SettingsProvider } from "./settings/SettingsProvider";
import { ThemeProvider } from "./theme/ThemeProvider";
import { UpdatesProvider } from "./updates/UpdatesProvider";
import { createDevelopmentReleaseFetcher } from "./updates/githubReleaseService";
import "./styles.css";

const developmentReleaseFetcher = import.meta.env.DEV
  ? createDevelopmentReleaseFetcher(
      new URLSearchParams(window.location.search).get("updateFixture")
    )
  : undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SettingsProvider>
          <UpdatesProvider fetcher={developmentReleaseFetcher}>
            <DensityProvider>
              <App />
            </DensityProvider>
          </UpdatesProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
