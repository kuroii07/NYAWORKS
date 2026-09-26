import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESOURCE_SETTINGS,
  RESOURCE_SETTINGS_SCHEMA_VERSION
} from "../src/resources/types";
import {
  normalizeResourceSettings,
  readStoredResourceSettings,
  RESOURCE_SETTINGS_STORAGE_KEY,
  writeStoredResourceSettings
} from "../src/resources/resourceStorage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("resource settings storage", () => {
  it("returns an empty safe library when no stored data exists", () => {
    expect(readStoredResourceSettings()).toEqual(DEFAULT_RESOURCE_SETTINGS);
  });

  it("rejects unknown schemas and corrupt JSON without touching defaults", () => {
    const storage = new MemoryStorage();
    storage.setItem(RESOURCE_SETTINGS_STORAGE_KEY, "{broken");

    expect(readStoredResourceSettings(storage)).toEqual(
      DEFAULT_RESOURCE_SETTINGS
    );
    expect(normalizeResourceSettings({ schemaVersion: 999 })).toEqual(
      DEFAULT_RESOURCE_SETTINGS
    );
  });

  it("normalizes valid custom sources and persists only supported data", () => {
    const storage = new MemoryStorage();
    const normalized = normalizeResourceSettings({
      schemaVersion: RESOURCE_SETTINGS_SCHEMA_VERSION,
      customSources: [
        {
          id: "custom:tools",
          kind: "custom",
          resourceType: "script",
          name: "  我的脚本  ",
          path: "C:\\Tools\\",
          enabled: true,
          hostVersion: "25.0",
          status: "ready",
          lastScannedAt: "2026-09-26T12:00:00.000Z",
          lastError: "raw stack must not survive"
        }
      ],
      index: {
        resources: [],
        sourceStates: []
      }
    });

    writeStoredResourceSettings(normalized, storage);

    expect(readStoredResourceSettings(storage)).toEqual({
      ...normalized,
      customSources: [
        {
          ...normalized.customSources[0],
          name: "我的脚本",
          path: "C:/Tools",
          hostVersion: null,
          lastError: null
        }
      ]
    });
  });

  it("does not treat AE-managed panel and startup locations as custom source types", () => {
    expect(
      normalizeResourceSettings({
        schemaVersion: RESOURCE_SETTINGS_SCHEMA_VERSION,
        customSources: [
          {
            id: "custom:panel",
            kind: "custom",
            resourceType: "panel",
            name: "不支持的自定义面板来源",
            path: "C:/Panels"
          }
        ],
        index: { resources: [], sourceStates: [] }
      }).customSources
    ).toEqual([]);
  });
});
