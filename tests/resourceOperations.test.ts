import { describe, expect, it } from "vitest";
import { DEFAULT_RESOURCE_SETTINGS } from "../src/resources/types";
import {
  buildResourceFolderTree,
  createCustomResourceSource,
  displayResourcePath,
  filterIndexedResources,
  mergeScanResult,
  normalizeResourceScanResult,
  removeCustomResourceSource,
  sortIndexedResources,
  toggleResourceFavorite,
  updateCustomResourceSource
} from "../src/resources/resourceOperations";

describe("resource source and index operations", () => {
  it("creates a trimmed custom source with a portable directory path", () => {
    const source = createCustomResourceSource(
      {
        name: " 我的脚本 ",
        resourceType: "script",
        path: "C:\\Tools\\"
      },
      new Date("2026-09-26T12:00:00.000Z")
    );

    expect(source.name).toBe("我的脚本");
    expect(source.path).toBe("C:/Tools");
    expect(source.kind).toBe("custom");
    expect(source.hostVersion).toBeNull();
  });

  it("keeps resources unique by source and normalized relative path", () => {
    const source = {
      id: "custom:tools",
      kind: "custom" as const,
      resourceType: "script" as const,
      name: "我的脚本",
      path: "C:/Tools",
      enabled: true,
      hostVersion: null,
      status: "ready" as const,
      lastScannedAt: null,
      lastError: null
    };

    const normalized = normalizeResourceScanResult(source, {
      sourceId: source.id,
      status: "ready",
      resources: [
        { relativePath: "Utility\\Trim.jsx", modifiedAt: "2026-09-26" },
        { relativePath: "utility/trim.jsx", modifiedAt: "2026-09-27" }
      ]
    });

    expect(normalized.resources).toHaveLength(1);
    expect(normalized.resources[0]).toMatchObject({
      id: "custom:tools:utility/trim.jsx",
      relativePath: "Utility/Trim.jsx",
      resourceType: "script"
    });
  });

  it("rejects extensions that do not belong to the scanned source type", () => {
    const source = {
      id: "custom:tools",
      kind: "custom" as const,
      resourceType: "script" as const,
      name: "我的脚本",
      path: "C:/Tools",
      enabled: true,
      hostVersion: null,
      status: "ready" as const,
      lastScannedAt: null,
      lastError: null
    };

    const normalized = normalizeResourceScanResult(source, {
      sourceId: source.id,
      status: "ready",
      resources: [
        { relativePath: "tool.jsx", modifiedAt: null },
        { relativePath: "notes.txt", modifiedAt: null }
      ]
    });

    expect(normalized.resources.map((resource) => resource.relativePath)).toEqual([
      "tool.jsx"
    ]);
  });

  it("decodes URI-encoded names for every supported Unicode script", () => {
    const source = {
      id: "custom:tools",
      kind: "custom" as const,
      resourceType: "script" as const,
      name: "工具",
      path: "C:/Tools",
      enabled: true,
      hostVersion: null,
      status: "ready" as const,
      lastScannedAt: null,
      lastError: null
    };
    const normalized = normalizeResourceScanResult(source, {
      sourceId: source.id,
      status: "ready",
      resources: [
        { relativePath: "Scale%20Composition.jsx", modifiedAt: null },
        { relativePath: "%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87.jsx", modifiedAt: null },
        { relativePath: "%E7%B9%81%E9%AB%94%E5%B7%A5%E5%85%B7.jsx", modifiedAt: null },
        { relativePath: "%E6%97%A5%E6%9C%AC%E8%AA%9E.jsx", modifiedAt: null },
        { relativePath: "%ED%95%9C%EA%B5%AD%EC%96%B4.jsx", modifiedAt: null },
        { relativePath: "100%25%20Tool.jsx", modifiedAt: null }
      ]
    });

    expect(normalized.resources.map((resource) => resource.name)).toEqual([
      "Scale Composition.jsx",
      "简体中文.jsx",
      "繁體工具.jsx",
      "日本語.jsx",
      "한국어.jsx",
      "100% Tool.jsx"
    ]);
    expect(displayResourcePath("%E8%84%9A%E6%9C%AC/Tool.jsx")).toBe("脚本/Tool.jsx");
  });

  it("falls back safely when a filename contains malformed URI escapes", () => {
    const source = {
      id: "custom:tools",
      kind: "custom" as const,
      resourceType: "script" as const,
      name: "工具",
      path: "C:/Tools",
      enabled: true,
      hostVersion: null,
      status: "ready" as const,
      lastScannedAt: null,
      lastError: null
    };

    expect(() => normalizeResourceScanResult(source, {
      sourceId: source.id,
      status: "ready",
      resources: [{ relativePath: "broken%E4%A.jsx", modifiedAt: null }]
    })).not.toThrow();
    expect(normalizeResourceScanResult(source, {
      sourceId: source.id,
      status: "ready",
      resources: [{ relativePath: "broken%E4%A.jsx", modifiedAt: null }]
    }).resources[0]?.name).toBe("broken%E4%A.jsx");
  });

  it("retains a source index after a missing refresh and removes only the deleted source", () => {
    const source = createCustomResourceSource(
      { name: "工具", resourceType: "script", path: "C:/Tools" },
      new Date("2026-09-26T12:00:00.000Z")
    );
    const initial = mergeScanResult(
      { ...DEFAULT_RESOURCE_SETTINGS, customSources: [source] },
      {
        sourceId: source.id,
        status: "ready",
        resources: [{ relativePath: "tool.jsx", modifiedAt: null }]
      },
      "2026-09-26T12:00:00.000Z"
    );
    const missing = mergeScanResult(
      initial,
      { sourceId: source.id, status: "missing", resources: [] },
      "2026-09-26T12:01:00.000Z"
    );
    const favorited = toggleResourceFavorite(
      missing,
      missing.index.resources[0].id
    );
    const removed = removeCustomResourceSource(favorited, source.id);

    expect(missing.index.resources).toHaveLength(1);
    expect(missing.customSources[0].status).toBe("missing");
    expect(favorited.index.resources[0].favorite).toBe(true);
    expect(removed.customSources).toEqual([]);
    expect(removed.index.resources).toEqual([]);
  });

  it("allows a custom source to change resource type", () => {
    const source = createCustomResourceSource(
      { name: "预设库", resourceType: "script", path: "C:/Tools" },
      new Date("2026-09-30T12:00:00.000Z")
    );
    const updated = updateCustomResourceSource(
      { ...DEFAULT_RESOURCE_SETTINGS, customSources: [source] },
      source.id,
      { resourceType: "preset" }
    );

    expect(updated.customSources[0]?.resourceType).toBe("preset");
  });

  it("filters indexed resources and derives nested folders without storing them", () => {
    const resources = [
      {
        id: "custom:tools:animation/loop.jsx",
        sourceId: "custom:tools",
        resourceType: "script" as const,
        name: "loop",
        relativePath: "Animation/Loop.jsx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      },
      {
        id: "custom:tools:animation/text/type.ffx",
        sourceId: "custom:tools",
        resourceType: "preset" as const,
        name: "type",
        relativePath: "Animation/Text/Type.ffx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      }
    ];

    expect(filterIndexedResources({ ...DEFAULT_RESOURCE_SETTINGS, index: { resources, sourceStates: [] } }, "loop", "all")).toEqual([
      resources[0]
    ]);
    expect(filterIndexedResources({ ...DEFAULT_RESOURCE_SETTINGS, index: { resources, sourceStates: [] } }, "animation", "all")).toEqual([
      resources[0],
      resources[1]
    ]);
    expect(buildResourceFolderTree(resources)).toEqual([
      {
        name: "Animation",
        path: "animation",
        children: [
          {
            name: "Text",
            path: "animation/text",
            children: [],
            resourceIds: [resources[1].id]
          }
        ],
        resourceIds: [resources[0].id]
      }
    ]);
  });

  it("treats panels and startup scripts as scripts in the user-facing type filter", () => {
    const resources = [
      {
        id: "source:script",
        sourceId: "source",
        resourceType: "script" as const,
        name: "Script",
        relativePath: "Script.jsx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      },
      {
        id: "source:panel",
        sourceId: "source",
        resourceType: "panel" as const,
        name: "Panel",
        relativePath: "Panel.jsx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      },
      {
        id: "source:startup",
        sourceId: "source",
        resourceType: "startup" as const,
        name: "Startup",
        relativePath: "Startup.jsx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      },
      {
        id: "source:preset",
        sourceId: "source",
        resourceType: "preset" as const,
        name: "Preset",
        relativePath: "Preset.ffx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      }
    ];
    const settings = {
      ...DEFAULT_RESOURCE_SETTINGS,
      index: { resources, sourceStates: [] }
    };

    expect(
      filterIndexedResources(settings, "", "script").map((resource) => resource.id)
    ).toEqual(["source:script", "source:panel", "source:startup"]);
    expect(
      filterIndexedResources(settings, "", "preset").map((resource) => resource.id)
    ).toEqual(["source:preset"]);
  });

  it("uses decoded folder labels while retaining encoded internal paths", () => {
    const resources = [{
      id: "custom:tools:%E8%84%9A%E6%9C%AC/Tool.jsx",
      sourceId: "custom:tools",
      resourceType: "script" as const,
      name: "Tool",
      relativePath: "%E8%84%9A%E6%9C%AC/Tool.jsx",
      modifiedAt: null,
      favorite: false,
      lastUsedAt: null,
      preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
    }];

    expect(buildResourceFolderTree(resources)).toEqual([
      { name: "脚本", path: "%e8%84%9a%e6%9c%ac", children: [], resourceIds: [resources[0].id] }
    ]);
  });

  it("sorts resources by name, recent use, and favorite priority without mutating input", () => {
    const resources = [
      {
        id: "a",
        sourceId: "custom:tools",
        resourceType: "script" as const,
        name: "Beta",
        relativePath: "Beta.jsx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      },
      {
        id: "b",
        sourceId: "custom:tools",
        resourceType: "script" as const,
        name: "Alpha",
        relativePath: "Alpha.jsx",
        modifiedAt: null,
        favorite: true,
        lastUsedAt: "2026-10-04T10:00:00.000Z",
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      },
      {
        id: "c",
        sourceId: "custom:tools",
        resourceType: "script" as const,
        name: "Gamma",
        relativePath: "Gamma.jsx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: "2026-10-04T11:00:00.000Z",
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" as const }
      }
    ];

    expect(sortIndexedResources(resources, "name").map((resource) => resource.id)).toEqual([
      "b",
      "a",
      "c"
    ]);
    expect(sortIndexedResources(resources, "recent").map((resource) => resource.id)).toEqual([
      "c",
      "b",
      "a"
    ]);
    expect(sortIndexedResources(resources, "favorite").map((resource) => resource.id)).toEqual([
      "b",
      "a",
      "c"
    ]);
    expect(resources.map((resource) => resource.id)).toEqual(["a", "b", "c"]);
  });
});
