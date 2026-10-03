// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { ResourceHostBridge } from "../src/host/resourceBridge";
import {
  ResourceProvider,
  useResources,
  type ResourceContextValue
} from "../src/resources/ResourceProvider";
import {
  readStoredResourceSettings,
  writeStoredResourceSettings
} from "../src/resources/resourceStorage";
import type { ResourceSettings } from "../src/resources/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const customSource = {
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

const otherSource = {
  ...customSource,
  id: "custom:other",
  name: "其他脚本",
  path: "C:/Other"
};

function initialSettings(
  sources = [customSource],
  resources: ResourceSettings["index"]["resources"] = [
    {
      id: "custom:tools:legacy.jsx",
      sourceId: "custom:tools",
      resourceType: "script",
      name: "legacy",
      relativePath: "Legacy.jsx",
      modifiedAt: null,
      favorite: false,
      lastUsedAt: null,
      preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
    }
  ]
): ResourceSettings {
  return {
    schemaVersion: 1,
    customSources: sources,
    index: { resources, sourceStates: [] }
  };
}

function createBridge(
  overrides: Partial<ResourceHostBridge> = {}
): ResourceHostBridge {
  const defaults: ResourceHostBridge = {
    readCurrentAeSources: async () => ({
      status: "connected",
      hostVersion: "25.6",
      sources: [],
      isDevelopmentFixture: false
    }),
    scanSource: async (source) => ({
      sourceId: source.id,
      status: "ready",
      resources: []
    }),
    chooseDirectory: async () => ({ status: "cancelled", path: null }),
    openSourceDirectory: async () => ({ ok: false, reason: "unavailable" }),
    revealResourceFile: async () => ({ ok: false, reason: "unavailable" }),
    openResourceFile: async () => ({ ok: false, reason: "unavailable" }),
    useResource: async () => ({ ok: true }),
  };

  return {
    ...defaults,
    ...overrides,
    revealResourceFile:
      overrides.revealResourceFile ?? defaults.revealResourceFile,
    openResourceFile: overrides.openResourceFile ?? defaults.openResourceFile
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let context: ResourceContextValue | null = null;

function ResourceProbe() {
  context = useResources();
  return null;
}

async function renderProvider(
  bridge: ResourceHostBridge,
  storage: MemoryStorage,
  options: {
    copyText?: (text: string) => Promise<void>;
    now?: () => Date;
  } = {}
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <ResourceProvider
        bridge={bridge}
        storage={storage}
        copyText={options.copyText}
        now={options.now}
      >
        <ResourceProbe />
      </ResourceProvider>
    );
  });

  if (!context) {
    throw new Error("Resource context was not rendered");
  }

  return context;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  context = null;
});

