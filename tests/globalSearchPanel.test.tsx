// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { ResourceProvider } from "../src/resources/ResourceProvider";
import { GlobalSearchProvider } from "../src/search/GlobalSearchProvider";
import { GlobalSearchPanel } from "../src/components/GlobalSearchPanel";
import { createDevelopmentResourceService, createDevelopmentGlobalSearchService } from "../src/resources/developmentResourceService";
import { ActionServiceProvider } from "../src/actions/ActionServiceProvider";
import type { ActionService } from "../src/actions/service";
import { ToastProvider } from "../src/notifications/ToastProvider";
import type { GlobalSearchHostBridge } from "../src/host/globalSearchBridge";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderPanel(
  actionService?: ActionService,
  searchBridge: GlobalSearchHostBridge = createDevelopmentGlobalSearchService()
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LanguageProvider>
        <ResourceProvider bridge={createDevelopmentResourceService()}>
          <ActionServiceProvider service={actionService}>
            <GlobalSearchProvider bridge={searchBridge}>
              <ToastProvider>
                <GlobalSearchPanel />
              </ToastProvider>
            </GlobalSearchProvider>
          </ActionServiceProvider>
        </ResourceProvider>
      </LanguageProvider>
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("GlobalSearchPanel", () => {
  it("supports writable input, grouped results, and icon/name-only rows", async () => {
    const node = await renderPanel();
    const input = node.querySelector<HTMLInputElement>(".global-search input");
    expect(input).not.toBeNull();
    await act(async () => {
      input?.focus();
      input?.dispatchEvent(new Event("focus", { bubbles: true }));
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, "文字");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(node.querySelector(".global-search-results")).not.toBeNull();
    expect(node.querySelectorAll(".global-search-result-row").length).toBeGreaterThan(0);
    expect(node.querySelector(".global-search-result-row__meta")).toBeNull();
    expect(node.querySelector(".search-key")?.textContent).toBe("Ctrl");
    expect(input?.getAttribute("aria-autocomplete")).toBe("list");
    expect(input?.getAttribute("aria-controls")).toBe("global-search-results-list");
    expect(input?.getAttribute("aria-activedescendant")).toContain("global-search-result-");
  });

  it("does not intercept IME candidate navigation or confirmation", async () => {
    const run = vi.fn(async () => ({ success: true as const, message: "ok" }));
    const node = await renderPanel({ run });
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;

    await act(async () => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, "新建文字层");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const selectedBefore = node.querySelector('[data-selected="true"]')?.textContent;
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        isComposing: true
      }));
      input.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true
      }));
    });

    expect(node.querySelector('[data-selected="true"]')?.textContent).toBe(selectedBefore);
    expect(run).not.toHaveBeenCalled();
    expect(node.querySelector(".global-search-results")).not.toBeNull();
  });

  it("syncs the final Chinese value when CEP only delivers compositionend", async () => {
    const node = await renderPanel();
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;

    await act(async () => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, "新建文字层");
      input.dispatchEvent(new CompositionEvent("compositionend", {
        bubbles: true,
        data: "新建文字层"
      }));
    });

    expect(node.querySelector("[data-selected='true']")?.textContent).toContain("新建文字层");
  });

  it("moves selection with arrows, executes on Enter, and closes on Escape", async () => {
    const node = await renderPanel();
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;
    await act(async () => {
      input.focus();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(node.querySelector('[data-selected="true"]')).not.toBeNull();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(node.querySelector(".global-search-results")).toBeNull();
  });

  it("opens from Ctrl/Command+K without expanding the document", async () => {
    const node = await renderPanel();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(node.querySelector(".global-search input"));
    expect(node.querySelector(".global-search-results")).not.toBeNull();
  });

  it("closes when clicking outside the search shell", async () => {
    const node = await renderPanel();
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;
    await act(async () => {
      input.focus();
      input.dispatchEvent(new Event("focus", { bubbles: true }));
    });
    expect(node.querySelector(".global-search-results")).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(node.querySelector(".global-search-results")).toBeNull();
  });

  it("closes with Escape even after focus leaves the input", async () => {
    const node = await renderPanel();
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;
    await act(async () => {
      input.focus();
      input.dispatchEvent(new Event("focus", { bubbles: true }));
      document.body.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(node.querySelector(".global-search-results")).toBeNull();
  });

  it("closes after four seconds when opened without search activity", async () => {
    vi.useFakeTimers();
    try {
      const node = await renderPanel();
      const input = node.querySelector<HTMLInputElement>(".global-search input")!;
      await act(async () => {
        input.focus();
        input.dispatchEvent(new Event("focus", { bubbles: true }));
      });
      expect(node.querySelector(".global-search-results")).not.toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(3999);
      });
      expect(node.querySelector(".global-search-results")).not.toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(node.querySelector(".global-search-results")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the panel open after the user starts searching", async () => {
    vi.useFakeTimers();
    try {
      const node = await renderPanel();
      const input = node.querySelector<HTMLInputElement>(".global-search input")!;
      await act(async () => {
        input.focus();
        input.dispatchEvent(new Event("focus", { bubbles: true }));
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, "脚本");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(node.querySelector(".global-search-results")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows localized feedback when an alignment action fails", async () => {
    const node = await renderPanel({
      run: async () => ({
        success: false,
        message: "Alignment action failed",
        error: {
          code: "expression-conflict",
          detail: "Layer 1"
        }
      })
    });
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;

    await act(async () => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, "layer.align.left");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true
      }));
    });

    expect(node.querySelector('[role="alert"]')?.textContent).toContain(
      "选中的图层含有表达式或关键帧，无法安全对齐（Layer 1）"
    );
  });

  it("shows a type-specific result marker and refreshes unavailable AE effects", async () => {
    let effectReads = 0;
    const searchBridge: GlobalSearchHostBridge = {
      readCurrentAeEffects: async () => {
        effectReads += 1;
        return {
          status: "unavailable",
          effects: [{
            id: "effect:blur",
            name: "Gaussian Blur",
            matchName: "ADBE Gaussian Blur 2",
            aliases: ["高斯模糊"]
          }],
          isDevelopmentFixture: false
        };
      },
      executeGlobalSearchAction: async () => ({ ok: true })
    };
    const node = await renderPanel(undefined, searchBridge);
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;

    await act(async () => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, "高斯模糊");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(node.querySelector('[data-search-kind="effect"]')).not.toBeNull();
    expect(node.querySelector(".global-search-kind-icon")).not.toBeNull();

    await act(async () => {
      node.querySelector<HTMLButtonElement>("[data-search-refresh-effects]")?.click();
    });
    expect(effectReads).toBe(2);
    expect(node.querySelector("[data-search-effects-status]")).not.toBeNull();
  });

  it("shows a localized toast when a non-action search result fails", async () => {
    const node = await renderPanel({
      run: async () => ({
        success: false,
        message: "Resource failed",
        error: { code: "no-selected-layer" }
      })
    });
    const input = node.querySelector<HTMLInputElement>(".global-search input")!;

    await act(async () => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, "预合成");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true
      }));
    });

    expect(node.querySelector('[role="alert"]')?.textContent).toContain("请先");
    expect(node.querySelector(".global-search-results")).not.toBeNull();
  });
});
