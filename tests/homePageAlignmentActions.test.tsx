// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ActionServiceProvider } from "../src/actions/ActionServiceProvider";
import type { ActionRunOptions } from "../src/actions/types";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { HomePage } from "../src/pages/HomePage";
import {
  HOME_SETTINGS_STORAGE_KEY
} from "../src/settings/homeSettingsStorage";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { DEFAULT_HOME_SETTINGS } from "../src/settings/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderAlignmentGrid(
  runs: Array<{ actionId: string; options?: ActionRunOptions }>
) {
  const storage = new MemoryStorage();
  storage.setItem(HOME_SETTINGS_STORAGE_KEY, JSON.stringify({
    ...DEFAULT_HOME_SETTINGS,
    spaceMode: "align"
  }));
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <LanguageProvider>
        <SettingsProvider>
          <ActionServiceProvider service={{
            run: async (actionId, options) => {
              runs.push({ actionId, options });
              return { success: true, message: "ok" };
            }
          }}>
            <HomePage />
          </ActionServiceProvider>
        </SettingsProvider>
      </LanguageProvider>
    );
  });

  return container.querySelectorAll<HTMLButtonElement>(
    ".spatial-grid__layer--align .anchor-button"
  );
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("HomePage alignment actions", () => {
  it("routes the fixed nine-cell grid through stable action ids", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderAlignmentGrid(runs);

    expect(buttons).toHaveLength(9);
    for (const button of buttons) {
      await act(async () => button.click());
    }

    expect(runs).toEqual([
      { actionId: "layer.align.left", options: undefined },
      { actionId: "layer.align.center-x", options: undefined },
      { actionId: "layer.align.right", options: undefined },
      { actionId: "layer.align.top", options: undefined },
      { actionId: "layer.align.center-y", options: undefined },
      { actionId: "layer.align.bottom", options: undefined },
      { actionId: "text.paragraph.left", options: undefined },
      { actionId: "text.paragraph.center", options: undefined },
      { actionId: "text.paragraph.right", options: undefined }
    ]);
  });

  it("uses Alt or Shift only to force composition alignment", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderAlignmentGrid(runs);

    await act(async () => {
      buttons[0].dispatchEvent(new MouseEvent("click", {
        altKey: true,
        bubbles: true
      }));
      buttons[1].dispatchEvent(new MouseEvent("click", {
        shiftKey: true,
        bubbles: true
      }));
    });

    expect(runs).toEqual([
      {
        actionId: "layer.align.left",
        options: { alignmentTarget: "composition" }
      },
      {
        actionId: "layer.align.center-x",
        options: { alignmentTarget: "composition" }
      }
    ]);
  });
});
