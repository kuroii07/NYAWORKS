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
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_HOME_SETTINGS,
  type GeneralSettings,
  type HomeSettings
} from "./types";

interface SettingsContextValue {
  generalSettings: GeneralSettings;
  homeSettings: HomeSettings;
  updateGeneralSettings: (patch: Partial<GeneralSettings>) => void;
  updateHomeSettings: (patch: Partial<HomeSettings>) => void;
  resetGeneralSettings: () => void;
  resetHomeSettings: () => void;
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

export function SettingsProvider({ children }: PropsWithChildren) {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(
    getInitialGeneralSettings
  );
  const [homeSettings, setHomeSettings] = useState<HomeSettings>(
    getInitialHomeSettings
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

  const value = useMemo<SettingsContextValue>(
    () => ({
      generalSettings,
      homeSettings,
      updateGeneralSettings: (patch) => {
        setGeneralSettings((current) => ({ ...current, ...patch }));
      },
      updateHomeSettings: (patch) => {
        setHomeSettings((current) => ({ ...current, ...patch }));
      },
      resetGeneralSettings: () => setGeneralSettings(DEFAULT_GENERAL_SETTINGS),
      resetHomeSettings: () => setHomeSettings(DEFAULT_HOME_SETTINGS)
    }),
    [generalSettings, homeSettings]
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
