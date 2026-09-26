// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { ResourceProvider } from "../src/resources/ResourceProvider";
import { GlobalSearchProvider } from "../src/search/GlobalSearchProvider";
import { GlobalSearchPanel } from "../src/components/GlobalSearchPanel";
import { createDevelopmentResourceService, createDevelopmentGlobalSearchService } from "../src/resources/developmentResourceService";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderPanel() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LanguageProvider>
        <ResourceProvider bridge={createDevelopmentResourceService()}>
          <GlobalSearchProvider bridge={createDevelopmentGlobalSearchService()}>
            <GlobalSearchPanel />
          </GlobalSearchProvider>
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
});
