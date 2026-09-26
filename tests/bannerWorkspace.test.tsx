// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { BannerWorkspace } from "../src/components/BannerWorkspace";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderBanner() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <LanguageProvider>
        <BannerWorkspace />
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

describe("BannerWorkspace", () => {
  it("renders the default brand banner without a second tool grid", async () => {
    const node = await renderBanner();
    expect(node.querySelector(".home-banner")).not.toBeNull();
    expect(node.querySelector(".banner-tool-menu")).toBeNull();
    expect(node.querySelector(".banner-workspace-grid")).toBeNull();
    expect(node.querySelector(".home-banner__pager")).toBeNull();
    expect(node.querySelector(".home-banner__caret")).toBeNull();
  });

  it("opens a context menu and replaces the banner with a selected tool", async () => {
    const node = await renderBanner();
    const banner = node.querySelector<HTMLElement>(".home-banner")!;
    await act(async () => {
      banner.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 10, clientY: 10 }));
    });
    expect(node.querySelector(".banner-tool-menu")).not.toBeNull();
    const tool = node.querySelector<HTMLButtonElement>('[data-banner-tool-id="adjust"]');
    expect(tool).not.toBeNull();
    await act(async () => tool?.click());
    expect(node.querySelector(".banner-tool-workspace")).not.toBeNull();
    expect(node.querySelector(".banner-tool-workspace__title")).not.toBeNull();
    expect(node.querySelector(".banner-tool-menu")).toBeNull();
  });

  it("shows the current checkmark and can restore the default banner", async () => {
    const node = await renderBanner();
    const banner = node.querySelector<HTMLElement>(".home-banner")!;
    await act(async () => {
      banner.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
    await act(async () => node.querySelector<HTMLButtonElement>('[data-banner-tool-id="effects"]')?.click());
    expect(node.querySelector('[data-banner-reset="true"]')).not.toBeNull();
    await act(async () => node.querySelector<HTMLButtonElement>('[data-banner-reset="true"]')?.click());
    expect(node.querySelector(".home-banner")).not.toBeNull();
    expect(node.querySelector(".banner-tool-workspace")).toBeNull();
  });
});
