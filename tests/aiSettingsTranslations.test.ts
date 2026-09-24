import { describe, expect, it } from "vitest";
import { AI_PROVIDER_CATALOG } from "../src/aiSettings/providerCatalog";
import { LANGUAGE_IDS } from "../src/i18n/languages";
import { UI_COPY } from "../src/i18n/translations";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap(collectStrings);
}

describe("AI settings translations", () => {
  it("provides non-empty AI settings copy for all five languages", () => {
    const expectedKeys = Object.keys(UI_COPY["zh-CN"].settings.ai).sort();

    for (const languageId of LANGUAGE_IDS) {
      const copy = UI_COPY[languageId].settings.ai;

      expect(Object.keys(copy).sort()).toEqual(expectedKeys);
      for (const text of collectStrings(copy)) {
        expect(text.trim().length, `${languageId}: ${text}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps provider brands and model identifiers untranslated", () => {
    expect(AI_PROVIDER_CATALOG.map((provider) => provider.displayName)).toEqual([
      "OpenAI",
      "Claude",
      "Gemini",
      "DeepSeek",
      "通义千问",
      "豆包",
      "Kimi",
      "智谱 GLM"
    ]);
    expect(
      UI_COPY.en.settings.ai.modelExample.replace("Model: ", "")
    ).toBe("deepseek-chat");
    expect(
      UI_COPY.ja.settings.ai.modelExample.replace("モデル：", "")
    ).toBe("deepseek-chat");
  });

  it("uses concise English action labels for the narrow CEP panel", () => {
    const copy = UI_COPY.en.settings.ai;

    for (const label of [
      copy.addCustomConnection,
      copy.connectionActions,
      copy.testConnection,
      copy.saveConfiguration,
      copy.setAsDefault,
      copy.clearApiKey,
      copy.clearAll
    ]) {
      expect(label.length).toBeLessThanOrEqual(24);
    }
  });
});
