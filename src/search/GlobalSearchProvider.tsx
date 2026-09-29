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
  type GlobalSearchHostAction,
  type GlobalSearchHostBridge
} from "../host/globalSearchBridge";
import { buildToolSearchItems } from "./toolSearchCatalog";
import {
  buildGlobalSearchIndex,
  searchGlobalItems
} from "./searchOperations";
import type { GlobalSearchIndex, GlobalSearchItem } from "./types";

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
  const { resources, sources } = useResources();
  const [effects, setEffects] = useState<Awaited<ReturnType<GlobalSearchHostBridge["readCurrentAeEffects"]>> | null>(null);
  const [effectsStatus, setEffectsStatus] = useState<GlobalSearchContextValue["effectsStatus"]>("loading");

  const refreshEffects = useCallback(async () => {
    setEffectsStatus("loading");
    const snapshot = await bridge.readCurrentAeEffects();
    setEffects(snapshot);
    setEffectsStatus(snapshot.status);
  }, [bridge]);

  useEffect(() => {
    void refreshEffects();
  }, [refreshEffects]);

  const index = useMemo(() => {
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
    return buildGlobalSearchIndex({ items: [...toolItems, ...actionItems, ...resourceItems, ...effectItems] });
  }, [copy.home, effects, languageId, resources, sources]);

  const executeItem = useCallback(async (item: GlobalSearchItem): Promise<GlobalSearchActionResult> => {
    if (item.action === "execute-action" && item.actionId) {
      const result = await actionService.run(item.actionId);
      return result.success
        ? { ok: true }
        : { ok: false, reason: result.error?.code ?? "host-error", detail: result.error?.detail };
    }
    if (item.kind === "tool") return { ok: true };
    let action: GlobalSearchHostAction;
    if (item.action === "run-script") {
      const resource = resources.find((candidate) => candidate.id === item.resourceId);
      if (!resource) return { ok: false, reason: "invalid-resource" };
      const source = sources.find((candidate) => candidate.id === resource.sourceId);
      return bridge.executeGlobalSearchAction({
        action: "run-script",
        path: `${source?.path ?? resource.sourceId}/${resource.relativePath}`,
        ...(resource.resourceType === "panel" ? { resourceType: "panel" as const } : {})
      });
    }
    if (item.action === "apply-preset") {
      const resource = resources.find((candidate) => candidate.id === item.resourceId);
      if (!resource) return { ok: false, reason: "invalid-resource" };
      const source = sources.find((candidate) => candidate.id === resource.sourceId);
      return bridge.executeGlobalSearchAction({ action: "apply-preset", path: `${source?.path ?? resource.sourceId}/${resource.relativePath}` });
    }
    if (item.action === "add-effect") {
      return bridge.executeGlobalSearchAction({ action: "add-effect", matchName: item.sourceId ?? item.id });
    }
    action = { action: "run-script", path: item.resourceId ?? item.id };
    return bridge.executeGlobalSearchAction(action);
  }, [actionService, bridge, resources, sources]);

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
