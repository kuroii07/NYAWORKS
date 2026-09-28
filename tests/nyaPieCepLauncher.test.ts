import { describe, expect, it, vi } from "vitest";
import {
  NYA_PIE_P0_EXTENSION_ID,
  createCepNyaPieLauncher
} from "../src/nyaPie/p0/cepLauncher";

describe("createCepNyaPieLauncher", () => {
  it("opens the second extension and closes the current runtime", () => {
    const requestOpenExtension = vi.fn();
    const closeExtension = vi.fn();
    const launcher = createCepNyaPieLauncher({
      __adobe_cep__: {
        requestOpenExtension,
        closeExtension,
        registerKeyEventsInterest: vi.fn()
      }
    });

    expect(launcher.openRuntime()).toBe(true);
    expect(requestOpenExtension).toHaveBeenCalledWith(
      NYA_PIE_P0_EXTENSION_ID,
      ""
    );
    expect(launcher.closeRuntime()).toBe(true);
    expect(closeExtension).toHaveBeenCalledTimes(1);
  });

  it("registers only focused-extension key interest", () => {
    const registerKeyEventsInterest = vi.fn(() => true);
    const launcher = createCepNyaPieLauncher({
      __adobe_cep__: {
        requestOpenExtension: vi.fn(),
        closeExtension: vi.fn(),
        registerKeyEventsInterest
      }
    });

    expect(
      launcher.registerFocusedKeyInterest([
        { keyCode: 27 },
        { keyCode: 123, ctrlKey: true, altKey: true, shiftKey: true }
      ])
    ).toBe(true);
    expect(registerKeyEventsInterest).toHaveBeenCalledWith(
      JSON.stringify([
        { keyCode: 27 },
        { keyCode: 123, ctrlKey: true, altKey: true, shiftKey: true }
      ])
    );
  });

  it("reports unsupported CEP-only capabilities honestly", () => {
    const launcher = createCepNyaPieLauncher({});

    expect(launcher.capabilities).toEqual({
      modelessExtension: false,
      focusedKeyEvents: false,
      globalHotkey: false,
      globalCursorPosition: false,
      absoluteWindowPosition: false,
      restoreAeFocus: false
    });
    expect(launcher.openRuntime()).toBe(false);
    expect(launcher.closeRuntime()).toBe(false);
  });
});
