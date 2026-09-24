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

export interface GeneralSettings {
  startupPage: StartupPageId;
  rememberLastPage: boolean;
  tooltipsEnabled: boolean;
  tooltipDelayMs: TooltipDelayMs;
  motionPreference: MotionPreference;
  confirmDangerousActions: boolean;
  homeBannerEnabled: boolean;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  startupPage: "home",
  rememberLastPage: true,
  tooltipsEnabled: true,
  tooltipDelayMs: 400,
  motionPreference: "standard",
  confirmDangerousActions: true,
  homeBannerEnabled: true
};
