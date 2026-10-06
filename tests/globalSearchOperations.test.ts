import { describe, expect, it } from "vitest";
import {
  buildGlobalSearchIndex,
  groupGlobalSearchItems,
  searchGlobalItems
} from "../src/search/searchOperations";
import { buildToolSearchItems } from "../src/search/toolSearchCatalog";
import { UI_COPY } from "../src/i18n/translations";
import type { GlobalSearchItem } from "../src/search/types";

const items: GlobalSearchItem[] = [
  {
    id: "tool:anchor",
    kind: "tool",
    name: "锚点设置",
    aliases: ["锚点", "anchor"],
    searchableText: "锚点设置 锚点 anchor",
    iconKey: "anchor",
    action: "execute-tool",
    requiresHost: false,
    opensBanner: true,
    order: 0
  },
  {
    id: "tool:align",
    kind: "tool",
    name: "图层对齐",
    aliases: ["对齐", "align"],
    searchableText: "图层对齐 对齐 align",
    iconKey: "align",
    action: "execute-tool",
    requiresHost: true,
    order: 1
  },
  {
    id: "script:anchor",
    kind: "script",
    name: "锚点设置",
    aliases: [],
    searchableText: "锚点设置",
    iconKey: "script",
    action: "run-script",
    sourceId: "source:one",
    resourceId: "resource:anchor",
    requiresHost: true,
    displaySuffix: "脚本",
    order: 2
  },
  {
    id: "preset:glow",
    kind: "preset",
    name: "快速发光",
    aliases: ["glow"],
    searchableText: "快速发光 glow",
    iconKey: "preset",
    action: "apply-preset",
    requiresHost: true,
    order: 3
  },
  {
    id: "effect:blur",
    kind: "effect",
    name: "Gaussian Blur",
    aliases: ["高斯模糊"],
    searchableText: "gaussian blur 高斯模糊",
    iconKey: "effect",
    action: "add-effect",
    requiresHost: true,
    order: 4
  },
  {
    id: "expression:wiggle",
    kind: "expression",
    name: "wiggle",
    aliases: [],
    searchableText: "wiggle",
    iconKey: "expression",
    action: "open-expression",
    requiresHost: false,
    order: 5
  }
];

describe("global search operations", () => {
  it("ranks exact matches before prefix and contains matches", () => {
    const result = searchGlobalItems(items, "锚点设置");
    expect(result.map((item) => item.id)).toEqual([
      "tool:anchor",
      "script:anchor"
    ]);
  });

  it("matches Chinese aliases and English aliases", () => {
    expect(searchGlobalItems(items, "对齐")[0]?.id).toBe("tool:align");
    expect(searchGlobalItems(items, "glow")[0]?.id).toBe("preset:glow");
    expect(searchGlobalItems(items, "高斯模糊")[0]?.id).toBe("effect:blur");
  });

  it("keeps banner tools searchable in Chinese even when the active UI language is English", () => {
    const indexed = buildGlobalSearchIndex({
      items: buildToolSearchItems(UI_COPY.en.home)
    });
    expect(searchGlobalItems(indexed, "调节")[0]?.id).toBe("tool:adjust");
    expect(searchGlobalItems(indexed, "效果")[0]?.id).toBe("tool:effects");
    expect(searchGlobalItems(indexed, "快速预设")[0]?.id).toBe("tool:quickPreset");
  });

  it("matches arbitrary Chinese names by full pinyin, initials, and light pinyin typos", () => {
    const indexed = buildGlobalSearchIndex({ items });
    expect(searchGlobalItems(indexed, "maodianshezhi")[0]?.id).toBe("tool:anchor");
    expect(searchGlobalItems(indexed, "mdsz")[0]?.id).toBe("tool:anchor");
    expect(searchGlobalItems(indexed, "kuaisufaguang")[0]?.id).toBe("preset:glow");
    expect(searchGlobalItems(indexed, "ksfg")[0]?.id).toBe("preset:glow");
    expect(searchGlobalItems(indexed, "gaosimohu")[0]?.id).toBe("effect:blur");
    expect(searchGlobalItems(indexed, "gaosimouh")[0]?.id).toBe("effect:blur");

    const precompose = buildGlobalSearchIndex({
      items: [{
        ...items[0],
        id: "tool:precompose",
        name: "预合成",
        aliases: [],
        searchableText: "预合成"
      }]
    });
    expect(searchGlobalItems(precompose, "yuhecheng")[0]?.id).toBe("tool:precompose");
    expect(searchGlobalItems(precompose, "yhc")[0]?.id).toBe("tool:precompose");
  });

  it("matches case-insensitive, full-width, whitespace, and lightly mistyped queries", () => {
    expect(searchGlobalItems(items, "GAUSSIAN BLUR")[0]?.id).toBe("effect:blur");
    expect(searchGlobalItems(items, "Ｇａｕｓｓｉａｎ")[0]?.id).toBe("effect:blur");
    expect(searchGlobalItems(items, "高斯 模糊")[0]?.id).toBe("effect:blur");
    expect(searchGlobalItems(items, "gausian")[0]?.id).toBe("effect:blur");
  });

  it("groups results by the five supported kinds", () => {
    const groups = groupGlobalSearchItems(items);
    expect([...groups.keys()]).toEqual([
      "tool",
      "script",
      "preset",
      "effect",
      "expression"
    ]);
  });

  it("returns a bounded default list for an empty query", () => {
    const result = searchGlobalItems(items, "", { limit: 3 });
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.id)).toEqual([
      "tool:anchor",
      "tool:align",
      "script:anchor"
    ]);
  });

  it("adds only a short suffix when duplicate names exist", () => {
    const result = buildGlobalSearchIndex({ items });
    const duplicates = result.items.filter((item) => item.name === "锚点设置");
    expect(duplicates.map((item) => item.displayName)).toEqual([
      "锚点设置",
      "锚点设置 · 脚本"
    ]);
  });

  it("keeps stable source order for equal scores", () => {
    const result = searchGlobalItems(items, "设置");
    expect(result.map((item) => item.id)).toEqual([
      "tool:anchor",
      "script:anchor"
    ]);
  });
});
