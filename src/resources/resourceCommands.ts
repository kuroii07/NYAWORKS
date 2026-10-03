import type { ResourceHostStatus } from "./ResourceProvider";
import type { ResourceUseResult } from "../host/resourceBridge";
import type {
  IndexedResource,
  ResourceSource,
  ResourceType
} from "./types";

export type ResourceCommandId =
  | "resource.use"
  | "resource.favorite.toggle"
  | "resource.path.copy"
  | "resource.file.reveal"
  | "resource.source.refresh"
  | "resource.info.view"
  | "resource.file.open-default";

export type ResourceCommandFailureReason =
  | "host-unavailable"
  | "invalid-resource"
  | "source-missing"
  | "no-selected-layer"
  | "no-selected-property"
  | "empty-expression"
  | "panel-not-registered"
  | "unsupported-file-type"
  | "clipboard-failed"
  | "system-open-failed"
  | "confirmation-required"
  | "untrusted-source"
  | "command-in-progress"
  | "host-error";

export type ResourceCommandLabelKey =
  | "runScript"
  | "openPanel"
  | "runStartupOnce"
  | "applyPreset"
  | "applyExpression"
  | "favorite"
  | "unfavorite"
  | "copyPath"
  | "revealFile"
  | "openDefault"
  | "refreshSource"
  | "viewInfo";

export interface ResourceCommandAvailability {
  enabled: boolean;
  disabledReason?: ResourceCommandFailureReason;
}

export interface ResourceCommandItem extends ResourceCommandAvailability {
  id: ResourceCommandId;
  group: "primary" | "organize" | "file" | "source" | "details";
  labelKey: ResourceCommandLabelKey;
  shortcut?: "Enter";
}

export interface ResourceInfo {
  name: string;
  resourceType: ResourceType;
  sourceName: string;
  absolutePath: string;
  modifiedAt: string | null;
  favorite: boolean;
}

export type ResourceFileCommandResult =
  | { ok: true; path: string }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "invalid-resource"
        | "unsupported-file-type"
        | "system-open-failed"
        | "host-error";
      detail?: string;
    };

export type ResourceCommandResult =
  | {
      ok: true;
      commandId: ResourceCommandId;
      resourceId: string;
      affectedItems?: number;
      info?: ResourceInfo;
    }
  | {
      ok: false;
      commandId: ResourceCommandId;
      resourceId: string;
      reason: ResourceCommandFailureReason;
      detail?: string;
    };

export interface ResourceCommandDependencies {
  useResource(resourceId: string): Promise<ResourceUseResult>;
  toggleFavorite(resourceId: string): void;
  refreshSource(sourceId: string): Promise<void>;
  copyText(text: string): Promise<void>;
  revealFile(context: ResourceCommandContext): Promise<ResourceFileCommandResult>;
  openDefault(context: ResourceCommandContext): Promise<ResourceFileCommandResult>;
}

export interface ResourceCommandContext {
  ok: true;
  resource: IndexedResource;
  source: ResourceSource;
  absolutePath: string;
  hostStatus: ResourceHostStatus;
}

export interface ResourceCommandFailure {
  ok: false;
  reason: ResourceCommandFailureReason;
  resourceId: string;
}

function invalidResource(resourceId: string): ResourceCommandFailure {
  return { ok: false, reason: "invalid-resource", resourceId };
}

export function buildResourceAbsolutePath(
  source: ResourceSource,
  resource: IndexedResource
): string | null {
  if (source.id !== resource.sourceId) {
    return null;
  }

  const relativePath = resource.relativePath.replace(/\\/g, "/");
  const segments = relativePath.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "..") ||
    /[\u0000-\u001f"]/.test(relativePath)
  ) {
    return null;
  }

  const root = source.path.replace(/\\/g, "/").replace(/\/+$/g, "");
  return root ? `${root}/${segments.join("/")}` : null;
}

export function resolveResourceCommandContext(
  resourceId: string,
  resources: readonly IndexedResource[],
  sources: readonly ResourceSource[],
  hostStatus: ResourceHostStatus
): ResourceCommandContext | ResourceCommandFailure {
  const resource = resources.find((candidate) => candidate.id === resourceId);
  const source = sources.find(
    (candidate) => candidate.id === resource?.sourceId && candidate.enabled
  );

  if (!resource || !source) {
    return invalidResource(resourceId);
  }

  const absolutePath = buildResourceAbsolutePath(source, resource);
  if (!absolutePath) {
    return invalidResource(resourceId);
  }

  return {
    ok: true,
    resource,
    source,
    absolutePath,
    hostStatus
  };
}

const USE_LABELS: Record<ResourceType, ResourceCommandLabelKey> = {
  script: "runScript",
  panel: "openPanel",
  startup: "runStartupOnce",
  preset: "applyPreset",
  expression: "applyExpression"
};

function requiresHost(
  context: ResourceCommandContext
): ResourceCommandAvailability {
  return context.hostStatus === "connected"
    ? { enabled: true }
    : { enabled: false, disabledReason: "host-unavailable" };
}

