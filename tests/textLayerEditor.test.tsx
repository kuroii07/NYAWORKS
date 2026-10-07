// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TextLayerEditorBridge } from "../src/host/textLayerEditorBridge";
import type { TextEditorAppearanceBridge } from "../src/host/textEditorAppearanceBridge";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { TextLayerEditor } from "../src/textLayerEditor/TextLayerEditor";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderEditor(
  bridge: TextLayerEditorBridge,
  appearanceBridge?: TextEditorAppearanceBridge
) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new MemoryStorage()
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <ThemeProvider>
        <LanguageProvider>
          <TextLayerEditor
            bridge={bridge}
            appearanceBridge={appearanceBridge}
            prepareKeyboard={() => {}}
          />
        </LanguageProvider>
      </ThemeProvider>
    );
  });
  return container;
}

function button(label: string) {
  return Array.from(container?.querySelectorAll("button") ?? []).find(
    (candidate) => candidate.textContent === label
  ) as HTMLButtonElement;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("TextLayerEditor", () => {
  it("does not render a redundant in-content close button", async () => {
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: false as const,
        reason: "invalid-selection" as const
      })),
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText: vi.fn(async () => ({ ok: true as const, createdLayers: 1, updatedLayers: 0 }))
    };

    await renderEditor(bridge);

    expect(container?.querySelector(".text-editor-close")).toBeNull();
  });

  it("updates every visible idle label and theme from the main panel appearance", async () => {
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: false as const,
        reason: "invalid-selection" as const
      })),
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText: vi.fn(async () => ({ ok: true as const, createdLayers: 1, updatedLayers: 0 }))
    };
    const appearanceBridge: TextEditorAppearanceBridge = {
      writeAppearance: vi.fn(async () => true),
      readAppearance: vi.fn(async () => ({
        themeId: "deep-emerald" as const,
        languageId: "en" as const
      }))
    };

    await renderEditor(bridge, appearanceBridge);
    await act(async () => Promise.resolve());

    expect(button("Read")).toBeTruthy();
    expect(container?.textContent).toContain("Text Layer Editor");
    expect(container?.textContent).toContain(
      "Create new text or read the selected text layer"
    );
    expect(document.documentElement.dataset.theme).toBe("deep-emerald");
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps Apply disabled until a selected text layer is read", async () => {
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: true as const,
        text: "旧文字",
        layerName: "旧文字",
        targetId: "target-1"
      })),
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText: vi.fn(async () => ({ ok: true as const, createdLayers: 1, updatedLayers: 0 }))
    };
    await renderEditor(bridge);
    expect(button("应用").disabled).toBe(true);

    await act(async () => button("读取").click());
    expect((container?.querySelector("textarea") as HTMLTextAreaElement).value).toBe("旧文字");
    expect(button("应用").disabled).toBe(false);
    expect(container?.textContent).toContain("已读取“旧文字”");
    expect(container?.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it("uses Apply for the read target and Create only for a new layer", async () => {
    const applyText = vi.fn(async () => ({
      ok: true as const,
      createdLayers: 0,
      updatedLayers: 1
    }));
    const createText = vi.fn(async () => ({
      ok: true as const,
      createdLayers: 1,
      updatedLayers: 0
    }));
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: true as const,
        text: "旧文字",
        layerName: "旧文字",
        targetId: "target-1"
      })),
      applyText,
      createText
    };
    await renderEditor(bridge);
    await act(async () => button("读取").click());

    const textarea = container?.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(textarea, "修改后的文字");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("应用").click());
    expect(applyText).toHaveBeenCalledWith("target-1", "修改后的文字");
    expect(createText).not.toHaveBeenCalled();

    await act(async () => button("创建").click());
    expect(createText).toHaveBeenCalledWith("修改后的文字");
    expect(applyText).toHaveBeenCalledTimes(1);
  });
});
