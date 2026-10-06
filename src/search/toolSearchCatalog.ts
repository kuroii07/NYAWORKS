import type { UiCopy } from "../i18n/types";
import { HOME_TOOL_CATALOG } from "../homeLayouts/catalog";
import type { GlobalSearchItem } from "./types";

const SEARCHABLE_BANNER_TOOLS = ["adjust", "effects", "quickPreset"] as const;

const TOOL_ALIASES: Record<(typeof SEARCHABLE_BANNER_TOOLS)[number], readonly string[]> = {
  adjust: [
    "调节", "調節", "调整", "調整", "adjust", "adjustment"
  ],
  effects: [
    "效果", "エフェクト", "효과", "effects", "effect"
  ],
  quickPreset: [
    "快速预设", "快速預設", "快速预设", "クイックプリセット", "빠른 프리셋",
    "quick preset", "preset"
  ]
};

export function buildToolSearchItems(copy: UiCopy["home"]): GlobalSearchItem[] {
  return SEARCHABLE_BANNER_TOOLS.map((toolId, index) => {
    const tool = HOME_TOOL_CATALOG[toolId];
    const aliases = [
      tool.id,
      copy.toolLabels[tool.id],
      ...TOOL_ALIASES[toolId]
    ];
    return {
      id: `tool:${tool.id}`,
      kind: "tool",
      name: copy.toolLabels[tool.id],
      aliases,
      searchableText: aliases.join(" "),
      iconKey: tool.id,
      action: "execute-tool",
      toolId: tool.id,
      requiresHost: true,
      opensBanner: true,
      order: index
    };
  });
}
