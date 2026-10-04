import type { NyaActionDefinition } from "./types";
import { ANCHOR_ACTION_DEFINITIONS } from "./definitions/anchorActions";
import { ALIGNMENT_ACTION_DEFINITIONS } from "./definitions/alignmentActions";
import { LAYER_ACTION_DEFINITIONS } from "./definitions/layerActions";

const P0_TITLES = {
  top: { zhCN: "上", zhTW: "上", en: "Top", ja: "上", ko: "위" },
  right: { zhCN: "右", zhTW: "右", en: "Right", ja: "右", ko: "오른쪽" },
  bottom: { zhCN: "下", zhTW: "下", en: "Bottom", ja: "下", ko: "아래" },
  left: { zhCN: "左", zhTW: "左", en: "Left", ja: "左", ko: "왼쪽" }
} as const;

export const P0_ACTION_DEFINITIONS: readonly NyaActionDefinition[] =
  (["top", "right", "bottom", "left"] as const).map((direction) => ({
    id: `p0.direction.${direction}`,
    title: P0_TITLES[direction],
    icon: `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`,
    category: "utility",
    requirements: ["host"],
    supportsPie: true,
    execute: {
      type: "host",
      command: "runP0TestAction"
    },
    undoPolicy: "none"
  }));

export interface ActionRegistry {
  get(id: string): NyaActionDefinition | undefined;
  list(): readonly NyaActionDefinition[];
  listPieActions(): readonly NyaActionDefinition[];
}

export function createActionRegistry(
  definitions: readonly NyaActionDefinition[]
): ActionRegistry {
  const actions = [...definitions];
  const byId = new Map<string, NyaActionDefinition>();

  for (const definition of actions) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate action id: ${definition.id}`);
    }
    byId.set(definition.id, definition);
  }

  return {
    get(id) {
      return byId.get(id);
    },
    list() {
      return actions;
    },
    listPieActions() {
      return actions.filter((definition) => definition.supportsPie);
    }
  };
}

export const p0ActionRegistry = createActionRegistry(P0_ACTION_DEFINITIONS);
export const coreActionRegistry = createActionRegistry([
  ...P0_ACTION_DEFINITIONS,
  ...ANCHOR_ACTION_DEFINITIONS,
  ...ALIGNMENT_ACTION_DEFINITIONS,
  ...LAYER_ACTION_DEFINITIONS
]);
