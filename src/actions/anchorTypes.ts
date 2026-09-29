export const ANCHOR_POSITIONS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right"
] as const;

export type AnchorPosition = (typeof ANCHOR_POSITIONS)[number];
