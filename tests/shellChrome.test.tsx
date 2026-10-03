// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../src/components/Sidebar";
import { LanguageProvider } from "../src/i18n/LanguageProvider";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderSidebar() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <LanguageProvider>
        <Sidebar activePage="home" onPageChange={vi.fn()} />
      </LanguageProvider>
    );
  });

  return Array.from(container.querySelectorAll<HTMLButtonElement>(".nav-item"));
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  window.localStorage.clear();
  root = null;
  container = null;
});

describe("compact application chrome", () => {
  it("renders sidebar navigation as icon-only buttons with accessible tooltips", async () => {
    const buttons = await renderSidebar();

    expect(buttons).toHaveLength(11);
    for (const button of buttons) {
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.querySelector("span")).toBeNull();
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.title).toBe(button.getAttribute("aria-label"));
    }
  });
});
