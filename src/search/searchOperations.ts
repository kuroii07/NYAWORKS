import { pinyin } from "pinyin-pro";
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
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function compact(value: string): string {
  return normalize(value).replace(/[\s\-_./\\()[\]{}:，。！？、]+/g, "");
}

function buildPhoneticTerms(values: readonly string[]): string[] {
  const terms = new Set<string>();
  for (const value of values) {
    if (!/[\u3400-\u9fff\uf900-\ufaff]/.test(value)) continue;
    try {
      const parts = pinyin(value, { type: "all", toneType: "none" });
      const full = parts
        .map((part) => part.isZh ? part.pinyin : part.origin)
        .join(" ");
      const initials = parts
        .map((part) => part.isZh ? part.first : part.origin)
        .join("");
      const normalizedFull = normalize(full);
      const compactFull = compact(full);
      const compactInitials = compact(initials);
      if (normalizedFull) terms.add(normalizedFull);
      if (compactFull) terms.add(compactFull);
      if (compactInitials) terms.add(compactInitials);
    } catch {
      // A malformed or unusually long label must not make the whole search
      // index unavailable. The original Chinese/Latin text remains searchable.
    }
  }
  return [...terms];
}

function isSubsequence(query: string, candidate: string): boolean {
  if (!query) return true;
  let queryIndex = 0;
  for (const character of candidate) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function editDistance(first: string, second: string): number {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const current = [firstIndex + 1];
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      current.push(
        Math.min(
          current[secondIndex] + 1,
          previous[secondIndex + 1] + 1,
          previous[secondIndex] + (first[firstIndex] === second[secondIndex] ? 0 : 1)
        )
      );
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }
  return previous[second.length];
}

function isFuzzyMatch(query: string, candidate: string): boolean {
  const normalizedQuery = compact(query);
  const normalizedCandidate = compact(candidate);
  if (!normalizedQuery || !normalizedCandidate) return false;
  if (normalizedCandidate.includes(normalizedQuery)) return true;
  if (normalizedQuery.length >= 3 && isSubsequence(normalizedQuery, normalizedCandidate)) {
    return true;
  }

  const threshold = normalizedQuery.length >= 6 ? 2 : normalizedQuery.length >= 4 ? 1 : 0;
  if (threshold === 0) return false;
  if (editDistance(normalizedQuery, normalizedCandidate) <= threshold) return true;
  return normalize(candidate)
    .split(/[\s\-_./\\()[\]{}:，。！？、]+/)
    .filter(Boolean)
    .some((token) => editDistance(normalizedQuery, compact(token)) <= threshold);
}

function rank(item: GlobalSearchItem, query: string): number {
  if (!query) {
    return item.recentRank ?? 1000 + (item.order ?? 0);
  }

  const normalizedQuery = normalize(query);
  const name = normalize(item.name);
  const aliases = item.aliases.map(normalize);
  const searchable = normalize(item.searchableText);
  const compactQuery = compact(normalizedQuery);
  const compactName = compact(name);
  const compactAliases = item.aliases.map(compact);
  const phoneticTerms = item.phoneticTerms ?? [];
  const compactPhoneticTerms = phoneticTerms.map(compact);

  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  if (aliases.some((alias) => alias === normalizedQuery || alias.startsWith(normalizedQuery))) {
    return 2;
  }
  if (phoneticTerms.some((term) => term === normalizedQuery)) return 2.25;
  if (phoneticTerms.some((term) => term.startsWith(normalizedQuery))) return 2.5;
  if (name.includes(normalizedQuery) || aliases.some((alias) => alias.includes(normalizedQuery))) {
    return 3;
  }
  if (compactPhoneticTerms.some((term) => term.includes(compactQuery))) return 3.5;
  if (
    searchable.includes(normalizedQuery) ||
    compactName.includes(compactQuery) ||
    compactAliases.some((alias) => alias.includes(compactQuery))
  ) return 4;
  if (
    isFuzzyMatch(normalizedQuery, name) ||
    item.aliases.some((alias) => isFuzzyMatch(normalizedQuery, alias))
  ) return 5;
  if (isFuzzyMatch(normalizedQuery, searchable)) return 6;
  if (phoneticTerms.some((term) => isFuzzyMatch(normalizedQuery, term))) return 7;
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
      displayName,
      phoneticTerms: buildPhoneticTerms([
        item.name,
        ...item.aliases,
        item.searchableText
      ])
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
