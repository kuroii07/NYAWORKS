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
  return {
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
    ...overrides
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
  storage: MemoryStorage
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <ResourceProvider bridge={bridge} storage={storage}>
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