describe("ResourceProvider scan lifecycle", () => {
  it("keeps the previous custom index when a source is missing", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const resourceContext = await renderProvider(
      createBridge({
        scanSource: async (source) => ({
          sourceId: source.id,
          status: "missing",
          resources: []
        })
      }),
      storage
    );

    await act(async () => {
      await resourceContext.refreshSource("custom:tools");
    });

    expect(context?.sources.find((source) => source.id === "custom:tools")?.status).toBe(
      "missing"
    );
    expect(context?.resources.map((resource) => resource.id)).toContain(
      "custom:tools:legacy.jsx"
    );
  });

  it("keeps cached resources while honestly exposing an unavailable host", async () => {
    const storage = new MemoryStorage();
    const settings = initialSettings([], [
      {
        id: "ae-default:scripts:utility.jsx",
        sourceId: "ae-default:scripts",
        resourceType: "script",
        name: "utility",
        relativePath: "Utility.jsx",
        modifiedAt: null,
        favorite: false,
        lastUsedAt: null,
        preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
      }
    ]);
    writeStoredResourceSettings(settings, storage);

    await renderProvider(
      createBridge({
        readCurrentAeSources: async () => ({
          status: "unavailable",
          hostVersion: null,
          sources: [],
          isDevelopmentFixture: false
        })
      }),
      storage
    );

    expect(context?.hostStatus).toBe("unavailable");
    expect(context?.resources.map((resource) => resource.id)).toContain(
      "ae-default:scripts:utility.jsx"
    );
  });

  it("removes cached built-in resources that are no longer exposed by the connected AE host", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(
      initialSettings([], [
        {
          id: "ae-default:scripts:utility.jsx",
          sourceId: "ae-default:scripts",
          resourceType: "script",
          name: "utility",
          relativePath: "Utility.jsx",
          modifiedAt: null,
          favorite: false,
          lastUsedAt: null,
          preview: {
            coverUri: null,
            loopUri: null,
            cacheKey: null,
            status: "none"
          }
        },
        {
          id: "ae-default:presets:bounce.ffx",
          sourceId: "ae-default:presets",
          resourceType: "preset",
          name: "bounce",
          relativePath: "Bounce.ffx",
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
      ]),
      storage
    );

    await renderProvider(
      createBridge({
        readCurrentAeSources: async () => ({
          status: "connected",
          hostVersion: "25.6",
          sources: [
            {
              id: "ae-default:scripts",
              kind: "ae-default",
              resourceType: "script",
              name: "AE Scripts",
              path: "C:/Adobe/Scripts",
              enabled: true,
              hostVersion: "25.6",
              status: "ready",
              lastScannedAt: null,
              lastError: null
            }
          ],
          isDevelopmentFixture: false
        })
      }),
      storage
    );

    expect(context?.resources.map((resource) => resource.id)).toEqual([
      "ae-default:scripts:utility.jsx"
    ]);
  });

  it("replaces only the successful source index", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const resourceContext = await renderProvider(
      createBridge({
        scanSource: async (source) => ({
          sourceId: source.id,
          status: "ready",
          resources: [{ relativePath: "New.jsx", modifiedAt: null }]
        })
      }),
      storage
    );

    await act(async () => {
      await resourceContext.refreshSource("custom:tools");
    });

    expect(context?.resources.map((resource) => resource.id)).toEqual([
      "custom:tools:new.jsx"
    ]);
  });

  it("persists favorite changes in the dedicated resource storage", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const resourceContext = await renderProvider(createBridge(), storage);

    await act(async () => {
      resourceContext.toggleFavorite("custom:tools:legacy.jsx");
    });

    expect(
      readStoredResourceSettings(storage).index.resources[0]?.favorite
    ).toBe(true);
  });

  it("exposes the host-only folder chooser through the resource boundary", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const resourceContext = await renderProvider(
      createBridge({
        chooseDirectory: async () => ({
          status: "selected",
          path: "C:/Tools/Animation"
        })
      }),
      storage
    );

    await expect(resourceContext.chooseDirectory()).resolves.toEqual({
      status: "selected",
      path: "C:/Tools/Animation"
    });
  });

  it("opens a source folder by source id through the host bridge", async () => {
    const storage = new MemoryStorage();
    const openedPaths: string[] = [];
    writeStoredResourceSettings(initialSettings(), storage);
    const resourceContext = await renderProvider(
      createBridge({
        openSourceDirectory: async (source) => {
          openedPaths.push(source.path);
          return { ok: true, path: source.path };
        }
      }),
      storage
    );

    await expect(resourceContext.openSourceDirectory("custom:tools")).resolves.toEqual({
      ok: true,
      path: "C:/Tools"
    });
    expect(openedPaths).toEqual(["C:/Tools"]);
  });

  it("indexes a newly added custom source immediately", async () => {
    const storage = new MemoryStorage();
    const scannedPaths: string[] = [];
    const resourceContext = await renderProvider(
      createBridge({
        scanSource: async (source) => {
          scannedPaths.push(source.path);
          return {
            sourceId: source.id,
            status: "ready",
            resources: [{ relativePath: "Animation/Loop.jsx", modifiedAt: null }]
          };
        }
      }),
      storage
    );

    await act(async () => {
      await resourceContext.addCustomSource({
        name: "动画脚本",
        resourceType: "script",
        path: "C:/Tools/Animation"
      });
    });

    expect(scannedPaths).toEqual(["C:/Tools/Animation"]);
    expect(context?.resources.map((resource) => resource.name)).toContain("Loop.jsx");
  });

  it("rescans the new directory when a custom source path changes", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const scannedPaths: string[] = [];
    const resourceContext = await renderProvider(
      createBridge({
        scanSource: async (source) => {
          scannedPaths.push(source.path);
          return {
            sourceId: source.id,
            status: "ready",
            resources: [{ relativePath: "Updated.jsx", modifiedAt: null }]
          };
        }
      }),
      storage
    );

    await act(async () => {
      await resourceContext.updateCustomSource("custom:tools", {
        path: "D:/Updated Tools"
      });
    });

    expect(scannedPaths).toEqual(["D:/Updated Tools"]);
    expect(context?.resources.map((resource) => resource.name)).toEqual([
      "Updated.jsx"
    ]);
  });

  it("does not rescan when only the source name or enabled state changes", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const scannedPaths: string[] = [];
    const resourceContext = await renderProvider(
      createBridge({
        scanSource: async (source) => {
          scannedPaths.push(source.path);
          return {
            sourceId: source.id,
            status: "ready",
            resources: []
          };
        }
      }),
      storage
    );

    await act(async () => {
      await resourceContext.updateCustomSource("custom:tools", {
        name: "动画工具"
      });
      await resourceContext.updateCustomSource("custom:tools", {
        enabled: false
      });
    });

    expect(scannedPaths).toEqual([]);
    expect(
      context?.sources.find((source) => source.id === "custom:tools")
    ).toMatchObject({
      name: "动画工具",
      enabled: false
    });
  });

  it("rescans when a custom source changes from script to preset", async () => {
    const storage = new MemoryStorage();
    const scannedTypes: string[] = [];
    writeStoredResourceSettings(initialSettings(), storage);
    const resourceContext = await renderProvider(
      createBridge({
        scanSource: async (source) => {
          scannedTypes.push(source.resourceType);
          return { sourceId: source.id, status: "ready", resources: [] };
        }
      }),
      storage
    );

    await act(async () => {
      await resourceContext.updateCustomSource("custom:tools", {
        resourceType: "preset"
      });
    });

    expect(scannedTypes).toEqual(["preset"]);
    expect(context?.sources.find((source) => source.id === "custom:tools")?.resourceType).toBe("preset");
  });

  it("uses an indexed resource through its owning source", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const usedResources: string[] = [];
    const resourceContext = await renderProvider(
      createBridge({
        useResource: async (source, resource) => {
          usedResources.push(`${source.path}/${resource.relativePath}`);
          return { ok: true };
        }
      }),
      storage
    );

    await expect(
      resourceContext.useResource("custom:tools:legacy.jsx")
    ).resolves.toEqual({ ok: true });
    expect(usedResources).toEqual(["C:/Tools/Legacy.jsx"]);
  });

  it("removes only the deleted custom source and its indexed resources", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(
      initialSettings([customSource, otherSource], [
        ...initialSettings().index.resources,
        {
          id: "custom:other:keep.jsx",
          sourceId: "custom:other",
          resourceType: "script",
          name: "keep",
          relativePath: "Keep.jsx",
          modifiedAt: null,
          favorite: false,
          lastUsedAt: null,
          preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
        }
      ]),
      storage
    );
    const resourceContext = await renderProvider(createBridge(), storage);

    await act(async () => {
      resourceContext.removeCustomSource("custom:tools");
    });

    expect(context?.sources.map((source) => source.id)).toEqual(["custom:other"]);
    expect(context?.resources.map((resource) => resource.id)).toEqual([
      "custom:other:keep.jsx"
    ]);
  });
});

