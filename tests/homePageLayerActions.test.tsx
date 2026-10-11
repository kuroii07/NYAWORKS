// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionServiceProvider } from "../src/actions/ActionServiceProvider";
import type { ActionRunOptions } from "../src/actions/types";
import { LanguageProvider, useLanguage } from "../src/i18n/LanguageProvider";
import { HomePage } from "../src/pages/HomePage";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { TEXT_LAYER_EDITOR_EXTENSION_ID } from "../src/textLayerEditor/cepLauncher";
import { LANGUAGE_IDS, type LanguageId } from "../src/i18n/languages";
import { LANGUAGE_STORAGE_KEY } from "../src/i18n/languageStorage";
import { UI_COPY } from "../src/i18n/translations";
import { ToastProvider } from "../src/notifications/ToastProvider";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function LanguageSwitch() {
  const { setLanguage } = useLanguage();
  return <button data-test-language onClick={() => setLanguage("en")}>English</button>;
}

async function renderGrid(runs: Array<{ actionId: string; options?: ActionRunOptions }>, language: LanguageId = "zh-CN", notice?: string) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new MemoryStorage()
  });
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LanguageProvider>
        <LanguageSwitch />
        <SettingsProvider>
          <ToastProvider>
          <ActionServiceProvider service={{
            run: async (actionId, options) => {
              runs.push({ actionId, options });
              return { success: true, message: "ok", ...(notice ? { data: { notice } } : {}) };
            }
          }}>
            <HomePage />
          </ActionServiceProvider>
          </ToastProvider>
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
  delete (window as Window & { __adobe_cep__?: unknown }).__adobe_cep__;
  root = null;
  container = null;
});

describe("HomePage layer actions", () => {
  it.each(LANGUAGE_IDS)("dispatches all four Null modes and retains the %s tooltip", async language => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderGrid(runs, language);
    expect(buttons[4].title).toBe(UI_COPY[language].home.layerActionTooltips.nullObject);
    expect(buttons[4].title).toContain("Ctrl");
    for (const modifier of ["none", "alt", "ctrl", "shift"] as const) {
      await act(async () => buttons[4].dispatchEvent(new MouseEvent("click", {
        bubbles: true, altKey: modifier === "alt", ctrlKey: modifier === "ctrl", shiftKey: modifier === "shift"
      })));
    }
    expect(runs).toEqual(["none", "alt", "ctrl", "shift"].map(layerModifier => ({
      actionId: "layer.createNull", options: { layerModifier, languageId: language }
    })));
  });
  it.each(["ja", "ko"] as const)("shows the explicit %s English-controls notice after a successful creation", async language => {
    const buttons = await renderGrid([], language, "shape-controls-english");
    await act(async () => buttons[2].click());
    expect(container?.querySelector(".toast-item__message")).not.toBeNull();
    expect(container?.querySelector(".toast-item__message")?.textContent).toBe(UI_COPY[language].home.layerFeedback.shapeControlsEnglish);
  });
  it.each(LANGUAGE_IDS)("preserves the full %s shape label and modifier tooltip", async language => {
    const buttons = await renderGrid([], language);
    expect(buttons[2].getAttribute("aria-label")).toBe(UI_COPY[language].home.toolLabels.shapeLayer);
    expect(buttons[2].getAttribute("title")).toBe(UI_COPY[language].home.layerActionTooltips.shapeLayer);
  });
  it("uses the current panel language on subsequent ordinary calls without running actions on language change", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderGrid(runs);
    await act(async () => container?.querySelector<HTMLButtonElement>("[data-test-language]")?.click());
    expect(runs).toEqual([]);
    await act(async () => buttons[3].click());
    await act(async () => buttons[2].click());
    expect(runs).toEqual([
      { actionId: "layer.createAdjustment", options: { layerModifier: "none", languageId: "en" } },
      { actionId: "layer.createShape", options: { layerModifier: "none", languageId: "en" } }
    ]);
  });
  it("renders and routes the nine implemented actions in product order", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const buttons = await renderGrid(runs);
    expect(buttons).toHaveLength(9);
    for (const button of buttons) {
      await act(async () => button.click());
    }
    expect(runs).toEqual([
      { actionId: "layer.createText", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.createSolid", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.createShape", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.createAdjustment", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.createNull", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.createCameraRig", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.createLight", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.precomposeSelected", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.unprecomposeSelected", options: { layerModifier: "none", languageId: "zh-CN" } }
    ]);
  });

  it("routes supported modifiers and falls back to default for unsupported ones", async () => {
    const runs: Array<{ actionId: string; options?: ActionRunOptions }> = [];
    const requestOpenExtension = vi.fn();
    (window as Window & { __adobe_cep__?: unknown }).__adobe_cep__ = {
      requestOpenExtension
    };
    const buttons = await renderGrid(runs);
    await act(async () => {
      buttons[2].dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true }));
      buttons[6].dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
      buttons[4].dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
      buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true }));
    });
    expect(runs).toEqual([
      { actionId: "layer.createShape", options: { layerModifier: "alt", languageId: "zh-CN" } },
      { actionId: "layer.createLight", options: { layerModifier: "ctrl", languageId: "zh-CN" } },
      { actionId: "layer.createNull", options: { layerModifier: "shift", languageId: "zh-CN" } }
    ]);
    expect(requestOpenExtension).toHaveBeenCalledWith(
      TEXT_LAYER_EDITOR_EXTENSION_ID,
      ""
    );
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
      { actionId: "layer.createShape", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.createCameraRig", options: { layerModifier: "none", languageId: "zh-CN" } },
      { actionId: "layer.precomposeSelected", options: { layerModifier: "settings", languageId: "zh-CN" } }
    ]);
    expect(document.querySelector(".compact-action-menu")).toBe(null);
  });

  it("exposes localized behavior tooltips without planned or disabled metadata", async () => {
    const buttons = await renderGrid([]);
    expect(buttons[2].title).toContain("Alt");
    expect(buttons[2].title).toContain("Ctrl");
    expect(buttons[2].title).toContain("Shift");
    expect(buttons[0].title).toContain("Alt");
    expect(buttons[0].title.split("\n")).toHaveLength(2);
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
