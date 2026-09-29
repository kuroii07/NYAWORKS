import type { ActionRegistry } from "../actions/registry";
import type { LocalizedActionText } from "../actions/types";
import type { GlobalSearchItem } from "./types";

type SearchLanguage = keyof LocalizedActionText;

const ANCHOR_TERMS: LocalizedActionText = {
  zhCN: "锚点",
  zhTW: "錨點",
  en: "anchor",
  ja: "アンカー",
  ko: "앵커"
};

export function buildActionSearchItems(
  registry: ActionRegistry,
  language: SearchLanguage
): GlobalSearchItem[] {
  return registry.list()
    .filter((definition) => !definition.id.startsWith("p0."))
    .map((definition, index) => {
    const title = definition.title[language];
    const description = definition.description?.[language] ?? "";
    const directionalAliases = definition.execute.command === "setAnchorPoint"
      ? (Object.keys(ANCHOR_TERMS) as SearchLanguage[]).map(
          (key) => `${ANCHOR_TERMS[key]} ${definition.title[key]}`
        )
      : [];
    const aliases = [
      definition.id,
      definition.execute.command,
      ...Object.values(definition.title),
      ...Object.values(definition.description ?? {}),
      ...directionalAliases
    ];
    return {
      id: `action:${definition.id}`,
      kind: "tool",
      name: title,
      aliases,
      searchableText: [definition.id, title, description, ...aliases].join(" "),
      iconKey: definition.icon,
      action: "execute-action",
      actionId: definition.id,
      requiresHost: definition.requirements.includes("host"),
      order: 500 + index,
      displaySuffix: description
    };
  });
}
