// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { ToastProvider } from "../src/notifications/ToastProvider";
import { ResourcesPage } from "../src/pages/ResourcesPage";
import type { ResourceHostBridge } from "../src/host/resourceBridge";
import {
  ResourceProvider,
  type ResourceStorage
} from "../src/resources/ResourceProvider";
import {
  readStoredResourceSettings,
  writeStoredResourceSettings
} from "../src/resources/resourceStorage";
import type { IndexedResource, ResourceSource } from "../src/resources/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined
  });
});

class MemoryStorage implements ResourceStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const source: ResourceSource = {
  id: "custom:tools",
  kind: "custom",
  resourceType: "script",
  name: "My Tools",
  path: "C:/Tools",
  enabled: true,
  hostVersion: null,
  status: "ready",
  lastScannedAt: null,
  lastError: null
};

const resources: IndexedResource[] = ["Alpha", "Beta", "Gamma"].map((name) => ({
  id: `custom:tools:${name.toLowerCase()}.jsx`,
  sourceId: source.id,
  resourceType: "script",
  name,
  relativePath: `${name}.jsx`,
  modifiedAt: null,
  favorite: false,
  lastUsedAt: null,
  preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
}));

function createBridge(
  usedIds: string[],
  overrides: Partial<ResourceHostBridge> = {}
): ResourceHostBridge {
  const defaults: ResourceHostBridge = {
    async readCurrentAeSources() {
      return {
        status: "connected",
        hostVersion: "25.6",
        sources: [],
        isDevelopmentFixture: false
      };
    },
    async scanSource(scannedSource) {
      return { sourceId: scannedSource.id, status: "ready", resources: [] };
    },
    async chooseDirectory() {
      return { status: "cancelled", path: null };
    },
    async openSourceDirectory() {
      return { ok: false, reason: "unavailable" };
    },
    async revealResourceFile() {
      return { ok: true, path: "C:/Tools/Alpha.jsx" };
    },
    async openResourceFile() {
      return { ok: true, path: "C:/Tools/Alpha.jsx" };
    },
    async useResource(_source, resource) {
      usedIds.push(resource.id);
      return { ok: true };
    }
  };
  return { ...defaults, ...overrides };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = "";
});

async function renderPage(options: {
  sources?: ResourceSource[];
  resources?: IndexedResource[];
  bridge?: Partial<ResourceHostBridge>;
  copyText?: (text: string) => Promise<void>;
} = {}) {
  const storage = new MemoryStorage();
  const usedIds: string[] = [];
  writeStoredResourceSettings({
    schemaVersion: 1,
    customSources: options.sources ?? [source],
    index: { resources: options.resources ?? resources, sourceStates: [] }
  }, storage);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LanguageProvider>
        <ToastProvider>
          <ResourceProvider
            bridge={createBridge(usedIds, options.bridge)}
            storage={storage}
            copyText={options.copyText}
          >
            <ResourcesPage />
          </ResourceProvider>
        </ToastProvider>
      </LanguageProvider>
    );
  });
  return { storage, usedIds };
}

function rows() {
  return [...document.querySelectorAll<HTMLElement>("[role='option']")];
}

function key(
  target: Element,
  value: string,
  code = value,
  ctrlKey = false,
  shiftKey = false
) {
  target.dispatchEvent(new KeyboardEvent("keydown", {
    key: value,
    code,
    ctrlKey,
    shiftKey,
    bubbles: true,
    cancelable: true
  }));
}

async function openPointerMenu(row: HTMLElement, x = 120, y = 140) {
  await act(async () => {
    row.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    }));
  });
  return document.querySelector<HTMLElement>("[role='menu']")!;
}

async function chooseMenuItem(label: string) {
  const item = [...document.querySelectorAll<HTMLButtonElement>("[role='menuitem']")]
    .find((candidate) => candidate.textContent?.includes(label));
  if (!item) throw new Error(`Missing menu item: ${label}`);
  await act(async () => item.click());
}

