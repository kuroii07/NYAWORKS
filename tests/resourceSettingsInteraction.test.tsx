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

    const resourceButton = container.querySelector<HTMLButtonElement>(
      `[data-resource-id="${resource.id}"]`
    );
    expect(resourceButton?.textContent).toContain("Loop");
    expect(resourceButton?.textContent).toContain("Animation/Loop.jsx");

    await act(async () => {
      resourceButton?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true })
      );
    });

    expect(usedResourceIds).toEqual([resource.id]);
  });
});
