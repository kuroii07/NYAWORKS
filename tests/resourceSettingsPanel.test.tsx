import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourceProvider } from "../src/resources/ResourceProvider";
import { ResourceSettingsPanel } from "../src/pages/ResourceSettingsPanel";
import { SettingsPage } from "../src/pages/SettingsPage";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import {
  writeStoredResourceSettings
} from "../src/resources/resourceStorage";
import type { ResourceStorage } from "../src/resources/ResourceProvider";

class MemoryStorage implements ResourceStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

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

function renderPopulatedPanel(): string {
  const storage = new MemoryStorage();
  writeStoredResourceSettings(
    {
      schemaVersion: 1,
      customSources: [
        {
          id: "custom:tools",
          kind: "custom",
          resourceType: "script",
          name: "常用脚本",
          path: "C:/Tools",
          enabled: true,
          hostVersion: null,
          status: "ready",
          lastScannedAt: "2026-09-29T08:30:00.000Z",
          lastError: null
        }
      ],
      index: {
        sourceStates: [
          {
            sourceId: "custom:tools",
            status: "ready",
            lastScannedAt: "2026-09-29T08:30:00.000Z",
            lastError: null,
            itemCount: 1
          }
        ],
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
            preview: {
              coverUri: null,
              loopUri: null,
              cacheKey: null,
              status: "none"
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

  it("shows source type, status, and indexed item count in each source summary", () => {
    const markup = renderPopulatedPanel();

    expect(markup).toContain("常用脚本");
    expect(markup).toContain("脚本");
    expect(markup).toContain("可用");
    expect(markup).toContain("资源数量 1");
  });

  it("shows clear empty states instead of blank source sections", () => {
    const markup = renderPanel();

    expect(markup).toContain("尚未检测到当前 AE 资源来源");
    expect(markup).toContain("尚未添加自定义资源来源");
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