function supportsDefaultOpen(context: ResourceCommandContext): boolean {
  const extension = context.resource.relativePath
    .toLocaleLowerCase()
    .match(/\.[^.\\/]+$/)?.[0];

  if (context.resource.resourceType === "expression") {
    return extension === ".jsx" || extension === ".txt" || extension === ".json";
  }

  return (
    (context.resource.resourceType === "script" ||
      context.resource.resourceType === "startup") &&
    (extension === ".jsx" || extension === ".js")
  );
}

export function getResourceCommandItems(
  context: ResourceCommandContext
): readonly ResourceCommandItem[] {
  const hostAvailability = requiresHost(context);
  const items: ResourceCommandItem[] = [
    {
      id: "resource.use",
      group: "primary",
      labelKey: USE_LABELS[context.resource.resourceType],
      ...(context.resource.resourceType === "panel" ? {} : { shortcut: "Enter" as const }),
      ...hostAvailability
    },
    {
      id: "resource.favorite.toggle",
      group: "organize",
      labelKey: context.resource.favorite ? "unfavorite" : "favorite",
      enabled: true
    },
    {
      id: "resource.path.copy",
      group: "file",
      labelKey: "copyPath",
      enabled: true
    },
    {
      id: "resource.file.reveal",
      group: "file",
      labelKey: "revealFile",
      ...hostAvailability
    }
  ];

  if (supportsDefaultOpen(context)) {
    items.push({
      id: "resource.file.open-default",
      group: "file",
      labelKey: "openDefault",
      ...hostAvailability
    });
  }

  return items;
}

function normalizeDependencyReason(reason: string): ResourceCommandFailureReason {
  if (reason === "unavailable") return "host-unavailable";
  if (
    reason === "invalid-resource" ||
    reason === "no-selected-layer" ||
    reason === "no-selected-property" ||
    reason === "empty-expression" ||
    reason === "panel-not-registered" ||
    reason === "unsupported-file-type" ||
    reason === "system-open-failed"
  ) {
    return reason;
  }
  return "host-error";
}

function commandFailure(
  commandId: ResourceCommandId,
  context: ResourceCommandContext,
  reason: ResourceCommandFailureReason,
  detail?: string
): ResourceCommandResult {
  return {
    ok: false,
    commandId,
    resourceId: context.resource.id,
    reason,
    ...(detail ? { detail } : {})
  };
}

function commandSuccess(
  commandId: ResourceCommandId,
  context: ResourceCommandContext,
  extra: Pick<Extract<ResourceCommandResult, { ok: true }>, "affectedItems" | "info"> = {}
): ResourceCommandResult {
  return {
    ok: true,
    commandId,
    resourceId: context.resource.id,
    ...extra
  };
}

export async function runResourceCommand(
  commandId: ResourceCommandId,
  context: ResourceCommandContext,
  dependencies: ResourceCommandDependencies
): Promise<ResourceCommandResult> {
  const visibleItem = getResourceCommandItems(context).find(
    (candidate) => candidate.id === commandId
  );
  const item = visibleItem ?? (
    commandId === "resource.source.refresh" || commandId === "resource.info.view"
      ? { id: commandId, enabled: true }
      : undefined
  );

  if (!item) {
    return commandFailure(commandId, context, "unsupported-file-type");
  }
  if (!item.enabled) {
    return commandFailure(
      commandId,
      context,
      item.disabledReason ?? "host-unavailable"
    );
  }

  try {
    if (commandId === "resource.use") {
      const result = await dependencies.useResource(context.resource.id);
      return result.ok
        ? commandSuccess(commandId, context, {
            ...(result.affectedItems === undefined
              ? {}
              : { affectedItems: result.affectedItems })
          })
        : commandFailure(
            commandId,
            context,
            normalizeDependencyReason(result.reason),
            result.detail
          );
    }
    if (commandId === "resource.favorite.toggle") {
      dependencies.toggleFavorite(context.resource.id);
      return commandSuccess(commandId, context);
    }
    if (commandId === "resource.path.copy") {
      await dependencies.copyText(context.absolutePath);
      return commandSuccess(commandId, context);
    }
    if (commandId === "resource.file.reveal") {
      const result = await dependencies.revealFile(context);
      return result.ok
        ? commandSuccess(commandId, context)
        : commandFailure(
            commandId,
            context,
            normalizeDependencyReason(result.reason),
            result.detail
          );
    }
    if (commandId === "resource.file.open-default") {
      const result = await dependencies.openDefault(context);
      return result.ok
        ? commandSuccess(commandId, context)
        : commandFailure(
            commandId,
            context,
            normalizeDependencyReason(result.reason),
            result.detail
          );
    }
    if (commandId === "resource.source.refresh") {
      await dependencies.refreshSource(context.source.id);
      return commandSuccess(commandId, context);
    }

    return commandSuccess(commandId, context, {
      info: {
        name: context.resource.name,
        resourceType: context.resource.resourceType,
        sourceName: context.source.name,
        absolutePath: context.absolutePath,
        modifiedAt: context.resource.modifiedAt,
        favorite: context.resource.favorite
      }
    });
  } catch (error) {
    return commandFailure(
      commandId,
      context,
      commandId === "resource.path.copy" ? "clipboard-failed" : "host-error",
      error instanceof Error ? error.message : undefined
    );
  }
}
