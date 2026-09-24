import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppDialog } from "../src/components/AppDialog";

describe("AppDialog", () => {
  it("renders an accessible NYAWORKS confirmation dialog", () => {
    const markup = renderToStaticMarkup(
      <AppDialog
        title="重置所有设置"
        description="恢复默认主题、语言、界面大小与常规设置。"
        primaryAction={{
          label: "确认重置",
          onClick: vi.fn()
        }}
        secondaryAction={{
          label: "取消",
          onClick: vi.fn()
        }}
        onClose={vi.fn()}
      />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("重置所有设置");
    expect(markup).toContain("确认重置");
    expect(markup).toContain("取消");
  });
});
