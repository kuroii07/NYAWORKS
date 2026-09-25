// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextInputDialog } from "../src/components/TextInputDialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function NameDialogHarness() {
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  return isOpen ? (
    <TextInputDialog
      title="新建布局"
      value={value}
      maxLength={24}
      confirmLabel="创建"
      cancelLabel="取消"
      onValueChange={setValue}
      onConfirm={vi.fn()}
      onCancel={() => setIsOpen(false)}
    />
  ) : null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("AppDialog focus management", () => {
  it("keeps a text input focused after its controlled value changes", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<NameDialogHarness />));

    const input = document.querySelector<HTMLInputElement>(
      ".nyaworks-text-input"
    );
    expect(input).not.toBeNull();

    act(() => {
      input?.focus();
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setValue?.call(input, "创");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(document.activeElement).toBe(input);
  });
});
