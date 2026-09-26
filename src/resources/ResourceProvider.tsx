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
  type ResourceHostBridge
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
  addCustomSource(input: CustomResourceSourceInput): ResourceSource;
  updateCustomSource(
    sourceId: string,
    patch: Partial<Pick<ResourceSource, "name" | "path" | "enabled">>
  ): void;
  removeCustomSource(sourceId: string): void;
  toggleFavorite(resourceId: string): void;
}

interface ResourceProviderProps extends PropsWithChildren {
  bridge?: ResourceHostBridge;
  storage?: ResourceStorage;
  now?: () => Date;
}

const ResourceContext = createContext<ResourceContextValue | null>(null);

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
  now = () => new Date()
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
  const mountedRef = useRef(true);
  const scanVersionRef = useRef(new Map<string, number>());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      scanVersionRef.current.clear();
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
  }, [bridge]);

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

  const refreshSource = useCallback(
    async (sourceId: string) => {
      const source = sourceList.find((candidate) => candidate.id === sourceId);

      if (!source || !source.enabled) {
        return;
      }

      const scanVersion = (scanVersionRef.current.get(sourceId) ?? 0) + 1;
      scanVersionRef.current.set(sourceId, scanVersion);
      setRefreshingSourceIds((current) =>
        current.includes(sourceId) ? current : [...current, sourceId]
      );

      let result: ResourceScanResult;

      try {
        result = await bridge.scanSource(source);
      } catch {
        result = {
          sourceId,
          status: "error",
          resources: [],
          errorCode: "scan-failed"
        };
      }

      if (
        !mountedRef.current ||
        scanVersionRef.current.get(sourceId) !== scanVersion
      ) {
        return;
      }

      const scannedAt = now().toISOString();
      setSettings((current) =>
        mergeSourceScanResult(current, source, result, scannedAt)
      );
      setRefreshingSourceIds((current) =>
        current.filter((candidate) => candidate !== sourceId)
      );
    },
    [bridge, now, sourceList]
  );

  const refreshAllSources = useCallback(async () => {
    for (const source of sourceList) {
      if (source.enabled) {
        await refreshSource(source.id);
      }
    }
  }, [refreshSource, sourceList]);

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
      addCustomSource: (input) => {
        const source = createCustomResourceSource(input, now());
        setSettings((current) => ({
          ...current,
          customSources: [...current.customSources, source]
        }));
        return source;
      },
      updateCustomSource: (sourceId, patch) => {
        setSettings((current) =>
          updateCustomResourceSource(current, sourceId, patch)
        );
      },
      removeCustomSource: (sourceId) => {
        setSettings((current) => removeCustomResourceSource(current, sourceId));
      },
      toggleFavorite: (resourceId) => {
        setSettings((current) => toggleResourceFavorite(current, resourceId));
      }
    }),
    [
      hostStatus,
      hostVersion,
      isDevelopmentFixture,
      now,
      refreshAllSources,
      refreshSource,
      refreshingSourceIds,
      settings,
      sources
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
