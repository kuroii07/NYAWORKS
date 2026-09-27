// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { ToastProvider, useToast } from "../src/notifications/ToastProvider";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function ToastTrigger() {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast.error("请先选择图层")}>
      提示
    </button>
  );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("renders a global error toast and removes it after its duration", async () => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <LanguageProvider>
          <ToastProvider>
            <ToastTrigger />
          </ToastProvider>
        </LanguageProvider>
      );
    });

    await act(async () => {
      container?.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("请先选择图层");

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
