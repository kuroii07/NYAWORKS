// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalTooltip } from "../src/components/GlobalTooltip";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
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

async function renderTooltipTarget(className: string, singleLine = false) {
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
          <button
            className={className}
            title="来源操作"
            data-tooltip-single-line={singleLine ? "true" : undefined}
          >
            target
          </button>
          <GlobalTooltip />
        </SettingsProvider>
      </LanguageProvider>
    );
  });

  const button = container.querySelector("button");
  if (!button) throw new Error("Missing tooltip target");
  Object.defineProperty(button, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 80,
      height: 48,
      left: 132,
      right: 180,
      top: 32,
      width: 48,
      x: 132,
      y: 32,
      toJSON: () => ({})
    })
  });

  await act(async () => {
    button.dispatchEvent(new Event("pointerover", { bubbles: true }));
    await vi.runAllTimersAsync();
  });

  return document.querySelector<HTMLElement>('[role="tooltip"]');
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe("global tooltip layout", () => {
  it("marks spatial grid tooltips for single-line edge-aware display", async () => {
    vi.useFakeTimers();

    const tooltip = await renderTooltipTarget("anchor-button");

    expect(tooltip?.dataset.singleLine).toBe("true");
  });

  it("allows compact action buttons to opt into horizontal tooltips", async () => {
    vi.useFakeTimers();

    const tooltip = await renderTooltipTarget("resource-source-row__menu-button", true);

    expect(tooltip?.dataset.singleLine).toBe("true");
  });
});
