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
        UI_COPY[languageId].settings.general.showWhatsNew.length
      ).toBeGreaterThan(0);
      expect(
        UI_COPY[languageId].settings.general.autoCheckUpdates.length
      ).toBeGreaterThan(0);
      expect(UI_COPY[languageId].topbar.whatsNewAria.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].topbar.whatsNewTitle.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].whatsNew.title.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].whatsNew.version.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].whatsNew.releaseDate.length).toBeGreaterThan(
        0
      );
      expect(UI_COPY[languageId].whatsNew.features.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].whatsNew.improvements.length).toBeGreaterThan(
        0
      );
      expect(UI_COPY[languageId].whatsNew.fixes.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].whatsNew.close.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].updateDialog.title.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].updateDialog.currentVersion.length).toBeGreaterThan(
        0
      );
      expect(UI_COPY[languageId].updateDialog.availableVersion.length).toBeGreaterThan(
        0
      );
      expect(UI_COPY[languageId].updateDialog.summaryFallback.length).toBeGreaterThan(
        0
      );
      expect(UI_COPY[languageId].updateDialog.update.length).toBeGreaterThan(0);
      expect(UI_COPY[languageId].updateDialog.notNow.length).toBeGreaterThan(0);
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

  it("describes the implemented external GitHub update flow accurately", () => {
    expect(UI_COPY["zh-CN"].settings.about.updateChannelValue).toBe(
      "GitHub Releases"
    );
    expect(UI_COPY["zh-CN"].settings.about.automaticUpdatesValue).toBe(
      "已接入 · 外部下载"
    );
    expect(UI_COPY.en.settings.about.automaticUpdatesValue).toBe(
      "Available · External download"
    );
  });

  it("uses the approved concise labels for density and release-note alerts", () => {
    expect(UI_COPY["zh-CN"].settings.general.density).toBe("界面与图标");
    expect(UI_COPY["zh-CN"].settings.general.showWhatsNew).toBe("新功能提示");
    expect(UI_COPY["zh-TW"].settings.general.density).toBe("介面與圖示");
    expect(UI_COPY["zh-TW"].settings.general.showWhatsNew).toBe("新功能提示");
    expect(UI_COPY.en.settings.general.density).toBe("Interface & Icons");
    expect(UI_COPY.en.settings.general.showWhatsNew).toBe("What's New Alerts");
    expect(UI_COPY.ja.settings.general.density).toBe("画面・アイコン");
    expect(UI_COPY.ja.settings.general.showWhatsNew).toBe("新機能通知");
    expect(UI_COPY.ko.settings.general.density).toBe("화면 및 아이콘");
    expect(UI_COPY.ko.settings.general.showWhatsNew).toBe("새 기능 알림");
  });
});
