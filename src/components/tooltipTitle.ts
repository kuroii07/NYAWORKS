export function resolveTooltipTitle(
  currentTitle: string | null,
  storedTitle: string | null
): string | null {
  return currentTitle || storedTitle;
}
