export const STARTUP_PAGE_IDS = [
  "home",
  "ai",
  "projects",
  "compositions",
  "layers",
  "animation",
  "text",
  "shapes",
  "effects",
  "media"
] as const;

export type StartupPageId = (typeof STARTUP_PAGE_IDS)[number];

export const PAGE_IDS = [
  ...STARTUP_PAGE_IDS,
  "settings"
] as const;

export type PageId = (typeof PAGE_IDS)[number];
