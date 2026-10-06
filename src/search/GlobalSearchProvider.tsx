import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { useActionService } from "../actions/ActionServiceProvider";
import { coreActionRegistry } from "../actions/registry";
import { buildActionSearchItems } from "./actionSearchAdapter";
import { useResources } from "../resources/ResourceProvider";
import { displayResourcePath } from "../resources/resourceOperations";
import {
  globalSearchHostBridge,
  type GlobalSearchActionResult,
  type GlobalSearchHostBridge
} from "../host/globalSearchBridge";
import { buildToolSearchItems } from "./toolSearchCatalog";
import {
  buildGlobalSearchIndex,
  searchGlobalItems
} from "./searchOperations";
import type { GlobalSearchIndex, GlobalSearchItem } from "./types";
import {
  buildRecentRanks,
  readSearchHistory,
  recordSearchHistory
} from "./searchHistory";

export interface GlobalSearchContextValue {
  index: GlobalSearchIndex;
  search(query: string, limit?: number): GlobalSearchItem[];
  effectsStatus: "loading" | "connected" | "unavailable" | "error";
  refreshEffects(): Promise<void>;
  executeItem(item: GlobalSearchItem): Promise<GlobalSearchActionResult>;
}

interface GlobalSearchProviderProps extends PropsWithChildren {
  bridge?: GlobalSearchHostBridge;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

function iconKeyForResource(resourceType: string): string {
  return resourceType === "preset" ? "preset" : resourceType === "expression" ? "expression" : "script";
}

function actionForResource(resourceType: string): GlobalSearchItem["action"] {
  if (resourceType === "preset") return "apply-preset";
  if (resourceType === "expression") return "open-expression";
  return "run-script";
}

export function GlobalSearchProvider({
  children,
  bridge = globalSearchHostBridge
}: GlobalSearchProviderProps) {
  const { copy, languageId } = useLanguage();
  const actionService = useActionService();
  const { resources, runResourceCommand } = useResources();
  const [effects, setEffects] = useState<Awaited<ReturnType<GlobalSearchHostBridge["readCurrentAeEffects"]>> | null>(null);
  const [effectsStatus, setEffectsStatus] = useState<GlobalSearchContextValue["effectsStatus"]>("loading");
  const [recentIds, setRecentIds] = useState<string[]>(() => readSearchHistory());

  const refreshEffects = useCallback(async () => {
    setEffectsStatus("loading");
    try {
      const snapshot = await bridge.readCurrentAeEffects();
      setEffects(snapshot);
      setEffectsStatus(snapshot.status);
    } catch {
      setEffectsStatus("error");
    }
  }, [bridge]);

  useEffect(() => {
    void refreshEffects();
  }, [refreshEffects]);

  const index = useMemo(() => {
    const recentRanks = buildRecentRanks(recentIds);
    const toolItems = buildToolSearchItems(copy.home);
    const actionLanguage = languageId === "zh-CN"
      ? "zhCN"
      : languageId === "zh-TW"
        ? "zhTW"
        : languageId;
    const actionItems = buildActionSearchItems(coreActionRegistry, actionLanguage);
    const resourceItems: GlobalSearchItem[] = resources.map((resource, index) => {
      return {
        id: resource.id,
        kind: resource.resourceType === "preset"
          ? "preset"
          : resource.resourceType === "expression"
            ? "expression"
            : "script",
        name: resource.name,
        aliases: [resource.relativePath, displayResourcePath(resource.relativePath)],
        searchableText: `${resource.name} ${displayResourcePath(resource.relativePath)}`,
        iconKey: iconKeyForResource(resource.resourceType),
        action: actionForResource(resource.resourceType),
        sourceId: resource.sourceId,
        resourceId: resource.id,
        resourceType: resource.resourceType,
        requiresHost: true,
        order: 1000 + index,
        displaySuffix: resource.resourceType
      };
    });
    const effectItems: GlobalSearchItem[] = (effects?.effects ?? []).map((effect, index) => ({
      id: effect.id,
      kind: "effect",
      name: effect.name,
      aliases: effect.aliases,
      searchableText: `${effect.name} ${effect.matchName} ${effect.aliases.join(" ")}`,
      iconKey: "effect",
      action: "add-effect",
      sourceId: effect.matchName,
      requiresHost: true,
      order: 2000 + index
    }));
    return buildGlobalSearchIndex({
      items: [...toolItems, ...actionItems, ...resourceItems, ...effectItems].map((item) => ({
        ...item,
        ...(recentRanks.has(item.id)
          ? { recentRank: recentRanks.get(item.id) }
          : {})
      }))
    });
  }, [copy.home, effects, languageId, recentIds, resources]);

  const rememberItem = useCallback((item: GlobalSearchItem) => {
    setRecentIds(recordSearchHistory(item.id));
  }, []);

  const executeItem = useCallback(async (item: GlobalSearchItem): Promise<GlobalSearchActionResult> => {
    let result: GlobalSearchActionResult;
    if (item.action === "execute-action" && item.actionId) {
      const actionResult = await actionService.run(item.actionId);
      result = actionResult.success
        ? { ok: true }
        : { ok: false, reason: actionResult.error?.code ?? "host-error", detail: actionResult.error?.detail };
    } else if (item.action === "execute-tool" && item.opensBanner && item.toolId) {
      result = { ok: true };
    } else if (item.action === "execute-tool") {
      result = { ok: false, reason: "unsupported-tool" };
    } else if (item.resourceId) {
      const resourceResult = await runResourceCommand("resource.use", item.resourceId);
      result = resourceResult.ok
        ? { ok: true }
        : { ok: false, reason: resourceResult.reason, detail: resourceResult.detail };
    } else if (item.action === "add-effect") {
      result = await bridge.executeGlobalSearchAction({
        action: "add-effect",
        matchName: item.sourceId ?? item.id
      });
    } else {
      result = { ok: false, reason: "invalid-resource" };
    }
    if (result.ok) rememberItem(item);
    return result;
  }, [actionService, bridge, rememberItem, runResourceCommand]);

  const value = useMemo<GlobalSearchContextValue>(() => ({
    index,
    search: (query, limit) => searchGlobalItems(index, query, limit === undefined ? {} : { limit }),
    effectsStatus,
    refreshEffects,
    executeItem
  }), [effectsStatus, executeItem, index, refreshEffects]);

  return <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>;
}

export function useGlobalSearch(): GlobalSearchContextValue {
  const context = useContext(GlobalSearchContext);
  if (!context) throw new Error("useGlobalSearch must be used inside GlobalSearchProvider.");
  return context;
}

export function useOptionalGlobalSearch(): GlobalSearchContextValue | null {
  return useContext(GlobalSearchContext);
}
