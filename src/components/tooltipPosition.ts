export type TooltipPlacement = "bottom" | "right";

export interface TooltipTargetRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface TooltipPosition {
  left: number;
  placement: TooltipPlacement;
  top: number;
}

export function getTooltipPosition(
  rect: TooltipTargetRect,
  viewportWidth: number,
  viewportHeight: number,
  isSidebarItem: boolean
): TooltipPosition {
  if (isSidebarItem) {
    return {
      placement: "right",
      left: Math.min(viewportWidth - 8, rect.right + 8),
      top: Math.min(
        viewportHeight - 8,
        Math.max(8, rect.top + rect.height / 2)
      )
    };
  }

  const halfWidth = 96;

  return {
    placement: "bottom",
    left: Math.min(
      viewportWidth - halfWidth - 8,
      Math.max(halfWidth + 8, rect.left + rect.width / 2)
    ),
    top: Math.min(viewportHeight - 44, rect.bottom + 8)
  };
}
