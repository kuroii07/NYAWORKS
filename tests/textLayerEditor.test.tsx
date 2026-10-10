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

async function setEditorText(value: string) {
  const textarea = container?.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return textarea;
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

  it("focuses the editor and automatically reads one selected text layer on open", async () => {
    const readSelectedTextLayer = vi.fn(async () => ({
      ok: true as const,
      text: "自动读取的文字",
      layerName: "自动读取的文字",
      targetId: "target-auto"
    }));
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer,
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText: vi.fn(async () => ({ ok: true as const, createdLayers: 1, updatedLayers: 0 }))
    };

    await renderEditor(bridge);
    await act(async () => Promise.resolve());

    const textarea = container?.querySelector("textarea") as HTMLTextAreaElement;
    expect(readSelectedTextLayer).toHaveBeenCalledTimes(1);
    expect(textarea.value).toBe("自动读取的文字");
    expect(document.activeElement).toBe(textarea);
    expect(button("应用").disabled).toBe(false);
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

  it("keeps Apply disabled after an automatic read miss until a manual read succeeds", async () => {
    const readSelectedTextLayer = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        reason: "invalid-selection" as const
      })
      .mockResolvedValueOnce({
        ok: true as const,
        text: "旧文字",
        layerName: "旧文字",
        targetId: "target-1"
      });
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer,
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText: vi.fn(async () => ({ ok: true as const, createdLayers: 1, updatedLayers: 0 }))
    };
    await renderEditor(bridge);
    await act(async () => Promise.resolve());
    expect(button("应用").disabled).toBe(true);

    await act(async () => button("读取").click());
    expect((container?.querySelector("textarea") as HTMLTextAreaElement).value).toBe("旧文字");
    expect(button("应用").disabled).toBe(false);
    expect(container?.textContent).toContain("已读取“旧文字”");
    expect(container?.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it("allows Apply to clear the read target while Create remains disabled", async () => {
    const applyText = vi.fn(async () => ({
      ok: true as const,
      createdLayers: 0,
      updatedLayers: 1
    }));
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: true as const,
        text: "待清空",
        layerName: "待清空",
        targetId: "target-clear"
      })),
      applyText,
      createText: vi.fn(async () => ({ ok: true as const, createdLayers: 1, updatedLayers: 0 }))
    };
    await renderEditor(bridge);
    await act(async () => Promise.resolve());

    await setEditorText("");

    expect(button("应用").disabled).toBe(false);
    expect(button("创建").disabled).toBe(true);
    await act(async () => button("应用").click());
    expect(applyText).toHaveBeenCalledWith("target-clear", "");
  });

  it("uses Ctrl+Enter to create when no target has been read", async () => {
    const createText = vi.fn(async () => ({
      ok: true as const,
      createdLayers: 1,
      updatedLayers: 0
    }));
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: false as const,
        reason: "invalid-selection" as const
      })),
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText
    };
    await renderEditor(bridge);
    await act(async () => Promise.resolve());
    const textarea = await setEditorText("快捷创建");

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "Enter"
      }));
    });

    expect(createText).toHaveBeenCalledWith("快捷创建");
  });

  it("shows that read text has unapplied changes", async () => {
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: true as const,
        text: "原文字",
        layerName: "原文字",
        targetId: "target-dirty"
      })),
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText: vi.fn(async () => ({ ok: true as const, createdLayers: 1, updatedLayers: 0 }))
    };
    await renderEditor(bridge);
    await act(async () => Promise.resolve());

    await setEditorText("已修改");

    expect(container?.textContent).toContain("已修改，尚未应用");
  });

  it("recovers from a rejected Bridge request without staying busy", async () => {
    const bridge: TextLayerEditorBridge = {
      readSelectedTextLayer: vi.fn(async () => ({
        ok: false as const,
        reason: "invalid-selection" as const
      })),
      applyText: vi.fn(async () => ({ ok: true as const, createdLayers: 0, updatedLayers: 1 })),
      createText: vi.fn(async () => {
        throw new Error("bridge disconnected");
      })
    };
    await renderEditor(bridge);
    await act(async () => Promise.resolve());
    await setEditorText("不会丢失的草稿");

    await act(async () => button("创建").click());

    expect(button("创建").disabled).toBe(false);
    expect(container?.textContent).toContain("文字操作失败");
    expect((container?.querySelector("textarea") as HTMLTextAreaElement).value).toBe("不会丢失的草稿");
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

    await setEditorText("修改后的文字");
    await act(async () => button("应用").click());
    expect(applyText).toHaveBeenCalledWith("target-1", "修改后的文字");
    expect(createText).not.toHaveBeenCalled();

    await act(async () => button("创建").click());
    expect(createText).toHaveBeenCalledWith("修改后的文字");
    expect(applyText).toHaveBeenCalledTimes(1);
  });
});
