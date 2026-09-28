// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NYA_PIE_P1_RUNTIME_TITLE } from "../src/nyaPie/p0/cepLauncher";
import { NyaPieP0Runtime } from "../src/nyaPie/p0/NyaPieP0Runtime";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderRuntime() {
  const runAction = vi.fn(async (actionId: string) => ({
    success: true,
    message: `executed:${actionId}`
  }));
  const closeRuntime = vi.fn();
  const registerFocusedKeyInterest = vi.fn();
  const setWindowTitle = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <NyaPieP0Runtime
        runAction={runAction}
        closeRuntime={closeRuntime}
        setWindowTitle={setWindowTitle}
        registerFocusedKeyInterest={registerFocusedKeyInterest}
      />
    );
  });
  return {
    node: container,
    runAction,
    closeRuntime,
    setWindowTitle,
    registerFocusedKeyInterest
  };
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("NyaPieP0Runtime", () => {
  it("applies the exact P1 runtime marker once on startup", async () => {
    const { setWindowTitle } = await renderRuntime();

    expect(setWindowTitle).toHaveBeenCalledTimes(1);
    expect(setWindowTitle).toHaveBeenCalledWith(NYA_PIE_P1_RUNTIME_TITLE);
  });

  it("registers plain F12 because the P0 shortcut releases plain F12", async () => {
    const { registerFocusedKeyInterest } = await renderRuntime();

    expect(registerFocusedKeyInterest).toHaveBeenCalledWith(
      expect.arrayContaining([{ keyCode: 123 }])
    );
  });

  it("registers the Alt+Space release keys used by the assigned AE shortcut", async () => {
    const { registerFocusedKeyInterest } = await renderRuntime();

    expect(registerFocusedKeyInterest).toHaveBeenCalledWith(
      expect.arrayContaining([
        { keyCode: 32, altKey: true },
        { keyCode: 18 }
      ])
    );
  });

  it("highlights the direction nearest to pointer movement", async () => {
    const { node } = await renderRuntime();
    const runtime = node.querySelector<HTMLElement>(".nya-pie-p0")!;

    await act(async () => {
      runtime.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: window.innerWidth / 2 + 80,
          clientY: window.innerHeight / 2
        })
      );
    });

    expect(
      node.querySelector('[data-direction="right"]')?.getAttribute("data-active")
    ).toBe("true");
  });

  it("uses the live runtime bounds after CEP changes the final window size", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 160
    });
    const { node } = await renderRuntime();
    const runtime = node.querySelector<HTMLElement>(".nya-pie-p0")!;
    runtime.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      right: 220,
      bottom: 220,
      left: 0,
      width: 220,
      height: 220,
      toJSON: () => ({})
    });

    await act(async () => {
      runtime.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 110,
          clientY: 50
        })
      );
    });

    expect(
      node.querySelector('[data-direction="top"]')?.getAttribute("data-active")
    ).toBe("true");
  });

  it("executes the highlighted action when F12 is released", async () => {
    const { node, runAction, closeRuntime } = await renderRuntime();
    const runtime = node.querySelector<HTMLElement>(".nya-pie-p0")!;
    await act(async () => {
      runtime.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2 - 80
        })
      );
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "F12" }));
    });

    expect(runAction).toHaveBeenCalledWith("p0.direction.top");
    expect(closeRuntime).toHaveBeenCalledTimes(1);
  });

  it("accepts the F12 virtual key code used by older CEP Chromium", async () => {
    const { node, runAction, closeRuntime } = await renderRuntime();
    const runtime = node.querySelector<HTMLElement>(".nya-pie-p0")!;
    await act(async () => {
      runtime.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2 - 80
        })
      );
      window.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "",
          keyCode: 123
        })
      );
    });

    expect(runAction).toHaveBeenCalledWith("p0.direction.top");
    expect(closeRuntime).toHaveBeenCalledTimes(1);
  });

  it("executes the highlighted action when Alt+Space is released", async () => {
    const { node, runAction, closeRuntime } = await renderRuntime();
    const runtime = node.querySelector<HTMLElement>(".nya-pie-p0")!;
    await act(async () => {
      runtime.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: window.innerWidth / 2 + 80,
          clientY: window.innerHeight / 2
        })
      );
      window.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: " ",
          code: "Space",
          keyCode: 32,
          altKey: true
        })
      );
    });

    expect(runAction).toHaveBeenCalledWith("p0.direction.right");
    expect(closeRuntime).toHaveBeenCalledTimes(1);
  });

  it("closes without executing when Escape is pressed", async () => {
    const { runAction, closeRuntime } = await renderRuntime();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(runAction).not.toHaveBeenCalled();
    expect(closeRuntime).toHaveBeenCalledTimes(1);
  });
});
