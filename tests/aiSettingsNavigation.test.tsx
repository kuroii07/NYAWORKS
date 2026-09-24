import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DensityProvider } from "../src/density/DensityProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { AiSettingsPanel } from "../src/pages/AiSettingsPanel";
import {
  getSettingsTabTransition,
  resolvePendingSettingsTab
} from "../src/pages/SettingsPage";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";

describe("AI settings navigation guard", () => {
  it("changes tabs immediately when the AI draft is clean", () => {
    expect(getSettingsTabTransition("ai", "general", false)).toEqual({
      activeTab: "general",
      pendingTab: null
    });
  });

  it("keeps AI active and records the requested tab when the draft is dirty", () => {
    expect(getSettingsTabTransition("ai", "general", true)).toEqual({
      activeTab: "ai",
      pendingTab: "general"
    });
  });

  it("continues after save or discard and stays on AI after cancel or failed save", () => {
    expect(resolvePendingSettingsTab("general", "save", true)).toBe("general");
    expect(resolvePendingSettingsTab("general", "discard", true)).toBe(
      "general"
    );
    expect(resolvePendingSettingsTab("general", "cancel", true)).toBe("ai");
    expect(resolvePendingSettingsTab("general", "save", false)).toBe("ai");
  });

  it("renders explicit save, discard, and cancel actions", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const markup = renderToStaticMarkup(
        <ThemeProvider>
          <LanguageProvider>
            <SettingsProvider>
              <DensityProvider>
                <AiSettingsPanel
                  pendingTabChange="general"
                  onResolveTabChange={vi.fn()}
                />
              </DensityProvider>
            </SettingsProvider>
          </LanguageProvider>
        </ThemeProvider>
      );

      expect(markup).toContain("保存并继续");
      expect(markup).toContain("放弃修改");
      expect(markup).toContain(">取消<");
    } finally {
      consoleError.mockRestore();
    }
  });
});

