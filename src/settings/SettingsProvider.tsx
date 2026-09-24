import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import {
  readStoredGeneralSettings,
  writeStoredGeneralSettings
} from "./generalSettingsStorage";
import {
  readStoredHomeSettings,
  writeStoredHomeSettings
} from "./homeSettingsStorage";
import {
  normalizeAiSettings,
  readStoredAiSettings,
  writeStoredAiSettings
} from "../aiSettings/aiSettingsStorage";
import { DEFAULT_AI_SETTINGS } from "../aiSettings/providerCatalog";
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_HOME_SETTINGS,
  type AiSettings,
  type GeneralSettings,
  type HomeSettings
} from "./types";

interface SettingsContextValue {
  generalSettings: GeneralSettings;
  homeSettings: HomeSettings;
  aiSettings: AiSettings;
  updateGeneralSettings: (patch: Partial<GeneralSettings>) => void;
  updateHomeSettings: (patch: Partial<HomeSettings>) => void;
  replaceAiSettings: (settings: AiSettings) => void;
  updateAiSettings: (updater: (current: AiSettings) => AiSettings) => void;
  resetGeneralSettings: () => void;
  resetHomeSettings: () => void;
  resetAiSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function getInitialGeneralSettings(): GeneralSettings {
  if (typeof window === "undefined") {
    return readStoredGeneralSettings();
  }

  return readStoredGeneralSettings(window.localStorage);
}

function getInitialHomeSettings(): HomeSettings {
  if (typeof window === "undefined") {
    return readStoredHomeSettings();
  }

  return readStoredHomeSettings(window.localStorage);
}

function getInitialAiSettings(): AiSettings {
  if (typeof window === "undefined") {
    return readStoredAiSettings();
  }

  return readStoredAiSettings(window.localStorage);
}

export function cloneDefaultAiSettings(): AiSettings {
  return normalizeAiSettings(DEFAULT_AI_SETTINGS);
}

export function applyAiSettingsUpdate(
  current: AiSettings,
  updater: (current: AiSettings) => AiSettings
): AiSettings {
  return normalizeAiSettings(updater(current));
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(
    getInitialGeneralSettings
  );
  const [homeSettings, setHomeSettings] = useState<HomeSettings>(
    getInitialHomeSettings
  );
  const [aiSettings, setAiSettings] = useState<AiSettings>(
    getInitialAiSettings
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.motion =
      generalSettings.motionPreference;
    document.documentElement.dataset.tooltips = generalSettings.tooltipsEnabled
      ? "enabled"
      : "disabled";
    document.documentElement.style.setProperty(
      "--nw-interface-brightness",
      String(generalSettings.interfaceBrightness / 100)
    );
    writeStoredGeneralSettings(generalSettings, window.localStorage);
  }, [generalSettings]);

  useLayoutEffect(() => {
    writeStoredHomeSettings(homeSettings, window.localStorage);
  }, [homeSettings]);

  useLayoutEffect(() => {
    writeStoredAiSettings(aiSettings, window.localStorage);
  }, [aiSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      generalSettings,
      homeSettings,
      aiSettings,
      updateGeneralSettings: (patch) => {
        setGeneralSettings((current) => ({ ...current, ...patch }));
      },
      updateHomeSettings: (patch) => {
        setHomeSettings((current) => ({ ...current, ...patch }));
      },
      replaceAiSettings: (settings) => {
        setAiSettings(normalizeAiSettings(settings));
      },
      updateAiSettings: (updater) => {
        setAiSettings((current) => applyAiSettingsUpdate(current, updater));
      },
      resetGeneralSettings: () => setGeneralSettings(DEFAULT_GENERAL_SETTINGS),
      resetHomeSettings: () => setHomeSettings(DEFAULT_HOME_SETTINGS),
      resetAiSettings: () => setAiSettings(cloneDefaultAiSettings())
    }),
    [aiSettings, generalSettings, homeSettings]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider.");
  }

  return context;
}
