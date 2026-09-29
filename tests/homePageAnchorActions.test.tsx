// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ActionServiceProvider } from "../src/actions/ActionServiceProvider";
import { ANCHOR_POSITIONS } from "../src/actions/anchorTypes";
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

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("HomePage anchor actions", () => {
  it("routes all nine anchor buttons through their stable action ids", async () => {
    const actionIds: string[] = [];
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
              run: async (actionId) => {
                actionIds.push(actionId);
                return { success: true, message: "ok" };
              }
            }}>
              <HomePage />
            </ActionServiceProvider>
          </SettingsProvider>
        </LanguageProvider>
      );
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      ".spatial-grid__layer--anchor .anchor-button"
    );
    expect(buttons).toHaveLength(9);
    for (const button of buttons) {
      await act(async () => button.click());
    }

    expect(actionIds).toEqual(
      ANCHOR_POSITIONS.map((position) => `layer.anchor.${position}`)
    );
  });
});
