import {
  Archive,
  BracketsCurly,
  CaretDown,
  CaretRight,
  FileCode,
  FileText,
  FolderSimple,
  Heart,
  MagnifyingGlass,
  Lightning,
  SlidersHorizontal
} from "@phosphor-icons/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import {
  SettingSelect,
  type SettingSelectOption
} from "../components/SettingSelect";
import { AppDialog } from "../components/AppDialog";
import {
  ResourceContextMenu,
  type ResourceMenuAnchor
} from "../components/ResourceContextMenu";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  buildResourceFolderTree,
  displayResourcePath,
  filterIndexedResources
} from "../resources/resourceOperations";
import {
  moveResourceSelection,
  reconcileFilteredSelection,
  reconcileRefreshedSelection,
  type ResourceSelectionState
} from "../resources/resourceSelection";
import type {
  ResourceCommandFailureReason,
  ResourceCommandId,
  ResourceInfo
} from "../resources/resourceCommands";
import { useResources } from "../resources/ResourceProvider";
import { useToast } from "../notifications/ToastProvider";
import type { IndexedResource, ResourceFolderNode, ResourceType } from "../resources/types";

type ResourceFilterType = "all" | ResourceType;
type SourceFilter = "all" | "favorites" | string;

function SourceTree({
  nodes,
  selectedFolder,
  expandedFolders,
  onSelectFolder,
  onToggleFolder
}: {
  nodes: readonly ResourceFolderNode[];
  selectedFolder: string | null;
  expandedFolders: readonly string[];
  onSelectFolder: (path: string) => void;
  onToggleFolder: (path: string) => void;
}) {
  return (
    <ul className="resource-folder-tree">
      {nodes.map((node) => {
        const expanded = expandedFolders.includes(node.path);
        const hasChildren = node.children.length > 0;

        return (
          <li key={node.path}>
            <div>
              {hasChildren ? (
                <button
                  className="resource-folder-tree__toggle"
                  type="button"
                  aria-label={node.name}
                  aria-expanded={expanded}
                  onClick={() => onToggleFolder(node.path)}
                >
                  {expanded ? (
                    <CaretDown aria-hidden="true" weight="bold" />
                  ) : (
                    <CaretRight aria-hidden="true" weight="bold" />
                  )}
                </button>
              ) : (
                <span className="resource-folder-tree__spacer" aria-hidden="true" />
              )}
              <button
                className="resource-folder-tree__item"
                type="button"
                data-active={selectedFolder === node.path || undefined}
                onClick={() => onSelectFolder(node.path)}
              >
                <FolderSimple aria-hidden="true" weight="regular" />
                {node.name}
              </button>
            </div>
            {hasChildren && expanded ? (
              <SourceTree
                nodes={node.children}
                selectedFolder={selectedFolder}
                expandedFolders={expandedFolders}
                onSelectFolder={onSelectFolder}
                onToggleFolder={onToggleFolder}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ResourceTypeIcon({ type }: { type: ResourceType }) {
  const Icon = type === "script" ? FileCode : type === "preset" ? SlidersHorizontal : type === "expression" ? BracketsCurly : type === "startup" ? Lightning : FileText;
  return <Icon aria-hidden="true" weight="regular" />;
}

function ResourceRow({
  resource,
  labels,
  executing,
  selected,
  focused,
  tabIndex,
  rowRef,
  onSelect,
  onFocus,
  onUse,
  onFavorite,
  onContextMenu
}: {
  resource: IndexedResource;
  labels: ReturnType<typeof useLanguage>["copy"]["resources"];
  executing: boolean;
  selected: boolean;
  focused: boolean;
  tabIndex: 0 | -1;
  rowRef: (element: HTMLElement | null) => void;
  onSelect: () => void;
  onFocus: () => void;
  onUse: () => void;
  onFavorite: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  return (
    <article
      className="resource-list-row"
      data-resource-type={resource.resourceType}
      data-selected={selected || undefined}
      data-focused={focused || undefined}
      role="option"
      tabIndex={tabIndex}
      aria-label={resource.name}
      aria-selected={selected}
      aria-busy={executing || undefined}
      ref={rowRef}
      onClick={(event) => {
        onSelect();
        event.currentTarget.focus();
      }}
      onFocus={onFocus}
      onDoubleClick={() => {
        onSelect();
        onUse();
      }}
      onContextMenu={onContextMenu}
    >
      <ResourceTypeIcon type={resource.resourceType} />
      <div className="resource-list-row__copy">
        <strong>{resource.name}</strong>
      </div>
      <div className="resource-list-row__actions">
        <button
          type="button"
          aria-label={labels.favorite}
          title={labels.favorite}
          data-active={resource.favorite || undefined}
          onClick={(event) => { event.stopPropagation(); onFavorite(); }}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Heart aria-hidden="true" weight={resource.favorite ? "fill" : "regular"} />
        </button>
        {executing ? <span className="resource-list-row__loading" aria-label={labels.useSuccess}>…</span> : null}
      </div>
    </article>
  );
}

export function ResourcesPage() {
  const { copy } = useLanguage();
  const labels = copy.resources;
  const {
    hostStatus,
    sources,
    resources,
    getResourceCommands,
    runResourceCommand,
    toggleFavorite
  } = useResources();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [resourceType, setResourceType] = useState<ResourceFilterType>("all");
  const [sourceId, setSourceId] = useState<SourceFilter>("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [executingIds, setExecutingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [menu, setMenu] = useState<{
    resourceId: string;
    anchor: ResourceMenuAnchor;
    restoreFocusTo: HTMLElement | null;
  } | null>(null);
  const [info, setInfo] = useState<ResourceInfo | null>(null);
  const [selection, setSelection] = useState<ResourceSelectionState>({
    selectedResourceId: null,
    focusedResourceId: null
  });
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const searchRef = useRef<HTMLInputElement>(null);
  const previousResourcesRef = useRef(resources);
  const previousVisibleIdsRef = useRef<readonly string[]>([]);
  const sourceOptions = useMemo<readonly SettingSelectOption<string>[]>(
    () => [
      { value: "all", label: labels.allSources },
      { value: "favorites", label: labels.favorite },
      ...sources.map((source) => ({ value: source.id, label: source.name }))
    ],
    [labels.allSources, sources]
  );
  const filteredResources = useMemo(() => {
    const indexed = filterIndexedResources(
      {
        schemaVersion: 1,
        customSources: [],
        index: { resources, sourceStates: [] }
      },
      query,
      resourceType,
      sourceId === "all" || sourceId === "favorites" ? undefined : sourceId
    );

    const next = indexed.filter((resource) => sourceId !== "favorites" || resource.favorite);
    return selectedFolder
      ? next.filter((resource) =>
          resource.relativePath.toLocaleLowerCase().startsWith(`${selectedFolder}/`)
        )
      : next;
  }, [query, resourceType, resources, selectedFolder, sourceId]);
  const folderTree = useMemo(
    () => buildResourceFolderTree(filteredResources),
    [filteredResources]
  );
  const listResources = filteredResources;
  const visibleResourceIds = useMemo(
    () => listResources.map((resource) => resource.id),
    [listResources]
  );

  useEffect(() => {
    setSelection((current) =>
      previousResourcesRef.current === resources
        ? reconcileFilteredSelection(current, visibleResourceIds)
        : reconcileRefreshedSelection(
            current,
            previousVisibleIdsRef.current,
            visibleResourceIds
          )
    );
    previousResourcesRef.current = resources;
    previousVisibleIdsRef.current = visibleResourceIds;
  }, [resources, visibleResourceIds]);

  async function handleCommand(
    commandId: ResourceCommandId,
    resource: IndexedResource
  ) {
    if (executingIds.has(resource.id)) return;
    setExecutingIds((current) => new Set(current).add(resource.id));
    try {
      const result = await runResourceCommand(commandId, resource.id);
      if (result.ok) {
        if (commandId === "resource.use") {
          if (
            resource.resourceType === "preset" &&
            result.affectedItems !== undefined
          ) {
            toast.success(
              `${labels.presetApplied}: ${result.affectedItems} — ${resource.name}`
            );
          } else if (
            resource.resourceType === "expression" &&
            result.affectedItems !== undefined
          ) {
            toast.success(
              `${labels.expressionApplied}: ${result.affectedItems} — ${resource.name}`
            );
          } else {
            toast.success(`${labels.useSuccess}: ${resource.name}`);
          }
        } else if (commandId === "resource.favorite.toggle") {
          toast.success(
            resource.favorite ? labels.unfavoriteSuccess : labels.favoriteSuccess
          );
        } else if (commandId === "resource.path.copy") {
          toast.success(labels.copySuccess);
        } else if (commandId === "resource.file.reveal") {
          toast.success(labels.revealSuccess);
        } else if (commandId === "resource.file.open-default") {
          toast.success(labels.openSuccess);
        } else if (commandId === "resource.source.refresh") {
          toast.success(labels.refreshSuccess);
        } else if (commandId === "resource.info.view" && result.info) {
          setInfo(result.info);
        }
      } else {
        toast.error(labels.commandFailures[result.reason]);
      }
    } finally {
      setExecutingIds((current) => {
        const next = new Set(current);
        next.delete(resource.id);
        return next;
      });
    }
  }

  function handleUse(resource: IndexedResource) {
    void handleCommand("resource.use", resource);
  }

  function openResourceMenu(
    resource: IndexedResource,
    anchor: ResourceMenuAnchor,
    restoreFocusTo: HTMLElement | null
  ) {
    selectResource(resource.id);
    setMenu({ resourceId: resource.id, anchor, restoreFocusTo });
  }

  function closeResourceMenu() {
    setMenu(null);
  }

  function menuItemsFor(resourceId: string) {
    return getResourceCommands(resourceId);
  }

  const menuResource = menu
    ? resources.find((resource) => resource.id === menu.resourceId) ?? null
    : null;
  const menuItems = menuResource ? menuItemsFor(menuResource.id) : [];

  function selectResource(resourceId: string) {
    setSelection({
      selectedResourceId: resourceId,
      focusedResourceId: resourceId
    });
  }

  function focusSelection(next: ResourceSelectionState) {
    const targetId = next.focusedResourceId;
    if (!targetId) return;
    const row = rowRefs.current.get(targetId);
    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, select, [role='menu']")) {
      return;
    }

    if (event.ctrlKey && event.key.toLocaleLowerCase() === "f") {
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
      return;
    }

    if (
      event.key === "ContextMenu" ||
      (event.key === "F10" && event.shiftKey)
    ) {
      event.preventDefault();
      const resource = listResources.find(
        (candidate) => candidate.id === selection.selectedResourceId
      );
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (resource && target) {
        openResourceMenu(
          resource,
          { kind: "element", element: target },
          target
        );
      }
      return;
    }

    let direction: "previous" | "next" | "first" | "last" | null = null;
    if (event.key === "ArrowDown" || event.code === "Numpad2") direction = "next";
    else if (event.key === "ArrowUp" || event.code === "Numpad8") direction = "previous";
    else if (event.key === "Home") direction = "first";
    else if (event.key === "End") direction = "last";

    if (direction) {
      event.preventDefault();
      const next = moveResourceSelection(
        selection,
        visibleResourceIds,
        direction
      );
      setSelection(next);
      focusSelection(next);
      return;
    }

    if (event.key === "Enter" || event.code === "NumpadEnter") {
      const resource = listResources.find(
        (candidate) => candidate.id === selection.selectedResourceId
      );
      if (resource) {
        event.preventDefault();
        void handleUse(resource);
      }
    }
  }

  function toggleFolder(path: string) {
    setExpandedFolders((current) =>
      current.includes(path)
        ? current.filter((candidate) => candidate !== path)
        : [...current, path]
    );
  }

  return (
    <>
      <main className="resources-page">
      <header className="resources-page__header">
        <div>
          <Archive aria-hidden="true" weight="regular" />
          <h1>{labels.title}</h1>
        </div>
        <strong className="resources-page__count">{labels.indexStatus}: {resources.length}</strong>
        {hostStatus !== "connected" ? <span>{labels.cachedIndex}</span> : null}
      </header>

      <div className="resource-browser">
        <aside className="resource-browser__navigation" aria-label={labels.categories}>
          <div className="resource-browser__source-control">
            <span>{labels.sources}</span>
            <div className="resource-source-filter">
              <SettingSelect
                ariaLabel={labels.sourceFilterAria}
                value={sourceId}
                options={sourceOptions}
                onChange={(nextSourceId) => {
                setSourceId(nextSourceId);
                setSelectedFolder(null);
              }}
              />
              <button className="resource-favorites-toggle" type="button" aria-label={labels.favorite} aria-pressed={sourceId === "favorites"} data-active={sourceId === "favorites" || undefined} onClick={() => setSourceId((current) => current === "favorites" ? "all" : "favorites")}><Heart aria-hidden="true" weight={sourceId === "favorites" ? "fill" : "regular"} /></button>
            </div>
          </div>
          <div className="resource-browser__categories">
            <span>{labels.categories}</span>
            <SourceTree
              nodes={folderTree}
              selectedFolder={selectedFolder}
              expandedFolders={expandedFolders}
              onSelectFolder={setSelectedFolder}
              onToggleFolder={toggleFolder}
            />
          </div>
        </aside>

        <section className="resource-browser__content">
          <div className="resource-browser__filters">
            <label className="resource-search">
              <MagnifyingGlass aria-hidden="true" weight="regular" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={labels.searchPlaceholder}
                aria-label={labels.searchAria}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="resource-type-filters" aria-label={labels.typeFilterAria}>
              {(["all", "script", "panel", "startup", "preset", "expression"] as const).map(
                (type) => (
                  <button
                    type="button"
                    key={type}
                    data-active={resourceType === type || undefined}
                    aria-pressed={resourceType === type}
                    onClick={() => setResourceType(type)}
                  >
                    {type === "all" ? labels.allTypes : labels.typeLabels[type]}
                  </button>
                )
              )}
            </div>
          </div>

          {selectedFolder ? (
            <button
              className="resource-browser__breadcrumb"
              type="button"
              onClick={() => setSelectedFolder(null)}
            >
              {labels.categories} / {displayResourcePath(selectedFolder)}
            </button>
          ) : null}

          {filteredResources.length === 0 ? (
            <p className="resource-browser__empty">{labels.noResults}</p>
          ) : (
            <>
              {listResources.length > 0 ? (
                <div
                  className="resource-list"
                  role="listbox"
                  aria-label={labels.title}
                  onKeyDown={handleListKeyDown}
                >
                  {listResources.map((resource, index) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      labels={labels}
                      executing={executingIds.has(resource.id)}
                      selected={selection.selectedResourceId === resource.id}
                      focused={selection.focusedResourceId === resource.id}
                      tabIndex={
                        selection.selectedResourceId === resource.id ||
                        (!selection.selectedResourceId && index === 0)
                          ? 0
                          : -1
                      }
                      rowRef={(element) => {
                        if (element) rowRefs.current.set(resource.id, element);
                        else rowRefs.current.delete(resource.id);
                      }}
                      onSelect={() => selectResource(resource.id)}
                      onFocus={() => selectResource(resource.id)}
                      onUse={() => handleUse(resource)}
                      onFavorite={() => toggleFavorite(resource.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openResourceMenu(
                          resource,
                          {
                            kind: "point",
                            x: event.clientX,
                            y: event.clientY
                          },
                          event.currentTarget
                        );
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
      </main>
      <ResourceContextMenu
        open={Boolean(menu && menuResource)}
        ariaLabel={labels.commandMenuAria}
        anchor={menu?.anchor ?? null}
        restoreFocusTo={menu?.restoreFocusTo ?? null}
        items={menuItems}
        getLabel={(item) => labels.commandLabels[item.labelKey]}
        getDisabledReason={(reason: ResourceCommandFailureReason) =>
          labels.commandFailures[reason]
        }
        onSelect={(commandId) => {
          if (menuResource) {
            void handleCommand(commandId, menuResource);
          }
          closeResourceMenu();
        }}
        onClose={closeResourceMenu}
      />
      {info ? (
        <AppDialog
          title={labels.infoTitle}
          primaryAction={{
            label: labels.closeInfo,
            onClick: () => setInfo(null)
          }}
          onClose={() => setInfo(null)}
        >
          <dl className="resource-info-list">
            <div><dt>{labels.infoName}</dt><dd>{info.name}</dd></div>
            <div><dt>{labels.infoType}</dt><dd>{labels.typeLabels[info.resourceType]}</dd></div>
            <div><dt>{labels.infoSource}</dt><dd>{info.sourceName}</dd></div>
            <div><dt>{labels.infoPath}</dt><dd>{info.absolutePath}</dd></div>
            <div><dt>{labels.infoModified}</dt><dd>{info.modifiedAt ?? labels.infoUnknownDate}</dd></div>
            <div>
              <dt>{labels.infoFavorite}</dt>
              <dd>{info.favorite ? labels.infoFavoriteYes : labels.infoFavoriteNo}</dd>
            </div>
          </dl>
        </AppDialog>
      ) : null}
    </>
  );
}
