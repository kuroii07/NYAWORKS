export const LAYER_ALIGNMENT_ACTIONS = [
  "left",
  "center-x",
  "right",
  "top",
  "center-y",
  "bottom"
] as const;

export const PARAGRAPH_ALIGNMENT_ACTIONS = [
  "paragraph-left",
  "paragraph-center",
  "paragraph-right"
] as const;

export const ALIGNMENT_ACTIONS = [
  ...LAYER_ALIGNMENT_ACTIONS,
  ...PARAGRAPH_ALIGNMENT_ACTIONS
] as const;

export type LayerAlignmentAction = (typeof LAYER_ALIGNMENT_ACTIONS)[number];
export type ParagraphAlignmentAction =
  (typeof PARAGRAPH_ALIGNMENT_ACTIONS)[number];
export type AlignmentAction = (typeof ALIGNMENT_ACTIONS)[number];

export const ALIGNMENT_TARGETS = ["composition", "selection"] as const;
export type AlignmentTarget = (typeof ALIGNMENT_TARGETS)[number];
export type AlignmentTargetStrategy = AlignmentTarget | "smart";

export function isAlignmentAction(value: unknown): value is AlignmentAction {
  return (
    typeof value === "string" &&
    ALIGNMENT_ACTIONS.includes(value as AlignmentAction)
  );
}

export function isAlignmentTarget(value: unknown): value is AlignmentTarget {
  return (
    typeof value === "string" &&
    ALIGNMENT_TARGETS.includes(value as AlignmentTarget)
  );
}

export function isLayerAlignmentAction(
  action: AlignmentAction
): action is LayerAlignmentAction {
  return LAYER_ALIGNMENT_ACTIONS.includes(action as LayerAlignmentAction);
}
