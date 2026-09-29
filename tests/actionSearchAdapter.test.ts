import { describe, expect, it } from "vitest";
import { coreActionRegistry, createActionRegistry } from "../src/actions/registry";
import { buildActionSearchItems } from "../src/search/actionSearchAdapter";

describe("buildActionSearchItems", () => {
  it("builds searchable action items from one registry", () => {
    const registry = createActionRegistry([{
      id: "layer.anchor.top-left",
      title: { zhCN: "左上", zhTW: "左上", en: "Top Left", ja: "左上", ko: "왼쪽 위" },
      description: { zhCN: "设置锚点", zhTW: "設定錨點", en: "Set anchor", ja: "アンカー", ko: "앵커" },
      icon: "Circle",
      category: "layer",
      requirements: ["host"],
      supportsPie: true,
      execute: { type: "host", command: "setAnchorPoint", payload: { position: "top-left" } },
      undoPolicy: "host-undo-group"
    }]);
    expect(buildActionSearchItems(registry, "en")).toEqual([expect.objectContaining({
      id: "action:layer.anchor.top-left",
      action: "execute-action",
      actionId: "layer.anchor.top-left",
      name: "Top Left",
      kind: "tool",
      requiresHost: true
    })]);
  });

  it("does not expose P0 compatibility actions as product search results", () => {
    const items = buildActionSearchItems(coreActionRegistry, "zhCN");

    expect(items).toHaveLength(18);
    expect(items.map((item) => item.actionId)).toEqual(expect.arrayContaining([
      "layer.anchor.top-left",
      "layer.align.left",
      "layer.align.center-x",
      "layer.align.right",
      "layer.align.top",
      "layer.align.center-y",
      "layer.align.bottom",
      "text.paragraph.left",
      "text.paragraph.center",
      "text.paragraph.right"
    ]));
    expect(items.every((item) => (item.order ?? 0) >= 500)).toBe(true);
  });
});
