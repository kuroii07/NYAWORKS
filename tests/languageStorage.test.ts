import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE_ID,
  getLanguageButtonLabel,
  getNextLanguageId,
  LANGUAGE_IDS,
  LANGUAGES,
  type LanguageId
} from "../src/i18n/languages";
import {
  isLanguageId,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  writeStoredLanguage
} from "../src/i18n/languageStorage";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("language definitions", () => {
  it("uses the approved five-language order", () => {
    expect(LANGUAGE_IDS).toEqual(["zh-CN", "zh-TW", "en", "ja", "ko"]);
  });

  it("quick-toggles only Simplified Chinese and English", () => {
    expect(getNextLanguageId("zh-CN")).toBe("en");
    expect(getNextLanguageId("en")).toBe(DEFAULT_LANGUAGE_ID);
    expect(getNextLanguageId("zh-TW")).toBe(DEFAULT_LANGUAGE_ID);
    expect(getNextLanguageId("ja")).toBe(DEFAULT_LANGUAGE_ID);
    expect(getNextLanguageId("ko")).toBe(DEFAULT_LANGUAGE_ID);
  });

  it("uses the approved compact button labels", () => {
    expect(getLanguageButtonLabel("zh-CN")).toEqual(["中", "En"]);
    expect(getLanguageButtonLabel("en")).toEqual(["中", "En"]);
    expect(getLanguageButtonLabel("zh-TW")).toEqual(["繁"]);
    expect(getLanguageButtonLabel("ja")).toEqual(["あ"]);
    expect(getLanguageButtonLabel("ko")).toEqual(["한"]);
  });

  it("uses an unambiguous native mark for every manual menu option", () => {
    expect(LANGUAGES.map((language) => language.mark)).toEqual([
      "简",
      "繁",
      "En",
      "あ",
      "한"
    ]);
  });
});

describe("language preference storage", () => {
  it("defaults to Simplified Chinese", () => {
    expect(readStoredLanguage(new MemoryStorage())).toBe(DEFAULT_LANGUAGE_ID);
  });

  it("ignores an unknown language id", () => {
    const storage = new MemoryStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, "fr");

    expect(readStoredLanguage(storage)).toBe(DEFAULT_LANGUAGE_ID);
  });

  it("round-trips an approved language id", () => {
    const storage = new MemoryStorage();
    const languageId: LanguageId = "ja";

    writeStoredLanguage(languageId, storage);

    expect(readStoredLanguage(storage)).toBe(languageId);
    expect(isLanguageId(languageId)).toBe(true);
  });
});
