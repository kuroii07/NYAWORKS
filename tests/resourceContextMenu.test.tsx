// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  ResourceContextMenu,
  getResourceContextMenuPosition,
  type ResourceMenuAnchor
} from "../src/components/ResourceContextMenu";
import type {
  ResourceCommandItem,
  ResourceCommandLabelKey,
  ResourceCommandFailureReason
} from "../src/resources/resourceCommands";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const labels: Record<ResourceCommandLabelKey, string> = {
  runScript: "Run script",
  openPanel: "Open panel",
  runStartupOnce: "Run once",
  applyPreset: "Apply preset",
  applyExpression: "Apply expression",
  favorite: "Favorite",
  unfavorite: "Unfavorite",
  copyPath: "Copy path",
  revealFile: "Show in folder",
  openDefault: "Open in default editor",
  refreshSource: "Refresh source",
  viewInfo: "View info"
};

const items: ResourceCommandItem[] = [
  {
    id: "resource.use",
    group: "primary",
    labelKey: "runScript",
    shortcut: "Enter",
    enabled: true
  },
  {
    id: "resource.favorite.toggle",
    group: "organize",
    labelKey: "favorite",
    enabled: true
  },
  {
    id: "resource.path.copy",
    group: "file",
    labelKey: "copyPath",
    enabled: false,
    disabledReason: "host-unavailable"
  },
  {
    id: "resource.file.reveal",
    group: "file",
    labelKey: "revealFile",
    enabled: true
  },
  {
    id: "resource.info.view",
    group: "details",
    labelKey: "viewInfo",
    enabled: true
  }
];

function point(x = 40, y = 50): ResourceMenuAnchor {
  return { kind: "point", x, y };
}

describe("resource context menu positioning", () => {
  it("keeps a point anchor inside the top-left viewport padding", () => {
    expect(getResourceContextMenuPosition({
      anchor: point(1, 2),
      viewportWidth: 800,
      viewportHeight: 600,
      menuWidth: 220,
      menuHeight: 200
    })).toMatchObject({ left: 8, top: 8, maxHeight: 584 });
  });

  it("moves a bottom-right point left and above the pointer", () => {
    const position = getResourceContextMenuPosition({
      anchor: point(795, 595),
      viewportWidth: 800,
      viewportHeight: 600,
      menuWidth: 220,
      menuHeight: 200
    });
    expect(position.left).toBe(572);
    expect(position.top).toBe(392);
    expect(position.placement).toBe("top");
  });

  it("opens an element anchor from its lower-left edge", () => {
    const element = document.createElement("button");
    element.getBoundingClientRect = () => ({
      left: 100,
      right: 500,
      top: 80,
      bottom: 112,
      width: 400,
      height: 32,
      x: 100,
      y: 80,
      toJSON: () => ({})
    });
    expect(getResourceContextMenuPosition({
      anchor: { kind: "element", element },
      viewportWidth: 800,
      viewportHeight: 600,
      menuWidth: 220,
      menuHeight: 200
    })).toMatchObject({ left: 100, top: 118, placement: "bottom" });
  });

  it("limits an oversized menu to the padded viewport height", () => {
    expect(getResourceContextMenuPosition({
      anchor: point(100, 100),
      viewportWidth: 320,
      viewportHeight: 240,
      menuWidth: 220,
      menuHeight: 500
    })).toMatchObject({ top: 8, maxHeight: 224 });
  });
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = "";
});

function key(target: Element, value: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true
  }));
}

async function renderMenu(options: {
  anchor?: ResourceMenuAnchor;
  onSelect?: (id: string) => void;
  onClose?: () => void;
  parentKeyDown?: () => void;
} = {}) {
  container = document.createElement("div");
  document.body.append(container);
  const trigger = document.createElement("button");
  trigger.textContent = "trigger";
  document.body.append(trigger);
  trigger.focus();
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <div onKeyDown={options.parentKeyDown}>
        <ResourceContextMenu
          open
          ariaLabel="Resource actions"
          anchor={options.anchor ?? point()}
          restoreFocusTo={trigger}
          items={items}
          getLabel={(item) => labels[item.labelKey]}
          getDisabledReason={(reason: ResourceCommandFailureReason) =>
            reason === "host-unavailable" ? "Host unavailable" : reason
          }
          onSelect={(id) => options.onSelect?.(id)}
          onClose={() => options.onClose?.()}
        />
      </div>
    );
  });
  return { trigger, menu: document.querySelector<HTMLElement>("[role='menu']")! };
}

describe("resource context menu interaction", () => {
  it("focuses the first enabled item and renders only inter-group separators", async () => {
    const { menu } = await renderMenu();
    const menuItems = [...menu.querySelectorAll<HTMLElement>("[role='menuitem']")];
    expect(document.activeElement).toBe(menuItems[0]);
    expect(menuItems[2].getAttribute("aria-disabled")).toBe("true");
    expect(menuItems[2].textContent).toContain("Host unavailable");
    expect(menu.querySelectorAll("[role='separator']")).toHaveLength(3);
  });

  it("cycles arrows over enabled items and supports Home and End", async () => {
    const { menu } = await renderMenu();
    const enabled = [...menu.querySelectorAll<HTMLElement>(
      "[role='menuitem']:not([aria-disabled='true'])"
    )];
    await act(async () => key(menu, "ArrowUp"));
    expect(document.activeElement).toBe(enabled[enabled.length - 1]);
    await act(async () => key(menu, "ArrowDown"));
    expect(document.activeElement).toBe(enabled[0]);
    await act(async () => key(menu, "End"));
    expect(document.activeElement).toBe(enabled[enabled.length - 1]);
    await act(async () => key(menu, "Home"));
    expect(document.activeElement).toBe(enabled[0]);
  });

  it.each(["Enter", " "])("runs the focused item once with %s", async (pressedKey) => {
    const selected: string[] = [];
    let closed = 0;
    const { menu } = await renderMenu({
      onSelect: (id) => selected.push(id),
      onClose: () => { closed += 1; }
    });
    await act(async () => key(menu, pressedKey));
    expect(selected).toEqual(["resource.use"]);
    expect(closed).toBe(1);
  });

  it("does not run a disabled menu item", async () => {
    const selected: string[] = [];
    const { menu } = await renderMenu({ onSelect: (id) => selected.push(id) });
    const disabled = menu.querySelector<HTMLElement>("[aria-disabled='true']")!;
    await act(async () => disabled.click());
    expect(selected).toEqual([]);
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    let closed = 0;
    const { trigger, menu } = await renderMenu({ onClose: () => { closed += 1; } });
    await act(async () => key(menu, "Escape"));
    expect(closed).toBe(1);
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Tab without cancelling normal focus movement", async () => {
    let closed = 0;
    const { menu } = await renderMenu({ onClose: () => { closed += 1; } });
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true
    });
    await act(async () => menu.dispatchEvent(event));
    expect(closed).toBe(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it("closes on outside pointer, captured scroll, and resize", async () => {
    let closed = 0;
    await renderMenu({ onClose: () => { closed += 1; } });
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new Event("scroll")));
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(closed).toBe(3);
  });

  it("stops handled navigation keys from reaching the resource list", async () => {
    let parentKeys = 0;
    const { menu } = await renderMenu({ parentKeyDown: () => { parentKeys += 1; } });
    await act(async () => key(menu, "ArrowDown"));
    expect(parentKeys).toBe(0);
  });
});
