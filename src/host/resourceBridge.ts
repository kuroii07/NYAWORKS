import {
  evaluateHostScript,
  type CepEnvironment
} from "./cepBridge";
import {
  isResourceSourceStatus,
  isResourceType,
  normalizeResourcePath,
  type IndexedResource,
  type ResourceScanResult,
  type ResourceSource,
  type ResourceType
} from "../resources/types";

export interface CurrentAeResourceSourcesResult {
  status: "connected" | "unavailable" | "error";
  hostVersion: string | null;
  sources: ResourceSource[];
  isDevelopmentFixture: boolean;
}

export interface ResourceDirectoryChoiceResult {
  status: "selected" | "cancelled" | "unavailable" | "error";
  path: string | null;
}

export type ResourceDirectoryOpenResult =
  | { ok: true; path: string }
  | {
      ok: false;
      reason: "unavailable" | "invalid-resource" | "host-error";
      detail?: string;
    };

export interface ResourceHostBridge {
  readCurrentAeSources(): Promise<CurrentAeResourceSourcesResult>;
  scanSource(source: ResourceSource): Promise<ResourceScanResult>;
  chooseDirectory(): Promise<ResourceDirectoryChoiceResult>;
  openSourceDirectory(source: ResourceSource): Promise<ResourceDirectoryOpenResult>;
  useResource(
    source: ResourceSource,
    resource: IndexedResource
  ): Promise<ResourceUseResult>;
}

export type ResourceUseResult =
  | { ok: true; updatedItems?: number }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "invalid-resource"
        | "no-selected-layer"
        | "no-selected-property"
        | "empty-expression"
        | "host-error";
      detail?: string;
    };

const UNAVAILABLE_SOURCES: CurrentAeResourceSourcesResult = {
  status: "unavailable",
  hostVersion: null,
  sources: [],
  isDevelopmentFixture: false
};

const ERROR_SOURCES: CurrentAeResourceSourcesResult = {
  status: "error",
  hostVersion: null,
  sources: [],
  isDevelopmentFixture: false
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLastError(
  value: unknown
): value is ResourceSource["lastError"] {
  return (
    value === null ||
    value === "missing" ||
    value === "scan-failed" ||
    value === "unavailable"
  );
}

function normalizeHostSource(value: unknown): ResourceSource | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    (value.kind !== "ae-default" && value.kind !== "custom") ||
    !isResourceType(value.resourceType) ||
    typeof value.name !== "string" ||
    typeof value.path !== "string" ||
    !isResourceSourceStatus(value.status)
  ) {
    return null;
  }

  return {
    id: value.id,
    kind: value.kind,
    resourceType: value.resourceType,
    name: value.name,
    path: value.path,
    enabled: value.enabled !== false,
    hostVersion: typeof value.hostVersion === "string" ? value.hostVersion : null,
    status: value.status,
    lastScannedAt:
      typeof value.lastScannedAt === "string" ? value.lastScannedAt : null,
    lastError: isLastError(value.lastError) ? value.lastError : null
  };
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseScanResult(
  sourceId: string,
  value: string | null
): ResourceScanResult {
  if (value === null) {
    return {
      sourceId,
      status: "error",
      resources: [],
      errorCode: "unavailable"
    };
  }

  const parsed = parseJson(value);

  if (!isRecord(parsed) || parsed.sourceId !== sourceId) {
    return {
      sourceId,
      status: "error",
      resources: [],
      errorCode: "scan-failed"
    };
  }

  const status =
    parsed.status === "ready" ||
    parsed.status === "missing" ||
    parsed.status === "error"
      ? parsed.status
      : "error";
  const resources = Array.isArray(parsed.resources)
    ? parsed.resources
        .filter(isRecord)
        .map((resource) => ({
          relativePath:
            typeof resource.relativePath === "string" ? resource.relativePath : "",
          modifiedAt:
            typeof resource.modifiedAt === "string" ? resource.modifiedAt : null
        }))
        .filter((resource) => resource.relativePath.length > 0)
    : [];

  return {
    sourceId,
    status,
    resources,
    ...(parsed.errorCode === "missing" ||
    parsed.errorCode === "scan-failed" ||
    parsed.errorCode === "unavailable"
      ? { errorCode: parsed.errorCode }
      : {})
  };
}

function encodeSourcePayload(source: ResourceSource): string {
  return encodeURIComponent(
    JSON.stringify({
      id: source.id,
      kind: source.kind,
      resourceType: source.resourceType,
      path: source.path
    })
  );
}

