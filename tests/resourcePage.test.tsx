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
            name: "loop",
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
            name: "bounce",
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
  it("renders search, filters, source categories, and source index status", () => {
    const markup = renderPage();

    expect(markup).toContain('type="search"');
    expect(markup).toContain("全部类型");
    expect(markup).toContain("资源来源");
    expect(markup).toContain("资源索引");
    expect(markup).toContain("Animation");
  });

  it("keeps scripts as rows, uses cards only for preview-capable resources, and disables host actions", () => {
    const markup = renderPage();

    expect(markup).toContain('class="resource-list-row"');
    expect(markup).toContain('class="resource-preview-card"');
    expect(markup).toContain('src="fixture://bounce-cover.png"');
    expect(markup).not.toContain("<video");
    expect(markup).toContain("disabled");
    expect(markup).toContain("需在 After Effects 中使用");
  });
});
