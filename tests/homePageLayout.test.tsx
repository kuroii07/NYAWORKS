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

function renderHomePage(
  showQuickPanels = true,
  overrides: Partial<typeof DEFAULT_HOME_SETTINGS> = {}
): string {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const storage = new MemoryStorage();
  storage.setItem(
    HOME_SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_HOME_SETTINGS, showQuickPanels, ...overrides })
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

  it("uses a distinct alignment grid and a single sliding mode indicator", () => {
    const markup = renderHomePage(true, { spaceMode: "align" });

    expect(markup).toContain('class="anchor-grid anchor-grid--align"');
    expect(markup).toContain('class="align-grid-icon"');
    expect(markup).toContain('class="spatial-mode-icon"');
    expect(markup).not.toContain('class="anchor-grid anchor-grid--anchor"');
    expect(markup.match(/data-active-index="0"/g)).toHaveLength(1);
    expect(markup.match(/data-active-index="1"/g)).toHaveLength(1);
  });

  it("exposes staggered motion metadata for the spatial grid", () => {
    const markup = renderHomePage(true, { spaceMode: "align" });

    expect(markup).toContain('data-spatial-motion="align"');
    expect(markup).toContain('class="spatial-grid__layer spatial-grid__layer--anchor"');
    expect(markup).toContain('class="spatial-grid__layer spatial-grid__layer--align"');
    expect(markup.match(/data-motion-index="[0-8]"/g)).toHaveLength(18);
    expect(markup.match(/--spatial-motion-index:/g)).toHaveLength(18);
  });

  it("renders both create and select motion layers for a unified switch", () => {
    const markup = renderHomePage(true, { createMode: "select" });

    expect(markup).toContain('data-create-motion="select"');
    expect(markup).toContain('class="create-grid__layer create-grid__layer--create"');
    expect(markup).toContain('class="create-grid__layer create-grid__layer--select"');
    expect(markup.match(/--create-motion-index:/g)).toHaveLength(18);
  });
});
