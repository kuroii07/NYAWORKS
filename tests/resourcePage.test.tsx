import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { ResourcesPage } from "../src/pages/ResourcesPage";
import { ResourceProvider, type ResourceStorage } from "../src/resources/ResourceProvider";
import { writeStoredResourceSettings } from "../src/resources/resourceStorage";

class MemoryStorage implements ResourceStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function renderPage(): string {
  const storage = new MemoryStorage();
  writeStoredResourceSettings(
    {
      schemaVersion: 1,
      customSources: [
        {
          id: "custom:tools",
          kind: "custom",
          resourceType: "script",
          name: "我的脚本",
          path: "C:/Tools",
          enabled: true,
          hostVersion: null,
          status: "ready",
          lastScannedAt: null,
          lastError: null
        },
        {
          id: "custom:presets",
          kind: "custom",
          resourceType: "preset",
          name: "我的预设",
          path: "C:/Presets",
          enabled: true,
          hostVersion: null,
          status: "ready",
          lastScannedAt: null,
          lastError: null
        }
      ],
      index: {
        sourceStates: [],
        resources: [
          {
            id: "custom:tools:animation/loop.jsx",
            sourceId: "custom:tools",
            resourceType: "script",
            name: "Loop.jsx",
            relativePath: "Animation/Loop.jsx",
            modifiedAt: null,
            favorite: false,
            lastUsedAt: null,
            preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
          },
          {
            id: "custom:presets:shapes/bounce.ffx",
            sourceId: "custom:presets",
            resourceType: "preset",
            name: "Bounce.ffx",
            relativePath: "Shapes/Bounce.ffx",
            modifiedAt: null,
            favorite: false,
            lastUsedAt: null,
            preview: {
              coverUri: "fixture://bounce-cover.png",
              loopUri: null,
              cacheKey: "fixture-bounce",
              status: "ready"
            }
          }
        ]
      }
    },
    storage
  );
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    return renderToStaticMarkup(
      <LanguageProvider>
        <ResourceProvider storage={storage}>
          <ResourcesPage />
        </ResourceProvider>
      </LanguageProvider>
    );
  } finally {
    consoleError.mockRestore();
  }
}

describe("local resources page", () => {
  it("renders search, filters, grouped source tree, and source index status", () => {
    const markup = renderPage();

    expect(markup).toContain('type="search"');
    expect(markup).toContain("全部类型");
    expect(markup).toContain("全部来源");
    expect(markup).toContain("我的脚本");
    expect(markup).toContain("资源总数");
    expect(markup).toContain("resource-folder-tree__source-toggle");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain(">Animation</button>");
    expect(markup).not.toContain('aria-label="按资源来源筛选"');
  });

  it("renders compact resource rows without path or legacy actions", () => {
    const markup = renderPage();

    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('role="option"');
    expect(markup).toContain('class="resource-list-row"');
    expect(markup).not.toContain('class="resource-preview-card"');
    expect(markup).not.toContain("Animation / Loop.jsx");
    expect(markup).not.toContain("复制路径");
    expect(markup).not.toContain("在文件夹中显示");
    expect(markup).not.toContain("刷新来源");
    expect(markup).toContain("Loop.jsx");
    expect(markup).toContain("Bounce.ffx");
    expect(markup).toContain("收藏");
  });

  it("offers compact all, favorites, and recent resource views", () => {
    const markup = renderPage();

    expect(markup).toContain("resource-all-toggle");
    expect(markup).toContain("收藏");
    expect(markup).toContain("resource-favorites-toggle");
    expect(markup).toContain("resource-recent-toggle");
    expect(markup).toContain('aria-label="资源排序"');
  });

  it("keeps the title count and each resource favorite control in their row layout", () => {
    const markup = renderPage();
    expect(markup).toContain('class="resources-page__count"');
    expect(markup).toContain('class="resource-list-row__actions"');
  });

});
