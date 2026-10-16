export const LAYER_ACTIONS = [
  "create-text",
  "create-solid",
  "create-shape",
  "create-adjustment",
  "create-null",
  "create-camera-rig",
  "create-light",
  "precompose-selected",
  "unprecompose-selected"
] as const;

export type LayerAction = (typeof LAYER_ACTIONS)[number];

export type LayerActionModifier = "none" | "alt" | "ctrl" | "shift";

const LAYER_ACTION_IDS: Record<LayerAction, string> = {
  "create-text": "layer.createText",
  "create-solid": "layer.createSolid",
  "create-shape": "layer.createShape",
  "create-adjustment": "layer.createAdjustment",
  "create-null": "layer.createNull",
  "create-camera-rig": "layer.createCameraRig",
  "create-light": "layer.createLight",
  "precompose-selected": "layer.precomposeSelected",
  "unprecompose-selected": "layer.unprecomposeSelected"
};

export function getLayerActionId(action: LayerAction): string {
  return LAYER_ACTION_IDS[action];
}

export function isLayerAction(value: unknown): value is LayerAction {
  return typeof value === "string" && LAYER_ACTIONS.includes(value as LayerAction);
}

export function isLayerActionModifier(value: unknown): value is LayerActionModifier {
  return value === "none" || value === "alt" || value === "ctrl" || value === "shift";
}
