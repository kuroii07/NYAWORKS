export const GLOBAL_SEARCH_HISTORY_STORAGE_KEY = "nyaworks.global-search.history.v1";
const MAX_HISTORY_ITEMS = 12;

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSearchHistory(storage?: Storage): string[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  try {
    const parsed = JSON.parse(
      target.getItem(GLOBAL_SEARCH_HISTORY_STORAGE_KEY) ?? "[]"
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is string => typeof value === "string" && value.length > 0
    ).slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function recordSearchHistory(
  itemId: string,
  storage?: Storage
): string[] {
  if (!itemId) return readSearchHistory(storage);
  const next = [
    itemId,
    ...readSearchHistory(storage).filter((candidate) => candidate !== itemId)
  ].slice(0, MAX_HISTORY_ITEMS);
  const target = resolveStorage(storage);
  if (target) {
    try {
      target.setItem(
        GLOBAL_SEARCH_HISTORY_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Storage can be disabled or full; the in-memory result remains usable.
    }
  }
  return next;
}

export function buildRecentRanks(history: readonly string[]): Map<string, number> {
  return new Map(history.map((itemId, index) => [itemId, index]));
}
