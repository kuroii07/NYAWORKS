import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { HomePage } from "../src/pages/HomePage";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { HOME_SETTINGS_STORAGE_KEY } from "../src/settings/homeSettingsStorage";
import { DEFAULT_HOME_SETTINGS } from "../src/settings/types";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function renderHomePage(showQuickPanels = true): string {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const storage = new MemoryStorage();
  storage.setItem(
    HOME_SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_HOME_SETTINGS, showQuickPanels })
  );
  vi.stubGlobal("window", { localStorage: storage });

  try {
    return renderToStaticMarkup(
      <LanguageProvider>
        <SettingsProvider>
          <HomePage onEditLayout={() => undefined} />
        </SettingsProvider>
      </LanguageProvider>
    );
  } finally {
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  }
}

describe("HomePage layout settings", () => {
  it("renders the built-in layout name and all forty slots", () => {
    const markup = renderHomePage();

    expect(markup).toContain("<h2>创作通用</h2>");
    expect(markup.match(/data-home-layout-group="true"/g)).toHaveLength(5);
    expect(markup.match(/data-home-layout-slot="true"/g)).toHaveLength(40);
    expect(markup).not.toContain("自定义快捷");
  });

  it("exposes the implemented layout editor without a coming-soon label", () => {
    const markup = renderHomePage();

    expect(markup).toContain('aria-label="编辑快捷工具"');
    expect(markup).not.toContain("编辑快捷工具（后续阶段实现）");
  });

  it("hides both quick panels when the home setting is disabled", () => {
    const markup = renderHomePage(false);

    expect(markup).not.toContain('class="quick-panels"');
    expect(markup).toContain('class="tool-groups"');
  });
});
