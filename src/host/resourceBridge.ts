import {
  evaluateHostScript,
  type CepEnvironment
} from "./cepBridge";
import {
  isResourceSourceStatus,
  isResourceType,
  type ResourceScanResult,
  type ResourceSource
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

export interface ResourceHostBridge {
  readCurrentAeSources(): Promise<CurrentAeResourceSourcesResult>;
  scanSource(source: ResourceSource): Promise<ResourceScanResult>;
  chooseDirectory(): Promise<ResourceDirectoryChoiceResult>;
}

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
    }
  };
}

export const cepResourceBridge = createCepResourceBridge();
