import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import {
  cepResourceBridge,
  type ResourceHostBridge,
  type ResourceUseResult
} from "../host/resourceBridge";
import {
  createCustomResourceSource,
  mergeScanResult,
  removeCustomResourceSource,
  toggleResourceFavorite,
  updateCustomResourceSource,
  type CustomResourceSourceInput
} from "./resourceOperations";
import {
  readStoredResourceSettings,
  writeStoredResourceSettings
} from "./resourceStorage";
import {
  getResourceCommandItems,
  resolveResourceCommandContext,
  runResourceCommand as executeResourceCommand,
  type ResourceCommandId,
  type ResourceCommandItem,
  type ResourceCommandResult
} from "./resourceCommands";
import type {
  IndexedResource,
  ResourceScanResult,
  ResourceSettings,
  ResourceSource
} from "./types";

export interface ResourceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ResourceHostStatus =
  | "loading"
  | "connected"
  | "unavailable"
  | "error";

export interface ResourceContextValue {
  hostStatus: ResourceHostStatus;
  hostVersion: string | null;
  isDevelopmentFixture: boolean;
  sources: ResourceSource[];
  resources: IndexedResource[];
  refreshingSourceIds: string[];
  refreshAllSources(): Promise<void>;
  refreshSource(sourceId: string): Promise<void>;
  chooseDirectory: ResourceHostBridge["chooseDirectory"];
  openSourceDirectory: (
    sourceId: string
  ) => ReturnType<ResourceHostBridge["openSourceDirectory"]>;
  addCustomSource(input: CustomResourceSourceInput): Promise<ResourceSource>;
  updateCustomSource(
    sourceId: string,
    patch: Partial<Pick<ResourceSource, "name" | "path" | "resourceType" | "enabled">>
  ): Promise<void>;
  useResource(resourceId: string): Promise<ResourceUseResult>;
  getResourceCommands(resourceId: string): readonly ResourceCommandItem[];
  runResourceCommand(
    commandId: ResourceCommandId,
    resourceId: string
  ): Promise<ResourceCommandResult>;
  removeCustomSource(sourceId: string): void;
  toggleFavorite(resourceId: string): void;
}

interface ResourceProviderProps extends PropsWithChildren {
  bridge?: ResourceHostBridge;
  storage?: ResourceStorage;
  now?: () => Date;
  copyText?: (text: string) => Promise<void>;
}

const ResourceContext = createContext<ResourceContextValue | null>(null);

async function copyResourceText(text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // CEP/WebView may expose navigator.clipboard but reject file-scheme writes.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied =
    typeof document.execCommand === "function" &&
    document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard write failed");
  }
}

function mergeSourceScanResult(
  settings: ResourceSettings,
  source: ResourceSource,
  result: ResourceScanResult,
  scannedAt: string
): ResourceSettings {
  if (source.kind === "custom") {
    return mergeScanResult(settings, result, scannedAt);
  }

  const transientSettings = {
    ...settings,
    customSources: [...settings.customSources, source]
  };
  const merged = mergeScanResult(transientSettings, result, scannedAt);

  return {
    ...merged,
    customSources: settings.customSources
  };
}

function sourceWithCachedState(
  source: ResourceSource,
  settings: ResourceSettings,
  refreshing: ReadonlySet<string>
): ResourceSource {
  if (refreshing.has(source.id)) {
    return { ...source, status: "scanning", lastError: null };
  }

  if (source.status !== "ready") {
    return source;
  }

  const cachedState = settings.index.sourceStates.find(
    (state) => state.sourceId === source.id
  );

  return cachedState
    ? {
        ...source,
        status: cachedState.status,
        lastScannedAt: cachedState.lastScannedAt,
        lastError: cachedState.lastError
      }
    : source;
}

