import { describe, expect, it } from "vitest";
import {
  buildResourceAbsolutePath,
  getResourceCommandItems,
  runResourceCommand,
  resolveResourceCommandContext
} from "../src/resources/resourceCommands";
import type {
  IndexedResource,
  ResourceSource,
  ResourceType
} from "../src/resources/types";

const source: ResourceSource = {
  id: "custom:tools",
  kind: "custom",
  resourceType: "script",
  name: "My Tools",
  path: "C:\\Tools\\",
  enabled: true,
  hostVersion: null,
  status: "ready",
  lastScannedAt: null,
  lastError: null
};

const resource: IndexedResource = {
  id: "custom:tools:animation/loop.jsx",
  sourceId: source.id,
  resourceType: "script",
  name: "Loop",
  relativePath: "/Animation/Loop.jsx",
  modifiedAt: null,
  favorite: false,
  lastUsedAt: null,
  preview: {
    coverUri: null,
    loopUri: null,
    cacheKey: null,
    status: "none"
  }
};

describe("resource command context", () => {
  it("joins the source root and relative path without changing display characters", () => {
    expect(buildResourceAbsolutePath(source, resource)).toBe(
      "C:/Tools/Animation/Loop.jsx"
    );
    expect(
      buildResourceAbsolutePath(
        { ...source, path: "D:/小黑 资源/脚本" },
        { ...resource, relativePath: "动画/常用 工具.jsx" }
      )
    ).toBe("D:/小黑 资源/脚本/动画/常用 工具.jsx");
  });

  it.each([
    "../outside.jsx",
    "Animation/../outside.jsx",
    "Animation/evil\r.jsx",
    "Animation/evil\n.jsx",
    'Animation/evil".jsx'
  ])("rejects an unsafe relative path: %s", (relativePath) => {
    expect(
      buildResourceAbsolutePath(source, { ...resource, relativePath })
    ).toBeNull();
  });

  it("rejects a resource owned by a different source", () => {
    expect(
      buildResourceAbsolutePath(source, {
        ...resource,
        sourceId: "custom:other"
      })
    ).toBeNull();
    expect(
      resolveResourceCommandContext(
        resource.id,
        [{ ...resource, sourceId: "custom:other" }],
        [source],
        "connected"
      )
    ).toMatchObject({ ok: false, reason: "invalid-resource" });
  });

  it("rejects missing, disabled, or unknown resource ownership", () => {
    expect(
      resolveResourceCommandContext(resource.id, [resource], [], "connected")
    ).toMatchObject({ ok: false, reason: "invalid-resource" });
    expect(
      resolveResourceCommandContext(
        resource.id,
        [resource],
        [{ ...source, enabled: false }],
        "connected"
      )
    ).toMatchObject({ ok: false, reason: "invalid-resource" });
    expect(
      resolveResourceCommandContext("missing", [resource], [source], "connected")
    ).toMatchObject({ ok: false, reason: "invalid-resource" });
  });
});

function contextFor(
  resourceType: ResourceType,
  relativePath: string,
  overrides: Partial<IndexedResource> = {},
  hostStatus: "connected" | "unavailable" = "connected"
) {
  const typedSource: ResourceSource = {
    ...source,
    id: `custom:${resourceType}`,
    resourceType
  };
  const typedResource: IndexedResource = {
    ...resource,
    id: `${typedSource.id}:${relativePath.toLowerCase()}`,
    sourceId: typedSource.id,
    resourceType,
    relativePath,
    ...overrides
  };
  const context = resolveResourceCommandContext(
    typedResource.id,
    [typedResource],
    [typedSource],
    hostStatus
  );
  if (!context.ok) throw new Error("fixture did not produce a context");
  return context;
}

describe("resource command registry", () => {
  it.each([
    ["script", "Tool.jsx", "runScript", "Enter"],
    ["panel", "Panel.jsx", "openPanel", undefined],
    ["startup", "Boot.jsx", "runStartupOnce", "Enter"],
    ["preset", "Bounce.ffx", "applyPreset", "Enter"],
    ["expression", "Wiggle.txt", "applyExpression", "Enter"]
  ] as const)("gives %s its typed primary action", (type, path, labelKey, shortcut) => {
    const primary = getResourceCommandItems(contextFor(type, path))[0];
    expect(primary).toMatchObject({
      id: "resource.use",
      group: "primary",
      labelKey,
      enabled: true
    });
    expect(primary.shortcut).toBe(shortcut);
  });

  it("does not expose source refresh or resource info in the context menu", () => {
    const items = getResourceCommandItems(contextFor("script", "Tool.jsx"));
    expect(items.map((item) => item.id)).toEqual([
      "resource.use",
      "resource.favorite.toggle",
      "resource.path.copy",
      "resource.file.reveal",
      "resource.file.open-default"
    ]);
  });

  it("changes the favorite label without changing the command id", () => {
    const regular = getResourceCommandItems(contextFor("script", "Tool.jsx"));
    const favorite = getResourceCommandItems(
      contextFor("script", "Tool.jsx", { favorite: true })
    );
    expect(
      regular.find((item) => item.id === "resource.favorite.toggle")
    ).toMatchObject({ labelKey: "favorite", enabled: true });
    expect(
      favorite.find((item) => item.id === "resource.favorite.toggle")
    ).toMatchObject({ labelKey: "unfavorite", enabled: true });
  });

  it.each([
    ["script", "Tool.jsx", true],
    ["script", "Tool.js", true],
    ["script", "Tool.jsxbin", false],
    ["startup", "Boot.jsx", true],
    ["preset", "Bounce.ffx", false],
    ["panel", "Panel.jsx", false],
    ["expression", "Wiggle.jsx", true],
    ["expression", "Wiggle.txt", true],
    ["expression", "Wiggle.json", true]
  ] as const)(
    "sets default-editor visibility for %s %s",
    (type, path, visible) => {
      const items = getResourceCommandItems(contextFor(type, path));
      expect(
        items.some((item) => item.id === "resource.file.open-default")
      ).toBe(visible);
    }
  );

  it("disables host commands while keeping cached commands available", () => {
    const items = getResourceCommandItems(
      contextFor("script", "Tool.jsx", {}, "unavailable")
    );
    for (const id of [
      "resource.use",
      "resource.file.reveal",
      "resource.file.open-default"
    ]) {
      expect(items.find((item) => item.id === id)).toMatchObject({
        enabled: false,
        disabledReason: "host-unavailable"
      });
    }
    for (const id of [
      "resource.favorite.toggle",
      "resource.path.copy"
    ]) {
      expect(items.find((item) => item.id === id)).toMatchObject({
        enabled: true
      });
    }
  });
});

