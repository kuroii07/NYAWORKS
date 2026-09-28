export interface Point {
  x: number;
  y: number;
}

export type FourWayDirection = "top" | "right" | "bottom" | "left";

export function resolveFourWayDirection(
  point: Point,
  center: Point,
  deadZone: number
): FourWayDirection | null {
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;

  if (Math.hypot(deltaX, deltaY) < deadZone) {
    return null;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? "right" : "left";
  }

  return deltaY > 0 ? "bottom" : "top";
}
