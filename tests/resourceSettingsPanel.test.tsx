import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourceProvider } from "../src/resources/ResourceProvider";
import { ResourceSettingsPanel } from "../src/pages/ResourceSettingsPanel";
import { SettingsPage } from "../src/pages/SettingsPage";
import { LanguageProvider } from "../src/i18n/LanguageProvider";

function renderPanel(): string {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    return renderToStaticMarkup(
      <LanguageProvider>
        <ResourceProvider>
          <ResourceSettingsPanel />
        </ResourceProvider>
      </LanguageProvider>
    );
  } finally {
    consoleError.mockRestore();
  }
}

describe("resource settings panel", () => {
  it("separates current AE sources from personal sources with an honest scan action", () => {
    const markup = renderPanel();

    expect(markup).toContain("当前 AE 内置来源");
    expect(markup).toContain("我的资源来源");
    expect(markup).toContain("更新资源索引");
    expect(markup).toContain("等待连接 After Effects");
  });

  it("uses the shared listbox control for custom source type selection", () => {
    const markup = renderPanel();

    expect(markup).not.toContain("<select");
    expect(markup.match(/aria-haspopup=\"listbox\"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="资源类型"');
  });

  it("replaces the resources settings placeholder without changing other tabs", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const markup = renderToStaticMarkup(
        <LanguageProvider>
          <ResourceProvider>
            <SettingsPage onResetComplete={() => undefined} initialTab="resources" />
          </ResourceProvider>
        </LanguageProvider>
      );

      expect(markup).toContain("当前 AE 内置来源");
      expect(markup).not.toContain("该设置页将在后续阶段实现");
    } finally {
      consoleError.mockRestore();
    }
  });
});
