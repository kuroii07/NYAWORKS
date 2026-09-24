import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AboutSettingsPanel } from "../src/pages/AboutSettingsPanel";
import { DensityProvider } from "../src/density/DensityProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";

describe("AboutSettingsPanel", () => {
  it("renders the approved compact information architecture without runtime duplication", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const markup = renderToStaticMarkup(
        <ThemeProvider>
          <LanguageProvider>
            <SettingsProvider>
              <DensityProvider>
                <AboutSettingsPanel />
              </DensityProvider>
            </SettingsProvider>
          </LanguageProvider>
        </ThemeProvider>
      );

      expect(markup).toContain("当前版本");
      expect(markup).toContain("当前 AE");
      expect(markup).toContain("未连接 AE");
      expect(markup).toContain("购买与授权");
      expect(markup).toContain("尚未接入");
      expect(markup).toContain("版本与更新");
      expect(markup).toContain("帮助与支持");
      expect(markup).toContain("诊断与信息");
      expect(markup).toContain("导出诊断信息");
      expect(markup).toContain("打开数据目录");
      expect(markup).toContain("特别感谢");
      expect(markup).not.toContain("扩展运行时");
      expect(markup).toContain('class="about-info-card about-license-panel"');
      expect(markup).toContain('class="about-info-card about-update-strip"');
      expect(markup).not.toContain('class="about-card-grid"');
    } finally {
      consoleError.mockRestore();
    }
  });

  it("enables the configured Feishu documentation and feedback actions", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const markup = renderToStaticMarkup(
        <ThemeProvider>
          <LanguageProvider>
            <SettingsProvider>
              <DensityProvider>
                <AboutSettingsPanel />
              </DensityProvider>
            </SettingsProvider>
          </LanguageProvider>
        </ThemeProvider>
      );

      expect(markup).toMatch(/<button(?![^>]*disabled)[^>]*>[\s\S]*?使用文档/);
      expect(markup).toMatch(/<button(?![^>]*disabled)[^>]*>[\s\S]*?问题反馈/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
