import type { ThemeDefinition, ThemeId } from "./types";

export const DEFAULT_THEME_ID: ThemeId = "obsidian-cyan";

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "obsidian-cyan",
    name: "极夜青",
    englishName: "Obsidian Cyan",
    description: "深蓝黑基底，青蓝主光与少量绯粉层级。",
    swatches: ["#010b11", "#00dce8", "#ea58c9"],
    tokens: {
      "--nw-bg": "#010b11",
      "--nw-bg-elevated": "#031720",
      "--nw-surface": "rgba(5, 27, 36, 0.92)",
      "--nw-surface-strong": "#07232d",
      "--nw-surface-hover": "#0a303b",
      "--nw-border": "#16424e",
      "--nw-border-strong": "#246575",
      "--nw-text": "#f2f7f8",
      "--nw-text-muted": "#9db4ba",
      "--nw-accent": "#00dce8",
      "--nw-accent-bright": "#32f2ff",
      "--nw-accent-soft": "rgba(0, 220, 232, 0.14)",
      "--nw-accent-glow": "rgba(0, 220, 232, 0.30)",
      "--nw-secondary": "#ea58c9",
      "--nw-secondary-soft": "rgba(234, 88, 201, 0.13)",
      "--nw-focus": "#71f8ff",
      "--nw-danger": "#ff6b7d"
    }
  },
  {
    id: "nebula-violet",
    name: "星云紫",
    englishName: "Nebula Violet",
    description: "深紫黑基底，紫罗兰主光与冰蓝辅助。",
    swatches: ["#0c0917", "#a678ff", "#5be7ff"],
    tokens: {
      "--nw-bg": "#0c0917",
      "--nw-bg-elevated": "#151027",
      "--nw-surface": "rgba(25, 18, 45, 0.92)",
      "--nw-surface-strong": "#21173a",
      "--nw-surface-hover": "#2c1f4d",
      "--nw-border": "#443462",
      "--nw-border-strong": "#6d54a0",
      "--nw-text": "#f7f4ff",
      "--nw-text-muted": "#b8accd",
      "--nw-accent": "#a678ff",
      "--nw-accent-bright": "#c6a7ff",
      "--nw-accent-soft": "rgba(166, 120, 255, 0.16)",
      "--nw-accent-glow": "rgba(166, 120, 255, 0.32)",
      "--nw-secondary": "#5be7ff",
      "--nw-secondary-soft": "rgba(91, 231, 255, 0.13)",
      "--nw-focus": "#d5c1ff",
      "--nw-danger": "#ff718d"
    }
  },
  {
    id: "molten-amber",
    name: "熔金琥珀",
    englishName: "Molten Amber",
    description: "暖黑基底，琥珀金主光与熔橙辅助。",
    swatches: ["#100b05", "#ffb43f", "#ff6b2c"],
    tokens: {
      "--nw-bg": "#100b05",
      "--nw-bg-elevated": "#1b1208",
      "--nw-surface": "rgba(36, 24, 10, 0.92)",
      "--nw-surface-strong": "#2d1d0c",
      "--nw-surface-hover": "#3b2710",
      "--nw-border": "#5d4020",
      "--nw-border-strong": "#8a612e",
      "--nw-text": "#fff7eb",
      "--nw-text-muted": "#ccb89a",
      "--nw-accent": "#ffb43f",
      "--nw-accent-bright": "#ffd070",
      "--nw-accent-soft": "rgba(255, 180, 63, 0.15)",
      "--nw-accent-glow": "rgba(255, 180, 63, 0.28)",
      "--nw-secondary": "#ff6b2c",
      "--nw-secondary-soft": "rgba(255, 107, 44, 0.14)",
      "--nw-focus": "#ffe09a",
      "--nw-danger": "#ff6472"
    }
  },
  {
    id: "deep-emerald",
    name: "翡翠深海",
    englishName: "Deep Emerald",
    description: "深海绿黑基底，翡翠绿主光与水蓝辅助。",
    swatches: ["#04110f", "#24d9a2", "#3abff8"],
    tokens: {
      "--nw-bg": "#04110f",
      "--nw-bg-elevated": "#071d19",
      "--nw-surface": "rgba(7, 35, 29, 0.92)",
      "--nw-surface-strong": "#0b2b24",
      "--nw-surface-hover": "#103a31",
      "--nw-border": "#1c5145",
      "--nw-border-strong": "#2b7867",
      "--nw-text": "#effaf6",
      "--nw-text-muted": "#9bbdb2",
      "--nw-accent": "#24d9a2",
      "--nw-accent-bright": "#5bf4c2",
      "--nw-accent-soft": "rgba(36, 217, 162, 0.14)",
      "--nw-accent-glow": "rgba(36, 217, 162, 0.29)",
      "--nw-secondary": "#3abff8",
      "--nw-secondary-soft": "rgba(58, 191, 248, 0.13)",
      "--nw-focus": "#8fffd8",
      "--nw-danger": "#ff6f82"
    }
  },
  {
    id: "sakura-night-pink",
    name: "樱夜绯粉",
    englishName: "Sakura Night Pink",
    description: "樱夜黑紫基底，绯粉主光与紫罗兰辅助。",
    swatches: ["#120812", "#ff6fb5", "#a678ff"],
    tokens: {
      "--nw-bg": "#120812",
      "--nw-bg-elevated": "#201021",
      "--nw-surface": "rgba(39, 18, 38, 0.92)",
      "--nw-surface-strong": "#31182f",
      "--nw-surface-hover": "#41203f",
      "--nw-border": "#61305a",
      "--nw-border-strong": "#914985",
      "--nw-text": "#fff3fb",
      "--nw-text-muted": "#ceb0c7",
      "--nw-accent": "#ff6fb5",
      "--nw-accent-bright": "#ff9bcd",
      "--nw-accent-soft": "rgba(255, 111, 181, 0.15)",
      "--nw-accent-glow": "rgba(255, 111, 181, 0.30)",
      "--nw-secondary": "#a678ff",
      "--nw-secondary-soft": "rgba(166, 120, 255, 0.14)",
      "--nw-focus": "#ffc1df",
      "--nw-danger": "#ff6978"
    }
  }
] as const;

export const THEMES_BY_ID = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme])
) as Record<ThemeId, ThemeDefinition>;

export function getNextThemeId(themeId: ThemeId): ThemeId {
  const currentIndex = THEMES.findIndex((theme) => theme.id === themeId);
  const nextIndex = (currentIndex + 1) % THEMES.length;

  return THEMES[nextIndex].id;
}
