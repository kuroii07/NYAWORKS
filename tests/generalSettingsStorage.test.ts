import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERAL_SETTINGS,
  type GeneralSettings
} from "../src/settings/types";
import {
  GENERAL_SETTINGS_STORAGE_KEY,
  readStoredGeneralSettings,
  writeStoredGeneralSettings
} from "../src/settings/generalSettingsStorage";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("general settings preference storage", () => {
  it("uses the approved defaults when no preference exists", () => {
    expect(readStoredGeneralSettings(new MemoryStorage())).toEqual(
      DEFAULT_GENERAL_SETTINGS
    );
  });

  it("keeps valid values and repairs invalid stored fields", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      GENERAL_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        startupPage: "effects",
        rememberLastPage: false,
        tooltipsEnabled: "yes",
        tooltipDelayMs: 700,
        motionPreference: "hyper",
        confirmDangerousActions: false,
        homeBannerEnabled: false
      })
    );

    expect(readStoredGeneralSettings(storage)).toEqual({
      ...DEFAULT_GENERAL_SETTINGS,
      startupPage: "effects",
      rememberLastPage: false,
      tooltipDelayMs: 700,
      confirmDangerousActions: false,
      homeBannerEnabled: false
    });
  });

  it("falls back safely when stored JSON is damaged", () => {
    const storage = new MemoryStorage();
    storage.setItem(GENERAL_SETTINGS_STORAGE_KEY, "{broken");

    expect(readStoredGeneralSettings(storage)).toEqual(
      DEFAULT_GENERAL_SETTINGS
    );
  });

  it("round-trips the complete general settings object", () => {
    const storage = new MemoryStorage();
    const settings: GeneralSettings = {
      startupPage: "animation",
      rememberLastPage: false,
      tooltipsEnabled: false,
      tooltipDelayMs: 200,
      motionPreference: "reduced",
      confirmDangerousActions: false,
      homeBannerEnabled: false
    };

    writeStoredGeneralSettings(settings, storage);

    expect(readStoredGeneralSettings(storage)).toEqual(settings);
  });

  it("repairs a settings page or unknown startup target to home", () => {
    const storage = new MemoryStorage();

    storage.setItem(
      GENERAL_SETTINGS_STORAGE_KEY,
      JSON.stringify({ startupPage: "settings" })
    );
    expect(readStoredGeneralSettings(storage).startupPage).toBe("home");

    storage.setItem(
      GENERAL_SETTINGS_STORAGE_KEY,
      JSON.stringify({ startupPage: "unknown-page" })
    );
    expect(readStoredGeneralSettings(storage).startupPage).toBe("home");
  });
});
