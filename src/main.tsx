import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DensityProvider } from "./density/DensityProvider";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { SettingsProvider } from "./settings/SettingsProvider";
import { ThemeProvider } from "./theme/ThemeProvider";
import { UpdatesProvider } from "./updates/UpdatesProvider";
import { createDevelopmentReleaseFetcher } from "./updates/githubReleaseService";
import { cepResourceBridge } from "./host/resourceBridge";
import { ResourceProvider } from "./resources/ResourceProvider";
import { createDevelopmentResourceService } from "./resources/developmentResourceService";
import "./styles.css";

const developmentReleaseFetcher = import.meta.env.DEV
  ? createDevelopmentReleaseFetcher(
      new URLSearchParams(window.location.search).get("updateFixture")
    )
  : undefined;

const resourceBridge = import.meta.env.DEV
  ? createDevelopmentResourceService()
  : cepResourceBridge;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SettingsProvider>
          <ResourceProvider bridge={resourceBridge}>
            <UpdatesProvider fetcher={developmentReleaseFetcher}>
              <DensityProvider>
                <App />
              </DensityProvider>
            </UpdatesProvider>
          </ResourceProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
