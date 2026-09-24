import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ModelComboBox } from "../src/components/ModelComboBox";

describe("ModelComboBox", () => {
  it("renders a free-text model field with a refresh action", () => {
    const markup = renderToStaticMarkup(
      <ModelComboBox
        ariaLabel="模型"
        value="manual-model"
        options={["discovered-a", "discovered-b"]}
        refreshLabel="刷新模型"
        placeholder="输入模型名称"
        loading={false}
        onChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('value="manual-model"');
    expect(markup).toContain('aria-label="刷新模型"');
    expect(markup).not.toContain("<select");
  });

  it("keeps a manual value while rendering discovered options", () => {
    const markup = renderToStaticMarkup(
      <ModelComboBox
        ariaLabel="模型"
        value="manual-model"
        options={["discovered-a", "discovered-b"]}
        refreshLabel="刷新模型"
        placeholder="输入模型名称"
        loading={false}
        defaultOpen
        onChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(markup).toContain('value="manual-model"');
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain("discovered-a");
    expect(markup).toContain("discovered-b");
  });

  it("exposes loading and error feedback without replacing the value", () => {
    const markup = renderToStaticMarkup(
      <ModelComboBox
        ariaLabel="模型"
        value="manual-model"
        options={[]}
        refreshLabel="刷新模型"
        placeholder="输入模型名称"
        loading
        error="无法获取模型"
        onChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(markup).toContain('value="manual-model"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("无法获取模型");
  });
});
