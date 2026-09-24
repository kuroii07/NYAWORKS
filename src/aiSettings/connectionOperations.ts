import { normalizeAiSettings } from "./aiSettingsStorage";
import type {
  AiConnection,
  AiFeatureRouting,
  AiModelTarget,
  AiSettings
} from "./types";

interface NewCustomConnectionInput {
  displayName: string;
  baseUrl: string;
  selectedModel: string;
}

interface OperationIdentity {
  id: string;
  now: string;
}

function createUniqueName(
  requestedName: string,
  connections: readonly AiConnection[],
  suffix = ""
): string {
  const baseName = requestedName.trim() || "Custom AI";
  const usedNames = new Set(
    connections.map((connection) => connection.displayName.toLocaleLowerCase())
  );
  const preferredName = `${baseName}${suffix}`.trim();

  if (!usedNames.has(preferredName.toLocaleLowerCase())) {
    return preferredName;
  }

  let index = 2;
  let candidate = `${baseName} ${index}`;

  while (usedNames.has(candidate.toLocaleLowerCase())) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }

  return candidate;
}

function isUsableTarget(
  target: AiModelTarget | null,
  connections: readonly AiConnection[]
): target is AiModelTarget {
  if (!target?.model.trim()) {
    return false;
  }

  return connections.some(
    (connection) =>
      connection.id === target.connectionId &&
      connection.enabled &&
      connection.selectedModel.trim()
  );
}

export function repairFeatureRouting(settings: AiSettings): AiSettings {
  const connections = settings.connections;
  const globalDefault = isUsableTarget(settings.globalDefault, connections)
    ? settings.globalDefault
    : null;

  function repairRoute(
    route: AiFeatureRouting[keyof AiFeatureRouting]
  ): "inherit" | AiModelTarget {
    return route !== "inherit" && isUsableTarget(route, connections)
      ? route
      : "inherit";
  }

  return normalizeAiSettings({
    ...settings,
    globalDefault,
    featureRouting: {
      chat: repairRoute(settings.featureRouting.chat),
      expression: repairRoute(settings.featureRouting.expression),
      script: repairRoute(settings.featureRouting.script)
    }
  });
}

export function createCustomConnection(
  settings: AiSettings,
  input: NewCustomConnectionInput,
  identity: OperationIdentity
): AiSettings {
  if (
    !identity.id.startsWith("custom:") ||
    settings.connections.some((connection) => connection.id === identity.id)
  ) {
    return settings;
  }

  const connection: AiConnection = {
    id: identity.id,
    kind: "custom",
    providerId: "openai-compatible",
    displayName: createUniqueName(input.displayName, settings.connections),
    enabled: true,
    baseUrl: input.baseUrl,
    apiKeyRef: null,
    selectedModel: input.selectedModel,
    discoveredModels: [],
    modelsFetchedAt: null,
    verificationStatus: "unconfigured",
    lastTestedAt: null,
    createdAt: identity.now,
    updatedAt: identity.now
  };

  return normalizeAiSettings({
    ...settings,
    connections: [...settings.connections, connection]
  });
}

export function renameConnection(
  settings: AiSettings,
  connectionId: string,
  displayName: string,
  now: string
): AiSettings {
  const connection = settings.connections.find(
    (candidate) => candidate.id === connectionId
  );

  if (!connection || connection.kind !== "custom") {
    return settings;
  }

  const otherConnections = settings.connections.filter(
    (candidate) => candidate.id !== connectionId
  );
  const nextName = createUniqueName(displayName, otherConnections);

  return normalizeAiSettings({
    ...settings,
    connections: settings.connections.map((candidate) =>
      candidate.id === connectionId
        ? { ...candidate, displayName: nextName, updatedAt: now }
        : candidate
    )
  });
}

export function duplicateConnectionWithoutSecret(
  settings: AiSettings,
  connectionId: string,
  identity: OperationIdentity
): AiSettings {
  const connection = settings.connections.find(
    (candidate) => candidate.id === connectionId
  );

  if (
    !connection ||
    connection.kind !== "custom" ||
    !identity.id.startsWith("custom:") ||
    settings.connections.some((candidate) => candidate.id === identity.id)
  ) {
    return settings;
  }

  const duplicate: AiConnection = {
    ...connection,
    id: identity.id,
    displayName: createUniqueName(
      connection.displayName,
      settings.connections,
      " 副本"
    ),
    apiKeyRef: null,
    discoveredModels: [...connection.discoveredModels],
    modelsFetchedAt: connection.modelsFetchedAt,
    verificationStatus: "unconfigured",
    lastTestedAt: null,
    createdAt: identity.now,
    updatedAt: identity.now
  };

  return normalizeAiSettings({
    ...settings,
    connections: [...settings.connections, duplicate]
  });
}

export function deleteConnection(
  settings: AiSettings,
  connectionId: string
): AiSettings {
  const connection = settings.connections.find(
    (candidate) => candidate.id === connectionId
  );

  if (!connection || connection.kind !== "custom") {
    return settings;
  }

  return repairFeatureRouting(
    normalizeAiSettings({
      ...settings,
      connections: settings.connections.filter(
        (candidate) => candidate.id !== connectionId
      )
    })
  );
}

export function toggleConnection(
  settings: AiSettings,
  connectionId: string,
  enabled: boolean
): AiSettings {
  if (!settings.connections.some((connection) => connection.id === connectionId)) {
    return settings;
  }

  return repairFeatureRouting(
    normalizeAiSettings({
      ...settings,
      connections: settings.connections.map((connection) =>
        connection.id === connectionId
          ? { ...connection, enabled }
          : connection
      )
    })
  );
}

export function setGlobalDefault(
  settings: AiSettings,
  connectionId: string,
  model: string
): AiSettings {
  const connection = settings.connections.find(
    (candidate) =>
      candidate.id === connectionId &&
      candidate.enabled &&
      candidate.selectedModel.trim()
  );

  if (!connection || !model.trim()) {
    return settings;
  }

  return normalizeAiSettings({
    ...settings,
    globalDefault: {
      connectionId,
      model: model.trim()
    }
  });
}

