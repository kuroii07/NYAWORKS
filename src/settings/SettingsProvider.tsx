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
import type { GeneralSettings } from "./types";

interface SettingsContextValue {
  generalSettings: GeneralSettings;
  updateGeneralSettings: (patch: Partial<GeneralSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function getInitialGeneralSettings(): GeneralSettings {
  if (typeof window === "undefined") {
    return readStoredGeneralSettings();
  }

  return readStoredGeneralSettings(window.localStorage);
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(
    getInitialGeneralSettings
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.motion =
      generalSettings.motionPreference;
    document.documentElement.dataset.tooltips = generalSettings.tooltipsEnabled
      ? "enabled"
      : "disabled";
    writeStoredGeneralSettings(generalSettings, window.localStorage);
  }, [generalSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      generalSettings,
      updateGeneralSettings: (patch) => {
        setGeneralSettings((current) => ({ ...current, ...patch }));
      }
    }),
    [generalSettings]
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
