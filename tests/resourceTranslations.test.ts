import { describe, expect, it } from "vitest";
import { UI_COPY } from "../src/i18n/translations";
import { LANGUAGES } from "../src/i18n/languages";

describe("resource copy", () => {
  it("provides concise navigation and settings copy in every supported language", () => {
    for (const language of LANGUAGES) {
      const copy = UI_COPY[language.id];

      expect(copy.navigation.resources.trim().length).toBeGreaterThan(0);
      expect(copy.navigation.resources.trim().length).toBeLessThanOrEqual(12);
      expect(copy.settings.resources.currentAeSources.trim().length).toBeGreaterThan(0);
      expect(copy.settings.resources.mySources.trim().length).toBeGreaterThan(0);
      expect(copy.settings.resources.updateIndex.trim().length).toBeGreaterThan(0);
      expect(copy.settings.resources.lastScanned.trim().length).toBeGreaterThan(0);
      expect(copy.settings.resources.neverScanned.trim().length).toBeGreaterThan(0);
      expect(copy.settings.resources.noCurrentAeSources.trim().length).toBeGreaterThan(0);
      expect(copy.settings.resources.noCustomSources.trim().length).toBeGreaterThan(0);
      expect(copy.resources.allResources.trim().length).toBeGreaterThan(0);
      expect(copy.resources.recent.trim().length).toBeGreaterThan(0);
      expect(copy.resources.sortByName.trim().length).toBeGreaterThan(0);
      expect(copy.resources.sortByRecent.trim().length).toBeGreaterThan(0);
      expect(copy.resources.sortByFavorite.trim().length).toBeGreaterThan(0);
    }
  });
});
