import { CopySimple, Trash } from "@phosphor-icons/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompactActionMenu } from "../src/components/CompactActionMenu";

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
});
