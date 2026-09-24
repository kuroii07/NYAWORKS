import { DEFAULT_THEME_ID } from "./themes";
import { THEME_IDS, type ThemeId } from "./types";

export const THEME_STORAGE_KEY = "nyaworks.theme.v1";

interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function readStoredTheme(storage?: ThemeStorage): ThemeId {
  if (!storage) {
    return DEFAULT_THEME_ID;
  }

  try {
    const storedValue = storage.getItem(THEME_STORAGE_KEY);
    return isThemeId(storedValue) ? storedValue : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function writeStoredTheme(
  themeId: ThemeId,
  storage?: ThemeStorage
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // CEP can run with storage disabled. The active session still keeps the theme.
  }
}