describe("resource command runner", () => {
  function createDependencies() {
    const calls: string[] = [];
    return {
      calls,
      dependencies: {
        async useResource(resourceId: string) {
          calls.push(`use:${resourceId}`);
          return { ok: true as const, affectedItems: 3 };
        },
        toggleFavorite(resourceId: string) {
          calls.push(`favorite:${resourceId}`);
        },
        async refreshSource(sourceId: string) {
          calls.push(`refresh:${sourceId}`);
        },
        async copyText(text: string) {
          calls.push(`copy:${text}`);
        },
        async revealFile(commandContext: { absolutePath: string }) {
          calls.push(`reveal:${commandContext.absolutePath}`);
          return { ok: true as const, path: commandContext.absolutePath };
        },
        async openDefault(commandContext: { absolutePath: string }) {
          calls.push(`open:${commandContext.absolutePath}`);
          return { ok: true as const, path: commandContext.absolutePath };
        }
      }
    };
  }

  it.each([
    ["resource.use", "use:custom:script:tool.jsx", 3],
    ["resource.favorite.toggle", "favorite:custom:script:tool.jsx", undefined],
    ["resource.path.copy", "copy:C:/Tools/Tool.jsx", undefined],
    ["resource.file.reveal", "reveal:C:/Tools/Tool.jsx", undefined],
    ["resource.file.open-default", "open:C:/Tools/Tool.jsx", undefined],
    ["resource.source.refresh", "refresh:custom:script", undefined]
  ] as const)("runs %s through its one dependency", async (id, call, count) => {
    const { calls, dependencies } = createDependencies();
    const result = await runResourceCommand(
      id,
      contextFor("script", "Tool.jsx"),
      dependencies
    );
    expect(result).toMatchObject({
      ok: true,
      commandId: id,
      ...(count === undefined ? {} : { affectedItems: count })
    });
    expect(calls).toEqual([call]);
  });

  it("returns read-only resource information without invoking dependencies", async () => {
    const { calls, dependencies } = createDependencies();
    const result = await runResourceCommand(
      "resource.info.view",
      contextFor("script", "Tool.jsx", {
        name: "Quick Tool",
        modifiedAt: "2026-10-03T12:00:00.000Z",
        favorite: true
      }),
      dependencies
    );
    expect(result).toMatchObject({
      ok: true,
      info: {
        name: "Quick Tool",
        resourceType: "script",
        sourceName: "My Tools",
        absolutePath: "C:/Tools/Tool.jsx",
        modifiedAt: "2026-10-03T12:00:00.000Z",
        favorite: true
      }
    });
    expect(calls).toEqual([]);
  });

  it("normalizes dependency failures and exceptions", async () => {
    const { dependencies } = createDependencies();
    await expect(
      runResourceCommand(
        "resource.file.reveal",
        contextFor("script", "Tool.jsx"),
        {
          ...dependencies,
          revealFile: async () => ({
            ok: false,
            reason: "system-open-failed" as const
          })
        }
      )
    ).resolves.toMatchObject({ ok: false, reason: "system-open-failed" });
    await expect(
      runResourceCommand(
        "resource.path.copy",
        contextFor("script", "Tool.jsx"),
        {
          ...dependencies,
          copyText: async () => {
            throw new Error("denied");
          }
        }
      )
    ).resolves.toMatchObject({ ok: false, reason: "clipboard-failed" });
    await expect(
      runResourceCommand(
        "resource.source.refresh",
        contextFor("script", "Tool.jsx"),
        {
          ...dependencies,
          refreshSource: async () => {
            throw new Error("scan failed");
          }
        }
      )
    ).resolves.toMatchObject({ ok: false, reason: "host-error" });
  });

  it("returns the availability failure without invoking a disabled command", async () => {
    const { calls, dependencies } = createDependencies();
    const result = await runResourceCommand(
      "resource.use",
      contextFor("script", "Tool.jsx", {}, "unavailable"),
      dependencies
    );
    expect(result).toMatchObject({ ok: false, reason: "host-unavailable" });
    expect(calls).toEqual([]);
  });
});
