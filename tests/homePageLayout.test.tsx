import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { HomePage } from "../src/pages/HomePage";
import { SettingsProvider } from "../src/settings/SettingsProvider";

function renderHomePage(): string {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    return renderToStaticMarkup(
      <LanguageProvider>
        <SettingsProvider>
          <HomePage onEditLayout={() => undefined} />
        </SettingsProvider>
      </LanguageProvider>
    );
  } finally {
    consoleError.mockRestore();
  }
}

describe("HomePage layout settings", () => {
  it("renders the built-in layout name and all thirty-five slots", () => {
    const markup = renderHomePage();

    expect(markup).toContain("<h2>创作通用</h2>");
    expect(markup.match(/data-home-layout-group="true"/g)).toHaveLength(5);
    expect(markup.match(/data-home-layout-slot="true"/g)).toHaveLength(35);
    expect(markup).not.toContain("自定义快捷");
  });

  it("exposes the implemented layout editor without a coming-soon label", () => {
    const markup = renderHomePage();

    expect(markup).toContain('aria-label="编辑快捷工具"');
    expect(markup).not.toContain("编辑快捷工具（后续阶段实现）");
  });
});
