import {
  createDefaultResourceSettings,
  isCustomResourceType,
  isResourceSourceStatus,
  isResourceType,
  normalizeResourcePath,
  RESOURCE_SETTINGS_SCHEMA_VERSION,
  type IndexedResource,
  type ResourceSettings,
  type ResourceSource,
  type ResourceSourceState
} from "./types";

export const RESOURCE_SETTINGS_STORAGE_KEY = "nyaworks.resources.v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readDate(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function normalizeCustomSource(value: unknown): ResourceSource | null {
  if (!isRecord(value) || value.kind !== "custom") {
    return null;
  }

  const id = readString(value.id);
  const name = readString(value.name);
  const path = typeof value.path === "string" ? normalizeResourcePath(value.path.trim()) : "";

  if (!id || !name || !path || !isCustomResourceType(value.resourceType)) {
    return null;
  }

  return {
    id,
    kind: "custom",
    resourceType: value.resourceType,
    name,
    path,
    enabled: value.enabled !== false,
    hostVersion: null,
    status: isResourceSourceStatus(value.status) ? value.status : "ready",
    lastScannedAt: readDate(value.lastScannedAt),
    lastError:
      value.lastError === "missing" ||
      value.lastError === "scan-failed" ||
      value.lastError === "unavailable"
        ? value.lastError
        : null
  };
}

function normalizePreview(value: unknown): IndexedResource["preview"] {
  if (!isRecord(value)) {
    return { coverUri: null, loopUri: null, cacheKey: null, status: "none" };
  }

  return {
    coverUri: readString(value.coverUri),
    loopUri: readString(value.loopUri),
    cacheKey: readString(value.cacheKey),
    status:
      value.status === "ready" ||
      value.status === "rendering" ||
      value.status === "failed"
        ? value.status
        : "none"
  };
}

function normalizeIndexedResource(value: unknown): IndexedResource | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const sourceId = readString(value.sourceId);
  const name = readString(value.name);
  const relativePath =
    typeof value.relativePath === "string"
      ? normalizeResourcePath(value.relativePath.trim())
      : "";

  if (!id || !sourceId || !name || !relativePath || !isResourceType(value.resourceType)) {
    return null;
  }

  return {
    id,
    sourceId,
    resourceType: value.resourceType,
    name,
    relativePath,
    modifiedAt: readDate(value.modifiedAt),
    favorite: value.favorite === true,
    lastUsedAt: readDate(value.lastUsedAt),
    preview: normalizePreview(value.preview)
  };
}

function normalizeSourceState(value: unknown): ResourceSourceState | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceId = readString(value.sourceId);

  if (!sourceId || !isResourceSourceStatus(value.status)) {
    return null;
  }

  return {
    sourceId,
    status: value.status,
    lastScannedAt: readDate(value.lastScannedAt),
    lastError:
      value.lastError === "missing" ||
      value.lastError === "scan-failed" ||
      value.lastError === "unavailable"
        ? value.lastError
        : null,
    itemCount:
      typeof value.itemCount === "number" &&
      Number.isInteger(value.itemCount) &&
      value.itemCount >= 0
        ? value.itemCount
        : 0
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

export function normalizeResourceSettings(value: unknown): ResourceSettings {
  if (!isRecord(value) || value.schemaVersion !== RESOURCE_SETTINGS_SCHEMA_VERSION) {
    return createDefaultResourceSettings();
  }

  const customSources = Array.isArray(value.customSources)
    ? uniqueById(
        value.customSources
          .map(normalizeCustomSource)
          .filter((source): source is ResourceSource => source !== null)
      )
    : [];
  const rawIndex = isRecord(value.index) ? value.index : {};
  const resources = Array.isArray(rawIndex.resources)
    ? uniqueById(
        rawIndex.resources
          .map(normalizeIndexedResource)
          .filter((resource): resource is IndexedResource => resource !== null)
      )
    : [];
  const sourceStates = Array.isArray(rawIndex.sourceStates)
    ? rawIndex.sourceStates
        .map(normalizeSourceState)
        .filter((state): state is ResourceSourceState => state !== null)
        .filter(
          (state, index, states) =>
            states.findIndex((candidate) => candidate.sourceId === state.sourceId) ===
            index
        )
    : [];

  return {
    schemaVersion: RESOURCE_SETTINGS_SCHEMA_VERSION,
    customSources,
    index: { resources, sourceStates }
  };
}

export function readStoredResourceSettings(
  storage: StorageLike | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): ResourceSettings {
  if (!storage) {
    return createDefaultResourceSettings();
  }

  const stored = storage.getItem(RESOURCE_SETTINGS_STORAGE_KEY);

  if (!stored) {
    return createDefaultResourceSettings();
  }

  try {
    return normalizeResourceSettings(JSON.parse(stored));
  } catch {
    return createDefaultResourceSettings();
  }
}

export function writeStoredResourceSettings(
  settings: ResourceSettings,
  storage: StorageLike | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): void {
  if (!storage) {
    return;
  }

  storage.setItem(
    RESOURCE_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeResourceSettings(settings))
  );
}