function resourcePath(
  source: ResourceSource,
  resource: IndexedResource
): string {
  const root = normalizeResourcePath(source.path);
  const relativePath = normalizeResourcePath(resource.relativePath).replace(
    /^\/+/,
    ""
  );
  return `${root}/${relativePath}`;
}

function parseResourceUseResult(value: string | null): ResourceUseResult {
  if (value === null) {
    return { ok: false, reason: "unavailable" };
  }

  const parsed = parseJson(value);

  if (isRecord(parsed) && parsed.ok === true) {
    return {
      ok: true,
      ...(typeof parsed.updatedItems === "number"
        ? { updatedItems: parsed.updatedItems }
        : {})
    };
  }

  const reason =
    isRecord(parsed) &&
    (parsed.reason === "invalid-resource" ||
      parsed.reason === "no-selected-layer" ||
      parsed.reason === "no-selected-property" ||
      parsed.reason === "empty-expression")
      ? parsed.reason
      : "host-error";

  return {
    ok: false,
    reason,
    ...(isRecord(parsed) && typeof parsed.detail === "string"
      ? { detail: parsed.detail }
      : {})
  };
}

function parseResourceDirectoryOpenResult(
  value: string | null
): ResourceDirectoryOpenResult {
  if (value === null) {
    return { ok: false, reason: "unavailable" };
  }

  const parsed = parseJson(value);
  if (isRecord(parsed) && parsed.ok === true && typeof parsed.path === "string") {
    return { ok: true, path: parsed.path };
  }

  return {
    ok: false,
    reason:
      isRecord(parsed) &&
      (parsed.reason === "invalid-resource" || parsed.reason === "host-error")
        ? parsed.reason
        : "host-error",
    ...(isRecord(parsed) && typeof parsed.detail === "string"
      ? { detail: parsed.detail }
      : {})
  };
}

export function createCepResourceBridge(
  environment?: CepEnvironment
): ResourceHostBridge {
  return {
    async readCurrentAeSources() {
      const result = await evaluateHostScript(
        "NYAWORKS.getCurrentResourceSources()",
        environment
      );

      if (result === null) {
        return UNAVAILABLE_SOURCES;
      }

      const parsed = parseJson(result);

      if (!isRecord(parsed) || parsed.ok !== true || typeof parsed.version !== "string") {
        return ERROR_SOURCES;
      }

      return {
        status: "connected",
        hostVersion: parsed.version,
        sources: Array.isArray(parsed.sources)
          ? parsed.sources
              .map(normalizeHostSource)
              .filter((source): source is ResourceSource => source !== null)
          : [],
        isDevelopmentFixture: false
      };
    },
    async scanSource(source) {
      return parseScanResult(
        source.id,
        await evaluateHostScript(
          `NYAWORKS.scanResourceSource("${encodeSourcePayload(source)}")`,
          environment
        )
      );
    },
    async chooseDirectory() {
      const result = await evaluateHostScript(
        "NYAWORKS.chooseResourceDirectory()",
        environment
      );

      if (result === null) {
        return { status: "unavailable", path: null };
      }

      const parsed = parseJson(result);

      if (!isRecord(parsed)) {
        return { status: "error", path: null };
      }

      if (parsed.status === "selected" && typeof parsed.path === "string") {
        return { status: "selected", path: parsed.path };
      }

      return parsed.status === "cancelled"
        ? { status: "cancelled", path: null }
        : { status: "error", path: null };
    },
    async openSourceDirectory(source) {
      return parseResourceDirectoryOpenResult(
        await evaluateHostScript(
          `NYAWORKS.openResourceDirectory("${encodeSourcePayload(source)}")`,
          environment
        )
      );
    },
    async useResource(source, resource) {
      const path = resourcePath(source, resource);
      const resourcePayload: { path: string; resourceType?: ResourceType } = { path };
      if (resource.resourceType === "panel") {
        resourcePayload.resourceType = "panel";
      }
      const payload = encodeURIComponent(JSON.stringify(resourcePayload));
      const functionName =
        resource.resourceType === "preset"
          ? "applySearchPreset"
          : resource.resourceType === "expression"
            ? "applyResourceExpression"
            : "runSearchScript";

      return parseResourceUseResult(
        await evaluateHostScript(
          `NYAWORKS.${functionName}("${payload}")`,
          environment
        )
      );
    }
  };
}

export const cepResourceBridge = createCepResourceBridge();
