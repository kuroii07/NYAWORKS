import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TextInputDialog } from "../src/components/TextInputDialog";

describe("TextInputDialog", () => {
  it("renders a project-styled input with inline validation", () => {
    const markup = renderToStaticMarkup(
      <TextInputDialog
        title="新建布局"
        value=""
        maxLength={24}
        error="请输入布局名称"
        confirmLabel="创建"
        cancelLabel="取消"
        onValueChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup).toContain('maxLength="24"');
    expect(markup).toContain("请输入布局名称");
    expect(markup).toContain('class="nyaworks-text-input"');
  });
});
