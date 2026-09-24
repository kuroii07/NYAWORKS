import type { StartupPageId } from "../types/navigation";

export const SETTINGS_TAB_IDS = [
  "general",
  "home",
  "ai",
  "resources",
  "about"
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export const TOOLTIP_DELAY_OPTIONS = [200, 400, 700] as const;

export type TooltipDelayMs = (typeof TOOLTIP_DELAY_OPTIONS)[number];

export const MOTION_PREFERENCES = ["standard", "reduced", "off"] as const;

export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

export const MIN_INTERFACE_BRIGHTNESS = 90;
export const MAX_INTERFACE_BRIGHTNESS = 110;
export const DEFAULT_INTERFACE_BRIGHTNESS = 100;

export function clampInterfaceBrightness(value: unknown): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_INTERFACE_BRIGHTNESS &&
    value <= MAX_INTERFACE_BRIGHTNESS
    ? value
    : DEFAULT_INTERFACE_BRIGHTNESS;
}

export interface GeneralSettings {
  startupPage: StartupPageId;
  rememberLastPage: boolean;
  autoCheckUpdates: boolean;
  showWhatsNew: boolean;
  interfaceBrightness: number;
  tooltipsEnabled: boolean;
  tooltipDelayMs: TooltipDelayMs;
  motionPreference: MotionPreference;
  confirmDangerousActions: boolean;
  homeBannerEnabled: boolean;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  startupPage: "home",
  rememberLastPage: true,
  autoCheckUpdates: true,
  showWhatsNew: true,
  interfaceBrightness: DEFAULT_INTERFACE_BRIGHTNESS,
  tooltipsEnabled: true,
  tooltipDelayMs: 400,
  motionPreference: "standard",
  confirmDangerousActions: true,
  homeBannerEnabled: true
};