describe("ResourceProvider command execution", () => {
  it("returns the typed commands for an indexed resource", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const resourceContext = await renderProvider(createBridge(), storage);

    expect(resourceContext.getResourceCommands("custom:tools:legacy.jsx")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "resource.use", labelKey: "runScript" }),
        expect.objectContaining({ id: "resource.file.open-default" })
      ])
    );
    expect(resourceContext.getResourceCommands("missing")).toEqual([]);
  });

  it("runs the primary command once and persists only that resource last-used time", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(
      initialSettings([customSource, otherSource], [
        ...initialSettings().index.resources,
        {
          ...initialSettings().index.resources[0],
          id: "custom:other:keep.jsx",
          sourceId: "custom:other",
          name: "keep",
          relativePath: "Keep.jsx"
        }
      ]),
      storage
    );
    const usedIds: string[] = [];
    const resourceContext = await renderProvider(
      createBridge({
        useResource: async (_source, usedResource) => {
          usedIds.push(usedResource.id);
          return { ok: true, affectedItems: 2 };
        }
      }),
      storage,
      { now: () => new Date("2026-10-03T12:00:00.000Z") }
    );

    let result: Awaited<ReturnType<ResourceContextValue["runResourceCommand"]>> | null = null;
    await act(async () => {
      result = await resourceContext.runResourceCommand(
        "resource.use",
        "custom:tools:legacy.jsx"
      );
    });
    expect(result).toMatchObject({ ok: true, affectedItems: 2 });
    expect(usedIds).toEqual(["custom:tools:legacy.jsx"]);
    expect(
      readStoredResourceSettings(storage).index.resources.map((item) => [
        item.id,
        item.lastUsedAt
      ])
    ).toEqual([
      ["custom:tools:legacy.jsx", "2026-10-03T12:00:00.000Z"],
      ["custom:other:keep.jsx", null]
    ]);
  });

  it("rejects a second primary command while the same resource is running", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const pendingUse = deferred<{ ok: true }>();
    let useCalls = 0;
    const resourceContext = await renderProvider(
      createBridge({
        useResource: async () => {
          useCalls += 1;
          return pendingUse.promise;
        }
      }),
      storage
    );

    const first = resourceContext.runResourceCommand(
      "resource.use",
      "custom:tools:legacy.jsx"
    );
    await expect(
      resourceContext.runResourceCommand(
        "resource.use",
        "custom:tools:legacy.jsx"
      )
    ).resolves.toMatchObject({ ok: false, reason: "command-in-progress" });
    expect(useCalls).toBe(1);
    pendingUse.resolve({ ok: true });
    await expect(first).resolves.toMatchObject({ ok: true });
  });

  it("runs favorite, refresh, clipboard, reveal, and default-open commands", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const calls: string[] = [];
    const resourceContext = await renderProvider(
      createBridge({
        scanSource: async (scannedSource) => {
          calls.push(`refresh:${scannedSource.id}`);
          return {
            sourceId: scannedSource.id,
            status: "ready",
            resources: [{ relativePath: "Legacy.jsx", modifiedAt: null }]
          };
        },
        revealResourceFile: async (_source, target) => {
          calls.push(`reveal:${target.id}`);
          return { ok: true, path: "C:/Tools/Legacy.jsx" };
        },
        openResourceFile: async (_source, target) => {
          calls.push(`open:${target.id}`);
          return { ok: true, path: "C:/Tools/Legacy.jsx" };
        }
      }),
      storage,
      { copyText: async (text) => { calls.push(`copy:${text}`); } }
    );

    for (const commandId of [
      "resource.favorite.toggle",
      "resource.path.copy",
      "resource.file.reveal",
      "resource.file.open-default",
      "resource.source.refresh"
    ] as const) {
      let result: Awaited<ReturnType<ResourceContextValue["runResourceCommand"]>> | null = null;
      await act(async () => {
        result = await resourceContext.runResourceCommand(
          commandId,
          "custom:tools:legacy.jsx"
        );
      });
      expect(result).toMatchObject({ ok: true, commandId });
    }

    expect(calls).toEqual([
      "copy:C:/Tools/Legacy.jsx",
      "reveal:custom:tools:legacy.jsx",
      "open:custom:tools:legacy.jsx",
      "refresh:custom:tools"
    ]);
    expect(
      readStoredResourceSettings(storage).index.resources[0]?.favorite
    ).toBe(true);
  });

  it("uses the browser clipboard when no clipboard adapter is injected", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const copied: string[] = [];
    const priorClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { copied.push(text); } }
    });
    try {
      const resourceContext = await renderProvider(createBridge(), storage);
      await expect(
        resourceContext.runResourceCommand(
          "resource.path.copy",
          "custom:tools:legacy.jsx"
        )
      ).resolves.toMatchObject({ ok: true });
      expect(copied).toEqual(["C:/Tools/Legacy.jsx"]);
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: priorClipboard
      });
    }
  });

  it("falls back to a temporary textarea when browser clipboard is unavailable", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const priorClipboard = navigator.clipboard;
    const priorExecCommand = document.execCommand;
    let copiedValue = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined
    });
    document.execCommand = (command) => {
      copiedValue = command === "copy"
        ? document.querySelector<HTMLTextAreaElement>("textarea")?.value ?? ""
        : "";
      return command === "copy";
    };
    try {
      const resourceContext = await renderProvider(createBridge(), storage);
      await expect(
        resourceContext.runResourceCommand(
          "resource.path.copy",
          "custom:tools:legacy.jsx"
        )
      ).resolves.toMatchObject({ ok: true });
      expect(copiedValue).toBe("C:/Tools/Legacy.jsx");
      expect(document.querySelector("textarea")).toBeNull();
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: priorClipboard
      });
      document.execCommand = priorExecCommand;
    }
  });

  it("keeps an in-flight command bound to its original resource", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const pendingUse = deferred<{ ok: true }>();
    const usedIds: string[] = [];
    const resourceContext = await renderProvider(
      createBridge({
        useResource: async (_source, usedResource) => {
          usedIds.push(usedResource.id);
          return pendingUse.promise;
        }
      }),
      storage
    );
    const pending = resourceContext.runResourceCommand(
      "resource.use",
      "custom:tools:legacy.jsx"
    );

    await act(async () => {
      resourceContext.toggleFavorite("custom:tools:legacy.jsx");
    });
    pendingUse.resolve({ ok: true });
    await expect(pending).resolves.toMatchObject({
      ok: true,
      resourceId: "custom:tools:legacy.jsx"
    });
    expect(usedIds).toEqual(["custom:tools:legacy.jsx"]);
  });

  it("does not persist an async command result after unmount", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(initialSettings(), storage);
    const pendingUse = deferred<{ ok: true }>();
    const resourceContext = await renderProvider(
      createBridge({
        useResource: async () => pendingUse.promise
      }),
      storage,
      { now: () => new Date("2026-10-03T12:00:00.000Z") }
    );
    const pending = resourceContext.runResourceCommand(
      "resource.use",
      "custom:tools:legacy.jsx"
    );

    act(() => root?.unmount());
    root = null;
    pendingUse.resolve({ ok: true });
    await pending;

    expect(
      readStoredResourceSettings(storage).index.resources[0]?.lastUsedAt
    ).toBeNull();
  });
});
