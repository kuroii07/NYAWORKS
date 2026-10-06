// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ActionServiceProvider } from "../src/actions/ActionServiceProvider";
import type { ActionRunOptions } from "../src/actions/types";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { HomePage } from "../src/pages/HomePage";
import { SettingsProvider } from "../src/settings/SettingsProvider";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderGrid(runs: Array<{ actionId: string; options?: ActionRunOptions }>) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new MemoryStorage()
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
    ".create-grid__layer--create .tool-button"
  );
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.querySelectorAll(".compact-action-menu").forEach((node) => node.remove());
  root = null;
  container = null;
});

describe("HomePage layer actions", () => {
  it("renders and routes the nine implemented actions in product order", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderGrid(runs);
    expect(buttons).toHaveLength(9);
    for (const button of buttons) {
      await act(async () => button.click());
    }
    expect(runs).toEqual([
      { actionId: "layer.createText", options: { layerModifier: "none" } },
      { actionId: "layer.createSolid", options: { layerModifier: "none" } },
      { actionId: "layer.createShape", options: { layerModifier: "none" } },
      { actionId: "layer.createAdjustment", options: { layerModifier: "none" } },
      { actionId: "layer.createNull", options: { layerModifier: "none" } },
      { actionId: "layer.createCameraRig", options: { layerModifier: "none" } },
      { actionId: "layer.createLight", options: { layerModifier: "none" } },
      { actionId: "layer.precomposeSelected", options: { layerModifier: "none" } },
      { actionId: "layer.unprecomposeSelected", options: { layerModifier: "none" } }
    ]);
  });

  it("routes supported modifiers and falls back to default for unsupported ones", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderGrid(runs);
    await act(async () => {
      buttons[2].dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true }));
      buttons[6].dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
      buttons[4].dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
      buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true }));
    });
    expect(runs).toEqual([
      { actionId: "layer.createShape", options: { layerModifier: "alt" } },
      { actionId: "layer.createLight", options: { layerModifier: "ctrl" } },
      { actionId: "layer.createNull", options: { layerModifier: "shift" } },
      { actionId: "layer.createText", options: { layerModifier: "none" } }
    ]);
  });

  it("uses Alt+Ctrl+Shift only for precompose settings and never opens a variant menu", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderGrid(runs);
    await act(async () => {
      buttons[2].dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        altKey: true,
        ctrlKey: true,
        shiftKey: true
      }));
      buttons[5].dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        altKey: true,
        ctrlKey: true,
        shiftKey: true
      }));
      buttons[7].dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        altKey: true,
        ctrlKey: true,
        shiftKey: true
      }));
    });
    expect(runs).toEqual([
      { actionId: "layer.createShape", options: { layerModifier: "none" } },
      { actionId: "layer.createCameraRig", options: { layerModifier: "none" } },
      { actionId: "layer.precomposeSelected", options: { layerModifier: "settings" } }
    ]);
    expect(document.querySelector(".compact-action-menu")).toBe(null);
  });

  it("exposes localized behavior tooltips without planned or disabled metadata", async () => {
    const buttons = await renderGrid([]);
    expect(buttons[2].title).toContain("Alt");
    expect(buttons[2].title).toContain("Ctrl");
    expect(buttons[2].title).toContain("Shift");
    expect(buttons[0].title).not.toContain("Ctrl");
    expect(buttons[1].title).not.toContain("Alt");
    expect(buttons[1].title).not.toContain("Ctrl");
    expect(buttons[7].title).toContain("Alt+Ctrl+Shift");
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.hasAttribute("aria-disabled")).toBe(false);
      expect(button.title).not.toContain("后续阶段");
    }
    const inactiveSelect = container?.querySelectorAll<HTMLButtonElement>(
      ".create-grid__layer--select .tool-button"
    ) ?? [];
    expect(Array.from(inactiveSelect).every((button) => button.tabIndex === -1)).toBe(true);
  });
});
