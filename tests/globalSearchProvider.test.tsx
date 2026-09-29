// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { ResourceProvider } from "../src/resources/ResourceProvider";
import type { ResourceHostBridge } from "../src/host/resourceBridge";
import type { GlobalSearchHostBridge } from "../src/host/globalSearchBridge";
import {
  GlobalSearchProvider,
  useGlobalSearch,
  type GlobalSearchContextValue
} from "../src/search/GlobalSearchProvider";
import { ActionServiceProvider } from "../src/actions/ActionServiceProvider";
import type { ActionService } from "../src/actions/service";
import type { ResourceSettings } from "../src/resources/types";
import { writeStoredResourceSettings } from "../src/resources/resourceStorage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

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

const resourceSettings: ResourceSettings = {
  schemaVersion: 1,
  customSources: [source],
  index: {
    resources: [{
      id: "custom:tools:quick.jsx",
      sourceId: source.id,
      resourceType: "script",
      name: "Quick Tool",
      relativePath: "Quick.jsx",
      modifiedAt: null,
      favorite: false,
      lastUsedAt: null,
      preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
    }],
    sourceStates: []
  }
};

function createResourceBridge(): ResourceHostBridge {
  return {
    readCurrentAeSources: async () => ({
      status: "connected",
      hostVersion: "25.6",
      sources: [],
      isDevelopmentFixture: false
    }),
    scanSource: async (candidate) => ({ sourceId: candidate.id, status: "ready", resources: [] }),
    chooseDirectory: async () => ({ status: "cancelled", path: null }),
    openSourceDirectory: async () => ({ ok: false, reason: "unavailable" }),
    useResource: async () => ({ ok: true })
  };
}

function createSearchBridge(overrides: Partial<GlobalSearchHostBridge> = {}): GlobalSearchHostBridge {
  return {
    readCurrentAeEffects: async () => ({
      status: "connected",
      effects: [{ id: "effect:blur", name: "Gaussian Blur", matchName: "ADBE Gaussian Blur 2", aliases: ["高斯模糊"] }],
      isDevelopmentFixture: false
    }),
    executeGlobalSearchAction: async () => ({ ok: true }),
    ...overrides
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let context: GlobalSearchContextValue | null = null;

function Probe() {
  context = useGlobalSearch();
  return null;
}

async function renderProviders(
  searchBridge: GlobalSearchHostBridge,
  storage: MemoryStorage,
  actionService?: ActionService
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LanguageProvider>
        <ResourceProvider bridge={createResourceBridge()} storage={storage}>
          <ActionServiceProvider service={actionService}>
            <GlobalSearchProvider bridge={searchBridge}>
              <Probe />
            </GlobalSearchProvider>
          </ActionServiceProvider>
        </ResourceProvider>
      </LanguageProvider>
    );
  });
  if (!context) throw new Error("Global search context was not rendered");
  return context;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  context = null;
});

describe("GlobalSearchProvider", () => {
  it("merges built-in tools, cached resources and current-AE effects", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(resourceSettings, storage);
    const value = await renderProviders(createSearchBridge(), storage);
    expect(value.search("Quick Tool").some((item) => item.kind === "script")).toBe(true);
    expect(value.search("Gaussian Blur").some((item) => item.kind === "effect")).toBe(true);
    expect(value.search("文字").some((item) => item.kind === "tool")).toBe(true);
  });

  it("refreshes effects explicitly and keeps built-in tools when host is unavailable", async () => {
    const storage = new MemoryStorage();
    const calls: string[] = [];
    const value = await renderProviders(createSearchBridge({
      readCurrentAeEffects: async () => {
        calls.push("effects");
        return { status: "unavailable", effects: [], isDevelopmentFixture: false };
      }
    }), storage);
    expect(value.search("文字").length).toBeGreaterThan(0);
    expect(calls).toEqual(["effects"]);
    await act(async () => { await value.refreshEffects(); });
    expect(calls).toEqual(["effects", "effects"]);
  });

  it("delegates indexed script execution through the correct bridge action", async () => {
    const storage = new MemoryStorage();
    writeStoredResourceSettings(resourceSettings, storage);
    const actions: unknown[] = [];
    const value = await renderProviders(createSearchBridge({
      executeGlobalSearchAction: async (action) => {
        actions.push(action);
        return { ok: true };
      }
    }), storage);
    const item = value.search("Quick Tool")[0];
    await act(async () => { await value.executeItem(item); });
    expect(actions).toEqual([{ action: "run-script", path: "C:/Tools/Quick.jsx" }]);
  });

  it("discovers anchor actions and executes them through the shared action service", async () => {
    const storage = new MemoryStorage();
    const actionIds: string[] = [];
    const bridgeActions: unknown[] = [];
    const value = await renderProviders(createSearchBridge({
      executeGlobalSearchAction: async (action) => {
        bridgeActions.push(action);
        return { ok: true };
      }
    }), storage, {
      run: async (actionId) => {
        actionIds.push(actionId);
        return { success: true, message: "ok" };
      }
    });

    const item = value.search("锚点 左上").find((candidate) =>
      candidate.actionId === "layer.anchor.top-left"
    );
    expect(item).toBeDefined();
    await act(async () => { await value.executeItem(item!); });
    expect(actionIds).toEqual(["layer.anchor.top-left"]);
    expect(bridgeActions).toEqual([]);
  });

  it("discovers alignment actions and executes them in smart mode", async () => {
    const storage = new MemoryStorage();
    const runs: Array<{ actionId: string; options: unknown }> = [];
    const value = await renderProviders(createSearchBridge(), storage, {
      run: async (actionId, options) => {
        runs.push({ actionId, options });
        return { success: true, message: "ok" };
      }
    });

    const item = value.index.items.find((candidate) =>
      candidate.actionId === "layer.align.left"
    );
    expect(item).toBeDefined();
    await act(async () => { await value.executeItem(item!); });
    expect(runs).toEqual([
      { actionId: "layer.align.left", options: undefined }
    ]);
  });
});
