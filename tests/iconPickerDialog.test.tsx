import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IconPickerDialog } from "../src/components/IconPickerDialog";

describe("IconPickerDialog", () => {
  it("renders every group icon as a compact selectable button", () => {
    const markup = renderToStaticMarkup(
      <IconPickerDialog
        title="选择图标"
        selectedIconId="folder"
        confirmLabel="确认"
        cancelLabel="取消"
        iconLabels={{
          folder: "文件夹",
          layers: "图层",
          curve: "曲线",
          text: "文字",
          effects: "效果",
          project: "合成",
          camera: "摄像机",
          shape: "图形",
          media: "媒体",
          sparkle: "创意"
        }}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup.match(/data-icon-option="true"/g)).toHaveLength(10);
    expect(markup).toContain('data-active="true"');
    expect(markup).toContain('aria-label="文件夹"');
  });
});
