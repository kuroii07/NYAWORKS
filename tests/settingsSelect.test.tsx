import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DensityProvider } from "../src/density/DensityProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { SettingsPage } from "../src/pages/SettingsPage";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";

function renderSettingsPage(
  options: {
    initialTab?: "general" | "home";
    editHomeOnOpen?: boolean;
  } = {}
): string {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    return renderToStaticMarkup(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsProvider>
            <DensityProvider>
              <SettingsPage
                onResetComplete={() => undefined}
                initialTab={options.initialTab}
                editHomeOnOpen={options.editHomeOnOpen}
              />
            </DensityProvider>
          </SettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    );
  } finally {
    consoleError.mockRestore();
  }
}

describe("settings dropdown controls", () => {
  it("renders every settings dropdown as the shared custom listbox control", () => {
    const markup = renderSettingsPage();

    expect(markup).not.toContain("<select");
    expect(markup.match(/aria-haspopup="listbox"/g)).toHaveLength(3);
    expect(markup).toContain('aria-label="启动页面"');
    expect(markup).toContain('aria-label="提示延迟"');
    expect(markup).toContain('aria-label="当前语言"');
  });

  it("renders the theme-relative interface brightness control", () => {
    const markup = renderSettingsPage();

    expect(markup).toContain('type="range"');
    expect(markup).toContain('min="90"');
    expect(markup).toContain('max="110"');
    expect(markup).toContain('aria-label="界面亮度"');
    expect(markup).toContain("100%");
  });

  it("opens the home settings tab directly in layout editing mode", () => {
    const markup = renderSettingsPage({
      initialTab: "home",
      editHomeOnOpen: true
    });

    expect(markup).toContain("首页布局");
    expect(markup).toContain("完成编辑");
    expect(markup).not.toContain('aria-label="启动页面"');
  });
});
