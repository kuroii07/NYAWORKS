export const RESOURCE_SETTINGS_SCHEMA_VERSION = 1;

export const RESOURCE_TYPES = [
  "script",
  "panel",
  "startup",
  "preset",
  "expression"
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type CustomResourceType = Extract<
  ResourceType,
  "script" | "preset" | "expression"
>;

export const RESOURCE_SOURCE_STATUSES = [
  "ready",
  "scanning",
  "missing",
  "error",
  "unavailable"
] as const;

export type ResourceSourceStatus =
  (typeof RESOURCE_SOURCE_STATUSES)[number];

export type ResourceSourceKind = "ae-default" | "custom";
export type ResourcePreviewStatus = "none" | "ready" | "rendering" | "failed";

export interface ResourceSource {
  id: string;
  kind: ResourceSourceKind;
  resourceType: ResourceType;
  name: string;
  path: string;
  enabled: boolean;
  hostVersion: string | null;
  status: ResourceSourceStatus;
  lastScannedAt: string | null;
  lastError: "missing" | "scan-failed" | "unavailable" | null;
}

export interface IndexedResourcePreview {
  coverUri: string | null;
  loopUri: string | null;
  cacheKey: string | null;
  status: ResourcePreviewStatus;
}

export interface IndexedResource {
  id: string;
  sourceId: string;
  resourceType: ResourceType;
  name: string;
  relativePath: string;
  modifiedAt: string | null;
  favorite: boolean;
  lastUsedAt: string | null;
  preview: IndexedResourcePreview;
}

export interface ResourceSourceState {
  sourceId: string;
  status: ResourceSourceStatus;
  lastScannedAt: string | null;
  lastError: ResourceSource["lastError"];
  itemCount: number;
}

export interface ResourceIndexSnapshot {
  resources: IndexedResource[];
  sourceStates: ResourceSourceState[];
}

export interface ResourceSettings {
  schemaVersion: typeof RESOURCE_SETTINGS_SCHEMA_VERSION;
  customSources: ResourceSource[];
  index: ResourceIndexSnapshot;
}

export interface ResourceScanEntry {
  relativePath: string;
  modifiedAt: string | null;
}

export interface ResourceScanResult {
  sourceId: string;
  status: Exclude<ResourceSourceStatus, "scanning" | "unavailable">;
  resources: ResourceScanEntry[];
  errorCode?: ResourceSource["lastError"];
}

export interface ResourceFolderNode {
  name: string;
  path: string;
  children: ResourceFolderNode[];
  resourceIds: string[];
}

export const DEFAULT_RESOURCE_SETTINGS: ResourceSettings = {
  schemaVersion: RESOURCE_SETTINGS_SCHEMA_VERSION,
  customSources: [],
  index: {
    resources: [],
    sourceStates: []
  }
};

export function createDefaultResourceSettings(): ResourceSettings {
  return {
    schemaVersion: RESOURCE_SETTINGS_SCHEMA_VERSION,
    customSources: [],
    index: {
      resources: [],
      sourceStates: []
    }
  };
}

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && RESOURCE_TYPES.includes(value as ResourceType);
}

export function isCustomResourceType(value: unknown): value is CustomResourceType {
  return value === "script" || value === "preset" || value === "expression";
}

export function isResourceSourceStatus(
  value: unknown
): value is ResourceSourceStatus {
  return (
    typeof value === "string" &&
    RESOURCE_SOURCE_STATUSES.includes(value as ResourceSourceStatus)
  );
}

export function normalizeResourcePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/g, "");
}
