import type {
  GlobalSearchGroups,
  GlobalSearchIndex,
  GlobalSearchIndexInput,
  GlobalSearchItem,
  GlobalSearchItemKind
} from "./types";

const GROUP_ORDER: readonly GlobalSearchItemKind[] = [
  "tool",
  "script",
  "preset",
  "effect",
  "expression"
];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function rank(item: GlobalSearchItem, query: string): number {
  if (!query) {
    return item.recentRank ?? item.order ?? 0;
  }

  const normalizedQuery = normalize(query);
  const name = normalize(item.name);
  const aliases = item.aliases.map(normalize);
  const searchable = normalize(item.searchableText);

  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  if (aliases.some((alias) => alias === normalizedQuery || alias.startsWith(normalizedQuery))) {
    return 2;
  }
  if (name.includes(normalizedQuery) || aliases.some((alias) => alias.includes(normalizedQuery))) {
    return 3;
  }
  if (searchable.includes(normalizedQuery)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function buildGlobalSearchIndex(
  input: GlobalSearchIndexInput
): GlobalSearchIndex {
  const counts = new Map<string, number>();
  for (const item of input.items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }

  const items = input.items.map((item, index) => {
    const duplicate = (counts.get(item.name) ?? 0) > 1;
    const displayName = duplicate && item.displaySuffix
      ? `${item.name} · ${item.displaySuffix}`
      : item.name;
    return {
      ...item,
      order: item.order ?? index,
      displayName
    };
  });

  return { items };
}

export function searchGlobalItems(
  input: GlobalSearchIndex | readonly GlobalSearchItem[],
  query: string,
  options: { limit?: number } = {}
): GlobalSearchItem[] {
  const source: readonly GlobalSearchItem[] = "items" in input ? input.items : input;
  const normalizedQuery = normalize(query);
  const matched = source
    .map((item, index) => ({ item, score: rank(item, normalizedQuery), index }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => {
      const scoreDelta = left.score - right.score;
      if (scoreDelta !== 0) return scoreDelta;
      return (left.item.order ?? left.index) - (right.item.order ?? right.index);
    })
    .map(({ item }) => item);

  return matched.slice(0, options.limit ?? (normalizedQuery ? 50 : 8));
}

export function groupGlobalSearchItems(
  items: readonly GlobalSearchItem[]
): GlobalSearchGroups {
  const groups: GlobalSearchGroups = new Map(
    GROUP_ORDER.map((kind) => [kind, [] as GlobalSearchItem[]])
  );

  for (const item of items) {
    groups.get(item.kind)?.push(item);
  }

  return groups;
}
