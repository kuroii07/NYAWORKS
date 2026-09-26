import type { UiCopy } from "../i18n/types";
import { HOME_TOOL_CATALOG } from "../homeLayouts/catalog";
import type { GlobalSearchItem } from "./types";

export function buildToolSearchItems(copy: UiCopy["home"]): GlobalSearchItem[] {
  return Object.values(HOME_TOOL_CATALOG).map((tool, index) => ({
    id: `tool:${tool.id}`,
    kind: "tool",
    name: copy.toolLabels[tool.id],
    aliases: [tool.id],
    searchableText: `${copy.toolLabels[tool.id]} ${tool.id}`,
    iconKey: tool.id,
    action: "execute-tool",
    toolId: tool.id,
    requiresHost: true,
    opensBanner: ["adjust", "effects", "quickPreset"].includes(tool.id),
    order: index
  }));
}
