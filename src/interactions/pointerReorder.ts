export const POINTER_DRAG_THRESHOLD = 4;
export const POINTER_AUTO_SCROLL_EDGE = 40;
export const POINTER_AUTO_SCROLL_MAX_DELTA = 14;

interface PointerPosition {
  x: number;
  y: number;
}

interface VerticalBounds {
  top: number;
  bottom: number;
}

export function hasPointerDragExceededThreshold(
  origin: PointerPosition,
  current: PointerPosition,
  threshold = POINTER_DRAG_THRESHOLD
): boolean {
  return Math.hypot(current.x - origin.x, current.y - origin.y) >= threshold;
}

export function getPointerAutoScrollDelta(
  pointerY: number,
  bounds: VerticalBounds,
  edge = POINTER_AUTO_SCROLL_EDGE,
  maxDelta = POINTER_AUTO_SCROLL_MAX_DELTA
): number {
  if (pointerY <= bounds.top + edge) {
    const strength = Math.min(1, (bounds.top + edge - pointerY) / edge);
    return -Math.max(1, Math.round(maxDelta * strength));
  }

  if (pointerY >= bounds.bottom - edge) {
    const strength = Math.min(1, (pointerY - (bounds.bottom - edge)) / edge);
    return Math.max(1, Math.round(maxDelta * strength));
  }

  return 0;
}
