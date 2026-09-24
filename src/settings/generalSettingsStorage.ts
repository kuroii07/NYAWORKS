import {
  clampInterfaceBrightness,
  DEFAULT_GENERAL_SETTINGS,
  MOTION_PREFERENCES,
  TOOLTIP_DELAY_OPTIONS,
  type GeneralSettings,
  type MotionPreference,
  type TooltipDelayMs
} from "./types";
import {
  STARTUP_PAGE_IDS,
  type StartupPageId
} from "../types/navigation";

export const GENERAL_SETTINGS_STORAGE_KEY = "nyaworks.settings.general.v1";

interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isTooltipDelay(value: unknown): value is TooltipDelayMs {
  return (
    typeof value === "number" &&
    TOOLTIP_DELAY_OPTIONS.includes(value as TooltipDelayMs)
  );
}

function isMotionPreference(value: unknown): value is MotionPreference {
  return (
    typeof value === "string" &&
    MOTION_PREFERENCES.includes(value as MotionPreference)
  );
}

function isStartupPage(value: unknown): value is StartupPageId {
  return (
    typeof value === "string" &&
    STARTUP_PAGE_IDS.includes(value as StartupPageId)
  );
}

function normalizeGeneralSettings(value: unknown): GeneralSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_GENERAL_SETTINGS;
  }

  const candidate = value as Partial<Record<keyof GeneralSettings, unknown>>;

  return {
    startupPage: isStartupPage(candidate.startupPage)
      ? candidate.startupPage
      : DEFAULT_GENERAL_SETTINGS.startupPage,
    rememberLastPage: isBoolean(candidate.rememberLastPage)
      ? candidate.rememberLastPage
      : DEFAULT_GENERAL_SETTINGS.rememberLastPage,
    autoCheckUpdates: isBoolean(candidate.autoCheckUpdates)
      ? candidate.autoCheckUpdates
      : DEFAULT_GENERAL_SETTINGS.autoCheckUpdates,
    showWhatsNew: isBoolean(candidate.showWhatsNew)
      ? candidate.showWhatsNew
      : DEFAULT_GENERAL_SETTINGS.showWhatsNew,
    interfaceBrightness: clampInterfaceBrightness(
      candidate.interfaceBrightness
    ),
    tooltipsEnabled: isBoolean(candidate.tooltipsEnabled)
      ? candidate.tooltipsEnabled
      : DEFAULT_GENERAL_SETTINGS.tooltipsEnabled,
    tooltipDelayMs: isTooltipDelay(candidate.tooltipDelayMs)
      ? candidate.tooltipDelayMs
      : DEFAULT_GENERAL_SETTINGS.tooltipDelayMs,
    motionPreference: isMotionPreference(candidate.motionPreference)
      ? candidate.motionPreference
      : DEFAULT_GENERAL_SETTINGS.motionPreference,
    confirmDangerousActions: isBoolean(candidate.confirmDangerousActions)
      ? candidate.confirmDangerousActions
      : DEFAULT_GENERAL_SETTINGS.confirmDangerousActions,
    homeBannerEnabled: isBoolean(candidate.homeBannerEnabled)
      ? candidate.homeBannerEnabled
      : DEFAULT_GENERAL_SETTINGS.homeBannerEnabled
  };
}

export function readStoredGeneralSettings(
  storage?: SettingsStorage
): GeneralSettings {
  if (!storage) {
    return DEFAULT_GENERAL_SETTINGS;
  }

  try {
    const storedValue = storage.getItem(GENERAL_SETTINGS_STORAGE_KEY);
    return storedValue
      ? normalizeGeneralSettings(JSON.parse(storedValue))
      : DEFAULT_GENERAL_SETTINGS;
  } catch {
    return DEFAULT_GENERAL_SETTINGS;
  }
}

export function writeStoredGeneralSettings(
  settings: GeneralSettings,
  storage?: SettingsStorage
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      GENERAL_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeGeneralSettings(settings))
    );
  } catch {
    // CEP can run with storage disabled. Keep the active session usable.
  }
}
