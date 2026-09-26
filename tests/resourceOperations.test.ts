import { describe, expect, it } from "vitest";
import { DEFAULT_RESOURCE_SETTINGS } from "../src/resources/types";
import {
  buildResourceFolderTree,
  createCustomResourceSource,
  filterIndexedResources,
  mergeScanResult,
  normalizeResourceScanResult,
  removeCustomResourceSource,
  toggleResourceFavorite
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
});
