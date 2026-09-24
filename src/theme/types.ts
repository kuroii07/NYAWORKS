export const THEME_IDS = [
  "obsidian-cyan",
  "nebula-violet",
  "molten-amber",
  "deep-emerald",
  "sakura-night-pink"
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeToken =
  | "--nw-bg"
  | "--nw-bg-elevated"
  | "--nw-surface"
  | "--nw-surface-strong"
  | "--nw-surface-hover"
  | "--nw-border"
  | "--nw-border-strong"
  | "--nw-text"
  | "--nw-text-muted"
  | "--nw-accent"
  | "--nw-accent-bright"
  | "--nw-accent-soft"
  | "--nw-accent-glow"
  | "--nw-secondary"
  | "--nw-secondary-soft"
  | "--nw-focus"
  | "--nw-danger";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  englishName: string;
  description: string;
  swatches: readonly [string, string, string];
  tokens: Record<ThemeToken, string>;
}

