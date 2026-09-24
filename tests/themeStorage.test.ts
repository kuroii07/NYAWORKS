import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_ID,
  getNextThemeId,
  THEMES
} from "../src/theme/themes";
import {
  isThemeId,
  readStoredTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme
} from "../src/theme/themeStorage";
import { THEME_IDS, type ThemeId } from "../src/theme/types";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("theme definitions", () => {
  it("contains exactly the five approved dark themes", () => {
    expect(THEMES.map((theme) => theme.id)).toEqual(THEME_IDS);
    expect(THEMES).toHaveLength(5);
  });

  it("uses Obsidian Cyan as the default", () => {
    expect(DEFAULT_THEME_ID).toBe("obsidian-cyan");
  });

  it("provides every required token for each theme", () => {
    const tokenKeys = Object.keys(THEMES[0].tokens).sort();

    for (const theme of THEMES) {
      expect(Object.keys(theme.tokens).sort()).toEqual(tokenKeys);
      expect(theme.tokens["--nw-bg"]).not.toBe("#ffffff");
    }
  });

  it("cycles themes in the approved order and wraps to the default", () => {
    expect(getNextThemeId("obsidian-cyan")).toBe("nebula-violet");
    expect(getNextThemeId("nebula-violet")).toBe("molten-amber");
    expect(getNextThemeId("molten-amber")).toBe("deep-emerald");
    expect(getNextThemeId("deep-emerald")).toBe("sakura-night-pink");
    expect(getNextThemeId("sakura-night-pink")).toBe(DEFAULT_THEME_ID);
  });
});

describe("theme preference storage", () => {
  it("falls back to the default when no preference exists", () => {
    expect(readStoredTheme(new MemoryStorage())).toBe(DEFAULT_THEME_ID);
  });

  it("ignores an unknown theme id", () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, "bright-white");

    expect(readStoredTheme(storage)).toBe(DEFAULT_THEME_ID);
  });

  it("round-trips an approved theme id", () => {
    const storage = new MemoryStorage();
    const themeId: ThemeId = "deep-emerald";

    writeStoredTheme(themeId, storage);

    expect(readStoredTheme(storage)).toBe(themeId);
    expect(isThemeId(themeId)).toBe(true);
  });
});