describe("resource page selection and keyboard execution", () => {
  it("uses listbox semantics and selects a row without executing it", async () => {
    const { usedIds } = await renderPage();
    expect(document.querySelector("[role='listbox']")).toBeTruthy();
    expect(rows()).toHaveLength(3);
    await act(async () => rows()[1].click());
    expect(rows()[1].getAttribute("aria-selected")).toBe("true");
    expect(usedIds).toEqual([]);
  });

  it("executes a double-clicked row exactly once", async () => {
    const { usedIds } = await renderPage();
    await act(async () => {
      rows()[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(usedIds).toEqual(["custom:tools:alpha.jsx"]);
  });

  it("moves with arrows, numpad keys, Home, and End without wrapping", async () => {
    await renderPage();
    await act(async () => rows()[1].click());
    await act(async () => key(rows()[1], "ArrowDown"));
    expect(document.activeElement).toBe(rows()[2]);
    await act(async () => key(rows()[2], "2", "Numpad2"));
    expect(document.activeElement).toBe(rows()[2]);
    await act(async () => key(rows()[2], "8", "Numpad8"));
    expect(document.activeElement).toBe(rows()[1]);
    await act(async () => key(rows()[1], "Home"));
    expect(document.activeElement).toBe(rows()[0]);
    await act(async () => key(rows()[0], "End"));
    expect(document.activeElement).toBe(rows()[2]);
  });

  it("executes the selected row with main and numpad Enter", async () => {
    const { usedIds } = await renderPage();
    await act(async () => rows()[1].click());
    await act(async () => key(rows()[1], "Enter", "Enter"));
    await act(async () => key(rows()[1], "Enter", "NumpadEnter"));
    expect(usedIds).toEqual([
      "custom:tools:beta.jsx",
      "custom:tools:beta.jsx"
    ]);
  });

  it("focuses and selects the search text with Ctrl+F", async () => {
    await renderPage();
    const input = document.querySelector<HTMLInputElement>("input[type='search']")!;
    await act(async () => {
      input.value = "Alpha";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => key(document.querySelector("[role='listbox']")!, "f", "KeyF", true));
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it("does not execute from nested controls", async () => {
    const { usedIds } = await renderPage();
    const favorite = rows()[0].querySelector<HTMLButtonElement>("button")!;
    await act(async () => key(favorite, "Enter", "Enter"));
    await act(async () => favorite.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(usedIds).toEqual([]);
  });

  it("selects the context-menu target and exposes shared resource commands", async () => {
    await renderPage();
    const menu = await openPointerMenu(rows()[1], 320, 240);

    expect(rows()[1].getAttribute("aria-selected")).toBe("true");
    expect(menu).toBeTruthy();
    expect(menu.textContent).toContain("执行脚本");
    expect(menu.textContent).toContain("复制完整路径");
    expect(menu.textContent).toContain("查看资源信息");
  });

  it("runs the favorite command from the context menu without executing the resource", async () => {
    const { usedIds, storage } = await renderPage();
    await openPointerMenu(rows()[0]);
    await chooseMenuItem("收藏");

    expect(usedIds).toEqual([]);
    expect(readStoredResourceSettings(storage).index.resources[0]?.favorite).toBe(true);
  });

  it("shows copy feedback and resource information from menu commands", async () => {
    const copied: string[] = [];
    await renderPage({
      copyText: async (text) => {
        copied.push(text);
      }
    });

    await openPointerMenu(rows()[0]);
    await chooseMenuItem("复制完整路径");
    expect(copied).toEqual(["C:/Tools/Alpha.jsx"]);
    expect(document.querySelector(".toast-item__message")?.textContent).toContain(
      "已复制完整路径"
    );

    await openPointerMenu(rows()[0]);
    await chooseMenuItem("查看资源信息");
    const dialog = document.querySelector("[role='dialog']");
    expect(dialog?.textContent).toContain("Alpha");
    expect(dialog?.textContent).toContain("C:/Tools/Alpha.jsx");
  });

  it("maps panel registration failures to localized feedback", async () => {
    const panelSource: ResourceSource = {
      ...source,
      id: "ae-default:panels",
      kind: "ae-default",
      resourceType: "panel",
      name: "My Panel"
    };
    const panelResource: IndexedResource = {
      ...resources[0],
      id: "ae-default:panels:panel.jsx",
      sourceId: "ae-default:panels",
      resourceType: "panel",
      name: "Panel.jsx",
      relativePath: "Panel.jsx"
    };
    await renderPage({
      sources: [],
      resources: [panelResource],
      bridge: {
        readCurrentAeSources: async () => ({
          status: "connected",
          hostVersion: "25.6",
          sources: [panelSource],
          isDevelopmentFixture: false
        }),
        useResource: async () => ({ ok: false, reason: "panel-not-registered" })
      }
    });

    await act(async () => rows()[0].click());
    await act(async () => key(rows()[0], "Enter"));
    expect(document.querySelector(".toast-item__message")?.textContent).toContain(
      "该面板尚未被 AE 注册"
    );
  });

  it("opens the resource menu from Shift+F10 and restores focus on Escape", async () => {
    await renderPage();
    await act(async () => rows()[2].click());
    await act(async () => key(rows()[2], "F10", "F10", false, true));
    expect(document.querySelector("[role='menu']")).toBeTruthy();
    await act(async () => key(document.querySelector("[role='menu']")!, "Escape"));
    expect(document.activeElement).toBe(rows()[2]);
    expect(rows()[2].getAttribute("aria-selected")).toBe("true");
  });
});
