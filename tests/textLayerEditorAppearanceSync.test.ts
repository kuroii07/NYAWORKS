import { afterEach, describe, expect, it, vi } from "vitest";
import {
  startTextEditorAppearancePublisher,
  startTextEditorAppearanceSubscriber
} from "../src/textLayerEditor/appearanceSync";

describe("text layer editor appearance sync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the main panel theme and language through the shared host bridge", async () => {
    let storedAppearance: unknown = null;
    const bridge = {
      async writeAppearance(appearance: unknown) {
        storedAppearance = appearance;
        return true;
      },
      async readAppearance() {
        return null;
      }
    };

    startTextEditorAppearancePublisher(
      { themeId: "deep-emerald", languageId: "en" },
      bridge
    );
    await Promise.resolve();

    expect(storedAppearance).toEqual({
      themeId: "deep-emerald",
      languageId: "en"
    });
  });

  it("retries briefly while the refreshed CEP host script is becoming available", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    let storedAppearance: unknown = null;
    const bridge = {
      async writeAppearance(appearance: unknown) {
        attempts += 1;
        if (attempts < 2) return false;
        storedAppearance = appearance;
        return true;
      },
      async readAppearance() {
        return null;
      }
    };

    const stop = startTextEditorAppearancePublisher(
      { themeId: "deep-emerald", languageId: "en" },
      bridge
    );
    await vi.advanceTimersByTimeAsync(300);

    expect(storedAppearance).toEqual({
      themeId: "deep-emerald",
      languageId: "en"
    });
    stop();
  });

  it("polls the shared host state and only applies changed appearance values", async () => {
    vi.useFakeTimers();
    const appearances = [
      { themeId: "deep-emerald", languageId: "en" },
      { themeId: "deep-emerald", languageId: "en" },
      { themeId: "nebula-violet", languageId: "ja" }
    ] as const;
    let readIndex = 0;
    const bridge = {
      async writeAppearance() {
        return true;
      },
      async readAppearance() {
        const value = appearances[Math.min(readIndex, appearances.length - 1)];
        readIndex += 1;
        return value;
      }
    };
    const applied: unknown[] = [];

    const stop = startTextEditorAppearanceSubscriber(
      (appearance) => applied.push(appearance),
      bridge,
      400
    );
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(800);

    expect(applied).toEqual([
      { themeId: "deep-emerald", languageId: "en" },
      { themeId: "nebula-violet", languageId: "ja" }
    ]);

    stop();
    await vi.advanceTimersByTimeAsync(800);
    expect(readIndex).toBe(3);
  });
});
