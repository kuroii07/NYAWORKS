import { describe, expect, it } from "vitest";
import {
  clearStoredLastPage,
  LAST_PAGE_STORAGE_KEY,
  readStoredLastPage,
  resolveStartupPage,
  writeStoredLastPage
} from "../src/settings/lastPageStorage";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("last page preference", () => {
  it("starts at the configured page when remembering the last page is disabled", () => {
    const storage = new MemoryStorage();
    storage.setItem(LAST_PAGE_STORAGE_KEY, "animation");

    expect(resolveStartupPage(false, "effects", storage)).toBe("effects");
  });

  it("restores the last valid page when enabled", () => {
    const storage = new MemoryStorage();
    writeStoredLastPage("settings", storage);

    expect(resolveStartupPage(true, "effects", storage)).toBe("settings");
    expect(readStoredLastPage(storage)).toBe("settings");
  });

  it("ignores an unknown page id", () => {
    const storage = new MemoryStorage();
    storage.setItem(LAST_PAGE_STORAGE_KEY, "unknown-page");

    expect(readStoredLastPage(storage)).toBe("home");
    expect(resolveStartupPage(true, "effects", storage)).toBe("home");
  });

  it("returns to home after clearing the remembered page", () => {
    const storage = new MemoryStorage();
    writeStoredLastPage("animation", storage);

    clearStoredLastPage(storage);

    expect(readStoredLastPage(storage)).toBe("home");
  });
});