export function ResourceProvider({
  children,
  bridge = cepResourceBridge,
  storage,
  now = () => new Date(),
  copyText = copyResourceText
}: ResourceProviderProps) {
  const [settings, setSettings] = useState<ResourceSettings>(() =>
    readStoredResourceSettings(storage)
  );
  const [currentAeSources, setCurrentAeSources] = useState<ResourceSource[]>(
    []
  );
  const [hostStatus, setHostStatus] = useState<ResourceHostStatus>("loading");
  const [hostVersion, setHostVersion] = useState<string | null>(null);
  const [isDevelopmentFixture, setIsDevelopmentFixture] = useState(false);
  const [refreshingSourceIds, setRefreshingSourceIds] = useState<string[]>([]);
  const settingsRef = useRef(settings);
  const mountedRef = useRef(true);
  const scanVersionRef = useRef(new Map<string, number>());
  const executingResourceIdsRef = useRef(new Set<string>());

  settingsRef.current = settings;

  const updateSettings = useCallback(
    (updater: (current: ResourceSettings) => ResourceSettings) => {
      const next = updater(settingsRef.current);
      settingsRef.current = next;
      setSettings(next);
      return next;
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      scanVersionRef.current.clear();
      executingResourceIdsRef.current.clear();
    };
  }, []);

  useLayoutEffect(() => {
    writeStoredResourceSettings(settings, storage);
  }, [settings, storage]);

  useEffect(() => {
    let cancelled = false;

    void bridge
      .readCurrentAeSources()
      .then((snapshot) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        setHostStatus(snapshot.status);
        setHostVersion(snapshot.hostVersion);
        setIsDevelopmentFixture(snapshot.isDevelopmentFixture);
        setCurrentAeSources(snapshot.sources);

        if (snapshot.status === "connected") {
          const activeCurrentSourceIds = new Set(
            snapshot.sources.map((source) => source.id)
          );
          updateSettings((current) => ({
            ...current,
            index: {
              resources: current.index.resources.filter(
                (resource) =>
                  !resource.sourceId.startsWith("ae-default:") ||
                  activeCurrentSourceIds.has(resource.sourceId)
              ),
              sourceStates: current.index.sourceStates.filter(
                (sourceState) =>
                  !sourceState.sourceId.startsWith("ae-default:") ||
                  activeCurrentSourceIds.has(sourceState.sourceId)
              )
            }
          }));
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          setHostStatus("error");
          setHostVersion(null);
          setIsDevelopmentFixture(false);
          setCurrentAeSources([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bridge, updateSettings]);

  const sourceList = useMemo(
    () => [...currentAeSources, ...settings.customSources],
    [currentAeSources, settings.customSources]
  );
  const refreshingSet = useMemo(
    () => new Set(refreshingSourceIds),
    [refreshingSourceIds]
  );
  const sources = useMemo(
    () =>
      sourceList.map((source) =>
        sourceWithCachedState(source, settings, refreshingSet)
      ),
    [refreshingSet, settings, sourceList]
  );

  const scanSourceDefinition = useCallback(
    async (source: ResourceSource) => {
      if (!source.enabled) {
        return;
      }

      const scanVersion = (scanVersionRef.current.get(source.id) ?? 0) + 1;
      scanVersionRef.current.set(source.id, scanVersion);
      setRefreshingSourceIds((current) =>
        current.includes(source.id) ? current : [...current, source.id]
      );

      let result: ResourceScanResult;

      try {
        result = await bridge.scanSource(source);
      } catch {
        result = {
          sourceId: source.id,
          status: "error",
          resources: [],
          errorCode: "scan-failed"
        };
      }

      if (
        !mountedRef.current ||
        scanVersionRef.current.get(source.id) !== scanVersion
      ) {
        return;
      }

      const scannedAt = now().toISOString();
      updateSettings((current) =>
        mergeSourceScanResult(current, source, result, scannedAt)
      );
      setRefreshingSourceIds((current) =>
        current.filter((candidate) => candidate !== source.id)
      );
    },
    [bridge, now, updateSettings]
  );

  const refreshSource = useCallback(
    async (sourceId: string) => {
      const source = sourceList.find((candidate) => candidate.id === sourceId);

      if (!source) {
        return;
      }

      await scanSourceDefinition(source);
    },
    [scanSourceDefinition, sourceList]
  );

  const refreshAllSources = useCallback(async () => {
    for (const source of sourceList) {
      if (source.enabled) {
        await refreshSource(source.id);
      }
    }
  }, [refreshSource, sourceList]);

  const useResource = useCallback(
    async (resourceId: string): Promise<ResourceUseResult> => {
      const resource = settingsRef.current.index.resources.find(
        (candidate) => candidate.id === resourceId
      );
      const source = [
        ...currentAeSources,
        ...settingsRef.current.customSources
      ].find((candidate) => candidate.id === resource?.sourceId);

      if (!resource || !source || !source.enabled) {
        return { ok: false, reason: "invalid-resource" };
      }

      let result: ResourceUseResult;
      try {
        result = await bridge.useResource(source, resource);
      } catch {
        result = { ok: false, reason: "host-error" };
      }

      if (result.ok && mountedRef.current) {
        const usedAt = now().toISOString();
        updateSettings((current) => ({
          ...current,
          index: {
            ...current.index,
            resources: current.index.resources.map((candidate) =>
              candidate.id === resourceId
                ? { ...candidate, lastUsedAt: usedAt }
                : candidate
            )
          }
        }));
      }

      return result;
    },
    [bridge, currentAeSources, now, updateSettings]
  );

  const getResourceCommands = useCallback(
    (resourceId: string): readonly ResourceCommandItem[] => {
      const commandContext = resolveResourceCommandContext(
        resourceId,
        settingsRef.current.index.resources,
        [...currentAeSources, ...settingsRef.current.customSources],
        hostStatus
      );
      return commandContext.ok ? getResourceCommandItems(commandContext) : [];
    },
    [currentAeSources, hostStatus]
  );

  const runCommand = useCallback(
    async (
      commandId: ResourceCommandId,
      resourceId: string
    ): Promise<ResourceCommandResult> => {
      const commandContext = resolveResourceCommandContext(
        resourceId,
        settingsRef.current.index.resources,
        [...currentAeSources, ...settingsRef.current.customSources],
        hostStatus
      );

      if (!commandContext.ok) {
        return {
          ok: false,
          commandId,
          resourceId,
          reason: commandContext.reason
        };
      }

      if (
        commandId === "resource.use" &&
        executingResourceIdsRef.current.has(resourceId)
      ) {
        return {
          ok: false,
          commandId,
          resourceId,
          reason: "command-in-progress"
        };
      }

      if (commandId === "resource.use") {
        executingResourceIdsRef.current.add(resourceId);
      }

      try {
        return await executeResourceCommand(commandId, commandContext, {
          useResource,
          toggleFavorite: (targetId) => {
            updateSettings((current) =>
              toggleResourceFavorite(current, targetId)
            );
          },
          refreshSource,
          copyText,
          revealFile: (context) =>
            bridge.revealResourceFile(context.source, context.resource),
          openDefault: (context) =>
            bridge.openResourceFile(context.source, context.resource)
        });
      } finally {
        if (commandId === "resource.use") {
          executingResourceIdsRef.current.delete(resourceId);
        }
      }
    },
    [
      bridge,
      copyText,
      currentAeSources,
      hostStatus,
      refreshSource,
      updateSettings,
      useResource
    ]
  );

  const value = useMemo<ResourceContextValue>(
    () => ({
      hostStatus,
      hostVersion,
      isDevelopmentFixture,
      sources,
      resources: settings.index.resources,
      refreshingSourceIds,
      refreshAllSources,
      refreshSource,
      chooseDirectory: () => bridge.chooseDirectory(),
      openSourceDirectory: async (sourceId) => {
        const source = sourceList.find((candidate) => candidate.id === sourceId);

        if (!source) {
          return { ok: false, reason: "invalid-resource" as const };
        }

        try {
          return await bridge.openSourceDirectory(source);
        } catch {
          return { ok: false, reason: "host-error" as const };
        }
      },
      addCustomSource: async (input) => {
        const source = createCustomResourceSource(input, now());
        updateSettings((current) => ({
          ...current,
          customSources: [...current.customSources, source]
        }));
        await scanSourceDefinition(source);
        return source;
      },
      updateCustomSource: async (sourceId, patch) => {
        const previousSource = settingsRef.current.customSources.find(
          (source) => source.id === sourceId
        );

        if (!previousSource) {
          return;
        }

        const nextSettings = updateSettings((current) =>
          updateCustomResourceSource(current, sourceId, patch)
        );
        const nextSource = nextSettings.customSources.find(
          (source) => source.id === sourceId
        );

        if (
          nextSource &&
          nextSource.enabled &&
          (nextSource.path !== previousSource.path ||
            nextSource.resourceType !== previousSource.resourceType)
        ) {
          await scanSourceDefinition(nextSource);
        }
      },
      useResource,
      getResourceCommands,
      runResourceCommand: runCommand,
      removeCustomSource: (sourceId) => {
        updateSettings((current) =>
          removeCustomResourceSource(current, sourceId)
        );
      },
      toggleFavorite: (resourceId) => {
        updateSettings((current) =>
          toggleResourceFavorite(current, resourceId)
        );
      }
    }),
    [
      hostStatus,
      hostVersion,
      isDevelopmentFixture,
      bridge,
      now,
      getResourceCommands,
      runCommand,
      refreshAllSources,
      refreshSource,
      sourceList,
      refreshingSourceIds,
      scanSourceDefinition,
      settings,
      sources,
      updateSettings,
      useResource
    ]
  );

  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
}

export function useResources(): ResourceContextValue {
  const context = useContext(ResourceContext);

  if (!context) {
    throw new Error("useResources must be used inside ResourceProvider.");
  }

  return context;
}
