import type { ResourceType } from "../resources/types";
import type { ToolId } from "../i18n/types";

export type GlobalSearchItemKind =
  | "tool"
  | "script"
  | "preset"
  | "effect"
  | "expression";

export type GlobalSearchAction =
  | "execute-tool"
  | "execute-action"
  | "run-script"
  | "apply-preset"
  | "add-effect"
  | "open-expression";

export interface GlobalSearchItem {
  id: string;
  kind: GlobalSearchItemKind;
  name: string;
  aliases: string[];
  searchableText: string;
  iconKey: string;
  action: GlobalSearchAction;
  actionId?: string;
  sourceId?: string;
  resourceId?: string;
  resourceType?: ResourceType;
  toolId?: ToolId;
  requiresHost: boolean;
  opensBanner?: boolean;
  displaySuffix?: string;
  displayName?: string;
  phoneticTerms?: string[];
  order?: number;
  recentRank?: number;
}

export interface GlobalSearchIndex {
  items: GlobalSearchItem[];
}

export interface GlobalSearchIndexInput {
  items: readonly GlobalSearchItem[];
}

export type GlobalSearchGroups = Map<GlobalSearchItemKind, GlobalSearchItem[]>;
