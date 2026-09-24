import { CopySimple, Trash } from "@phosphor-icons/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as compactActionMenuModule from "../src/components/CompactActionMenu";

const { CompactActionMenu } = compactActionMenuModule;

type PositionInput = {
  anchorRect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  viewportWidth: number;
  viewportHeight: number;
  itemCount: number;
  align?: "left" | "right";
};

const getCompactActionMenuPosition = (
  compactActionMenuModule as unknown as {
    getCompactActionMenuPosition?: (input: PositionInput) => {
      left: number;
      top: number;
      width: number;
      placement: "top" | "bottom";
    };
  }
).getCompactActionMenuPosition;
const shouldCloseCompactActionMenu = (
  compactActionMenuModule as unknown as {
    shouldCloseCompactActionMenu?: (
      menu: { contains: (target: Node) => boolean } | null,
      anchor: { contains: (target: Node) => boolean } | null,
      target: Node
    ) => boolean;
  }
).shouldCloseCompactActionMenu;

describe("CompactActionMenu", () => {
  it("renders enabled and disabled icon actions accessibly", () => {
    const markup = renderToStaticMarkup(
      <CompactActionMenu
        ariaLabel="布局操作"
        open
        onClose={vi.fn()}
        items={[
          {
            id: "copy",
            label: "复制",
            icon: CopySimple,
            onSelect: vi.fn()
          },
          {
            id: "delete",
            label: "删除",
            icon: Trash,
            disabled: true,
            danger: true,
            onSelect: vi.fn()
          }
        ]}
      />
    );

    expect(markup).toContain('role="menu"');
    expect(markup).toContain("复制");
    expect(markup).toContain("删除");
    expect(markup).toContain("disabled");
  });

  it("keeps a bottom action menu inside the viewport by opening upward", () => {
    expect(
      getCompactActionMenuPosition?.({
        anchorRect: {
          left: 443,
          right: 470,
          top: 548,
          bottom: 575
        },
        viewportWidth: 493,
        viewportHeight: 650,
        itemCount: 4,
        align: "right"
      })
    ).toEqual({
      left: 322,
      top: 406,
      width: 148,
      placement: "top"
    });
  });

  it("clamps a left-aligned action menu to the viewport padding", () => {
    expect(
      getCompactActionMenuPosition?.({
        anchorRect: {
          left: 2,
          right: 29,
          top: 100,
          bottom: 127
        },
        viewportWidth: 493,
        viewportHeight: 650,
        itemCount: 2,
        align: "left"
      })
    ).toEqual({
      left: 8,
      top: 133,
      width: 148,
      placement: "bottom"
    });
  });

  it("does not treat a click on the menu trigger as an outside click", () => {
    const target = {} as Node;

    expect(
      shouldCloseCompactActionMenu?.(
        { contains: () => false },
        { contains: (candidate) => candidate === target },
        target
      )
    ).toBe(false);
    expect(
      shouldCloseCompactActionMenu?.(
        { contains: () => false },
        { contains: () => false },
        target
      )
    ).toBe(true);
  });
});
