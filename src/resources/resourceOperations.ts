import {
  isCustomResourceType,
  normalizeResourcePath,
  type IndexedResource,
  type ResourceFolderNode,
  type ResourceScanEntry,
  type ResourceScanResult,
  type ResourceSettings,
  type ResourceSource,
  type ResourceSourceStatus,
  type ResourceType
} from "./types";

const EXTENSIONS_BY_TYPE: Record<ResourceType, readonly string[]> = {
  script: ["jsx", "jsxbin", "js"],
  panel: ["jsx", "jsxbin", "js"],
  startup: ["jsx", "jsxbin", "js"],
  preset: ["ffx"],
  expression: ["jsx", "json", "txt"]
};

export interface CustomResourceSourceInput {
  name: string;
  resourceType: ResourceSource["resourceType"];
  path: string;
}

function createSourceId(name: string, now: Date): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "source";

  return `custom:${now.getTime()}:${slug}`;
}

function extensionOf(relativePath: string): string | null {
  const match = relativePath.match(/\.([^.\/]+)$/);
  return match ? match[1].toLowerCase() : null;
}

function displayNameOf(relativePath: string): string {
  const filename = relativePath.split("/").at(-1) ?? relativePath;
  return filename.replace(/\.[^.]+$/, "");
}

function scanErrorFor(status: ResourceSourceStatus): ResourceSource["lastError"] {
  if (status === "missing") {
    return "missing";
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  return status === "error" ? "scan-failed" : null;
}

function normalizedResourceId(sourceId: string, relativePath: string): string {
  return `${sourceId}:${relativePath.toLowerCase()}`;
}

export function createCustomResourceSource(
  input: CustomResourceSourceInput,
  now: Date
): ResourceSource {
  const name = input.name.trim();
  const path = normalizeResourcePath(input.path.trim());

  if (!name || !path || !isCustomResourceType(input.resourceType)) {
    throw new Error("Invalid custom resource source");
  }

  return {
    id: createSourceId(name, now),
    kind: "custom",
    resourceType: input.resourceType,
    name,
    path,
    enabled: true,
    hostVersion: null,
    status: "ready",
    lastScannedAt: null,
    lastError: null
  };
}

export function updateCustomResourceSource(
  settings: ResourceSettings,
  sourceId: string,
  patch: Partial<Pick<ResourceSource, "name" | "path" | "enabled">>
): ResourceSettings {
  return {
    ...settings,
    customSources: settings.customSources.map((source) => {
      if (source.id !== sourceId) {
        return source;
      }

      return {
        ...source,
        name: patch.name === undefined ? source.name : patch.name.trim() || source.name,
        path:
          patch.path === undefined
            ? source.path
            : normalizeResourcePath(patch.path.trim()) || source.path,
        enabled: patch.enabled ?? source.enabled
      };
    })
  };
}

export function removeCustomResourceSource(
  settings: ResourceSettings,
  sourceId: string
): ResourceSettings {
  return {
    ...settings,
    customSources: settings.customSources.filter((source) => source.id !== sourceId),
    index: {
      resources: settings.index.resources.filter(
        (resource) => resource.sourceId !== sourceId
      ),
      sourceStates: settings.index.sourceStates.filter(
        (state) => state.sourceId !== sourceId
      )
    }
  };
}

export function normalizeResourceScanResult(
  source: ResourceSource,
  result: ResourceScanResult
): ResourceScanResult & { resources: IndexedResource[] } {
  const seen = new Set<string>();
  const resources = result.resources.reduce<IndexedResource[]>((items, entry) => {
    const relativePath = normalizeResourcePath(entry.relativePath.trim());
    const extension = extensionOf(relativePath);
    const id = normalizedResourceId(source.id, relativePath);

    if (
      !relativePath ||
      !extension ||
      !EXTENSIONS_BY_TYPE[source.resourceType].includes(extension) ||
      seen.has(id)
    ) {
      return items;
    }

    seen.add(id);
    items.push({
      id,
      sourceId: source.id,
      resourceType: source.resourceType,
      name: displayNameOf(relativePath),
      relativePath,
      modifiedAt: entry.modifiedAt,
      favorite: false,
      lastUsedAt: null,
      preview: { coverUri: null, loopUri: null, cacheKey: null, status: "none" }
    });
    return items;
  }, []);

  return {
    ...result,
    sourceId: source.id,
    resources
  };
}

export function mergeScanResult(
  settings: ResourceSettings,
  result: ResourceScanResult,
  scannedAt: string
): ResourceSettings {
  const source = settings.customSources.find((candidate) => candidate.id === result.sourceId);

  if (!source) {
    return settings;
  }

  const normalized = normalizeResourceScanResult(source, result);
  const nextStatus = result.status;
  const didSucceed = nextStatus === "ready";
  const priorFavorites = new Set(
    settings.index.resources
      .filter((resource) => resource.sourceId === source.id && resource.favorite)
      .map((resource) => resource.id)
  );
  const nextResources = didSucceed
    ? [
        ...settings.index.resources.filter((resource) => resource.sourceId !== source.id),
        ...normalized.resources.map((resource) => ({
          ...resource,
          favorite: priorFavorites.has(resource.id)
        }))
      ]
    : settings.index.resources;
  const nextError = result.errorCode ?? scanErrorFor(nextStatus);
  const nextSource = {
    ...source,
    status: nextStatus,
    lastScannedAt: scannedAt,
    lastError: nextError
  };
  const nextState = {
    sourceId: source.id,
    status: nextStatus,
    lastScannedAt: scannedAt,
    lastError: nextError,
    itemCount: didSucceed
      ? normalized.resources.length
      : settings.index.resources.filter((resource) => resource.sourceId === source.id)
          .length
  };

  return {
    ...settings,
    customSources: settings.customSources.map((candidate) =>
      candidate.id === source.id ? nextSource : candidate
    ),
    index: {
      resources: nextResources,
      sourceStates: [
        ...settings.index.sourceStates.filter((state) => state.sourceId !== source.id),
        nextState
      ]
    }
  };
}

export function toggleResourceFavorite(
  settings: ResourceSettings,
  resourceId: string
): ResourceSettings {
  return {
    ...settings,
    index: {
      ...settings.index,
      resources: settings.index.resources.map((resource) =>
        resource.id === resourceId
          ? { ...resource, favorite: !resource.favorite }
          : resource
      )
    }
  };
}

export function filterIndexedResources(
  settings: ResourceSettings,
  query: string,
  type: "all" | ResourceType,
  sourceId?: string
): IndexedResource[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return settings.index.resources.filter((resource) => {
    const matchesQuery =
      !normalizedQuery ||
      resource.name.toLocaleLowerCase().includes(normalizedQuery) ||
      resource.relativePath.toLocaleLowerCase().includes(normalizedQuery);

    return (
      matchesQuery &&
      (type === "all" || resource.resourceType === type) &&
      (sourceId === undefined || resource.sourceId === sourceId)
    );
  });
}

export function buildResourceFolderTree(
  resources: readonly IndexedResource[]
): ResourceFolderNode[] {
  const roots: ResourceFolderNode[] = [];

  for (const resource of resources) {
    const folders = resource.relativePath.split("/").slice(0, -1);
    let nodes = roots;
    let currentPath = "";

    for (const folder of folders) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      const key = currentPath.toLocaleLowerCase();
      let node = nodes.find((candidate) => candidate.path === key);

      if (!node) {
        node = { name: folder, path: key, children: [], resourceIds: [] };
        nodes.push(node);
      }

      nodes = node.children;
    }

    if (folders.length > 0) {
      let targetNodes = roots;
      let target: ResourceFolderNode | undefined;

      for (const folder of folders) {
        const key = target ? `${target.path}/${folder.toLocaleLowerCase()}` : folder.toLocaleLowerCase();
        target = targetNodes.find((candidate) => candidate.path === key);
        targetNodes = target?.children ?? [];
      }

      target?.resourceIds.push(resource.id);
    }
  }

  return roots;
}
