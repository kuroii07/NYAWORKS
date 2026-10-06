// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  TEXT_LAYER_EDITOR_EXTENSION_ID,
  closeTextLayerEditor,
  openTextLayerEditor,
  prepareTextLayerEditorKeyboard
} from "../src/textLayerEditor/cepLauncher";

describe("text layer editor CEP launcher", () => {
  it("opens the dedicated modeless extension", () => {
    const requestOpenExtension = vi.fn();
    expect(openTextLayerEditor({ __adobe_cep__: { requestOpenExtension } })).toBe(true);
    expect(requestOpenExtension).toHaveBeenCalledWith(
      TEXT_LAYER_EDITOR_EXTENSION_ID,
      ""
    );
  });

  it("closes the current editor extension", () => {
    const closeExtension = vi.fn();
    expect(closeTextLayerEditor({ __adobe_cep__: { closeExtension } })).toBe(true);
    expect(closeExtension).toHaveBeenCalledTimes(1);
  });

  it("focuses the modeless window without intercepting IME letter keys", () => {
    const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
    expect(prepareTextLayerEditorKeyboard({})).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
    focus.mockRestore();
  });
});
