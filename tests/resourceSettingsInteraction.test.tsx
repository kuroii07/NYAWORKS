// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import type { ResourceHostBridge } from "../src/host/resourceBridge";
import { ResourceSettingsPanel } from "../src/pages/ResourceSettingsPanel";
import {
  ResourceProvider,
  type ResourceStorage
} from "../src/resources/ResourceProvider";
import { writeStoredResourceSettings } from "../src/resources/resourceStorage";
import type {
  IndexedResource,
  ResourceSource
} from "../src/resources/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class MemoryStorage implements ResourceStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const source: ResourceSource = {
  id: "ae-default:scripts",
  kind: "ae-default",
  resourceType: "script",
  name: "AE Scripts",
  path: "C:/Adobe/Support Files/Scripts",
  enabled: true,
  hostVersion: "25.6.0",
  status: "ready",
  lastScannedAt: null,
  lastError: null
};

const resource: IndexedResource = {
  id: "ae-default:scripts:animation/loop.jsx",
  sourceId: source.id,
  resourceType: "script",
  name: "Loop",
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
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("resource settings source contents", () => {
  it("defaults to all custom sources and filters by the selected resource type", async () => {
    const storage = new MemoryStorage();
    const presetSource: ResourceSource = {
      ...source,
      id: "custom:presets",
      kind: "custom",
      resourceType: "preset",
      name: "AE自用预设",
      path: "H:/A1_AE资源库/AE预设库",
      hostVersion: null
    };
    writeStoredResourceSettings(
      { schemaVersion: 1, customSources: [presetSource], index: { resources: [], sourceStates: [] } },
      storage
    );
    const bridge: ResourceHostBridge = {
      async readCurrentAeSources() {
        return { status: "connected", hostVersion: "25.6.0", sources: [source], isDevelopmentFixture: false };
      },
      async scanSource(scannedSource) {
        return { sourceId: scannedSource.id, status: "ready", resources: [] };
      },
      async chooseDirectory() {
        return { status: "cancelled", path: null };
      },
      async openSourceDirectory(openedSource) {
        return { ok: true, path: openedSource.path };
      },
      async revealResourceFile() {
        return { ok: false, reason: "unavailable" };
      },
      async openResourceFile() {
        return { ok: false, reason: "unavailable" };
      },
      async useResource() {
        return { ok: true };
      }
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <LanguageProvider>
          <ResourceProvider bridge={bridge} storage={storage}>
            <ResourceSettingsPanel />
          </ResourceProvider>
        </LanguageProvider>
      );
    });

    expect(container.textContent).toContain("AE Scripts");
    expect(container.textContent).toContain("AE自用预设");
    const filter = [...container.querySelectorAll<HTMLButtonElement>("button[aria-haspopup='listbox']")]
      .find((button) => button.getAttribute("aria-label") === "资源类型");
    expect(filter?.textContent).toContain("全部");

    await act(async () => filter?.click());
    const presetOption = [...document.querySelectorAll<HTMLButtonElement>("[role='option']")]
      .find((button) => button.textContent?.includes("预设"));
    expect(presetOption).toBeTruthy();
    await act(async () => presetOption?.click());

    expect(container.textContent).toContain("AE自用预设");
    expect(container.textContent).toContain("AE Scripts");
  });

  it("opens a source directory from its actions menu", async () => {
    const storage = new MemoryStorage();
    const openedSources: string[] = [];
    const bridge: ResourceHostBridge = {
      async readCurrentAeSources() {
        return {
          status: "connected",
          hostVersion: "25.6.0",
          sources: [source],
          isDevelopmentFixture: false
        };
      },
      async scanSource(scannedSource) {
        return { sourceId: scannedSource.id, status: "ready", resources: [] };
      },
      async chooseDirectory() {
        return { status: "cancelled", path: null };
      },
      async openSourceDirectory(openedSource) {
        openedSources.push(openedSource.path);
        return { ok: true, path: openedSource.path };
      },
      async revealResourceFile() {
        return { ok: false, reason: "unavailable" };
      },
      async openResourceFile() {
        return { ok: false, reason: "unavailable" };
      },
      async useResource() {
        return { ok: true };
      }
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <LanguageProvider>
          <ResourceProvider bridge={bridge} storage={storage}>
            <ResourceSettingsPanel />
          </ResourceProvider>
        </LanguageProvider>
      );
    });

    const menuButton = container.querySelector<HTMLButtonElement>(
      ".resource-source-row__menu-button"
    );
    await act(async () => menuButton?.click());

    const openDirectoryItem = [...document.querySelectorAll<HTMLButtonElement>(
      '.compact-action-menu [role="menuitem"]'
    )].find((button) => button.textContent?.includes("打开目录位置"));
    expect(openDirectoryItem).toBeTruthy();

    await act(async () => openDirectoryItem?.click());
    expect(openedSources).toEqual([source.path]);
  });

  it("shows indexed files inside an expanded source and uses them on double click", async () => {
    const storage = new MemoryStorage();
    const usedResourceIds: string[] = [];
    writeStoredResourceSettings(
      {
        schemaVersion: 1,
        customSources: [],
        index: {
          sourceStates: [],
          resources: [resource]
        }
      },
      storage
    );
    const bridge: ResourceHostBridge = {
      async readCurrentAeSources() {
        return {
          status: "connected",
          hostVersion: "25.6.0",
          sources: [source],
          isDevelopmentFixture: false
        };
      },
      async scanSource(scannedSource) {
        return {
          sourceId: scannedSource.id,
          status: "ready",
          resources: []
        };
      },
      async chooseDirectory() {
        return { status: "cancelled", path: null };
      },
      async openSourceDirectory() {
        return { ok: false, reason: "unavailable" };
      },
      async revealResourceFile() {
        return { ok: false, reason: "unavailable" };
      },
      async openResourceFile() {
        return { ok: false, reason: "unavailable" };
      },
      async useResource(_owningSource, usedResource) {
        usedResourceIds.push(usedResource.id);
        return { ok: true };
      }
    };

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <LanguageProvider>
          <ResourceProvider bridge={bridge} storage={storage}>
            <ResourceSettingsPanel />
          </ResourceProvider>
        </LanguageProvider>
      );
    });

    const sourceButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("AE Scripts")
    );
    expect(sourceButton).toBeTruthy();

    await act(async () => {
      sourceButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const folderLabels = [...container.querySelectorAll<HTMLElement>(".resource-source-folder__label")];
    for (const folderLabel of folderLabels) {
      await act(async () => folderLabel.click());
    }

    const resourceRow = container.querySelector<HTMLElement>(
      `[data-resource-id="${resource.id}"]`
    );
    expect(resourceRow?.tagName).toBe("DIV");
    expect(resourceRow?.getAttribute("title")).toBeNull();
    expect(resourceRow?.textContent).toContain("Loop");
    expect(resourceRow?.textContent).not.toContain("Animation/Loop.jsx");
    expect(container.querySelector(".resource-source-row__details")).toBeNull();

    await act(async () => {
      resourceRow?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true })
      );
    });

    expect(usedResourceIds).toEqual([resource.id]);
  });
});
