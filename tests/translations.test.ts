import { describe, expect, it } from "vitest";
import { LANGUAGE_IDS } from "../src/i18n/languages";
import { UI_COPY } from "../src/i18n/translations";

describe("localized UI copy", () => {
  it("provides a complete translation bundle for every approved language", () => {
    expect(Object.keys(UI_COPY)).toEqual([...LANGUAGE_IDS]);

    for (const languageId of LANGUAGE_IDS) {
      expect(UI_COPY[languageId].navigation.home.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].home.searchPlaceholder.length).toBeGreaterThan(
        0
      );
      expect(UI_COPY[languageId].home.toolLabels.camera.length).toBeGreaterThan(
        0
      );
      expect(UI_COPY[languageId].placeholder.settings.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].settings.tabs.general.length).toBeGreaterThan(
        0
      );
      expect(
        UI_COPY[languageId].settings.general.motionOptions.standard.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.appearanceSection.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.currentTheme.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.currentLanguage.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.interfaceBrightness.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.resetAllSettings.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.resetAction.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.resetDialogTitle.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.resetDialogBody.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.resetConfirm.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.resetCancel.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.about.productTagline.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.about.compatibilitySection.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.about.hostVerificationValue.length
      ).toBeGreaterThan(0);
      expect(UI_COPY[languageId].settings.comingSoon.body.length).toBeGreaterThan(
        0
      );
    }
  });

  it("uses localized navigation and home copy", () => {
    expect(UI_COPY.en.navigation.compositions).toBe("Comp");
    expect(UI_COPY.ja.home.groupTitles.animationTime).toBe("アニメーション・時間");
    expect(UI_COPY.ko.home.toolLabels.camera).toBe("카메라");
    expect(UI_COPY["zh-TW"].home.shortcutHeading).toBe("我的快捷工具");
  });
});
