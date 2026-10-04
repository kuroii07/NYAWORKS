import {
  Archive,
  BracketsCurly,
  CaretDown,
  CaretRight,
  Clock,
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
import {
  ResourceContextMenu,
  type ResourceMenuAnchor
} from "../components/ResourceContextMenu";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  buildResourceFolderTree,
  displayResourcePath,
  filterIndexedResources,
  sortIndexedResources,
  type ResourceSortMode,
  type ResourceTypeFilter
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
} from "../resources/resourceCommands";
import { useResources } from "../resources/ResourceProvider";
import { useToast } from "../notifications/ToastProvider";
import type { IndexedResource, ResourceFolderNode, ResourceType } from "../resources/types";

type ResourceFilterType = ResourceTypeFilter;
type SourceFilter = "all" | string;
type ResourceViewFilter = "all" | "favorites" | "recent";
type ResourceSourceTreeGroup = {
  sourceId: string;
  sourceName: string;
  nodes: readonly ResourceFolderNode[];
};

function SourceTree({
  groups,
  selectedSourceId,
  selectedFolder,
  expandedFolders,
  labels,
  onSelectSource,
  onSelectFolder,
  onToggleFolder
}: {
  groups: readonly ResourceSourceTreeGroup[];
  selectedSourceId: SourceFilter;
  selectedFolder: string | null;
  expandedFolders: readonly string[];
  labels: ReturnType<typeof useLanguage>["copy"]["resources"];
  onSelectSource: (sourceId: SourceFilter) => void;
  onSelectFolder: (sourceId: string, path: string) => void;
  onToggleFolder: (path: string) => void;
}) {
  function renderFolderNode(node: ResourceFolderNode, sourceId: string) {
    const expansionKey = `${sourceId}:${node.path}`;
    const expanded = expandedFolders.includes(expansionKey);
    const hasChildren = node.children.length > 0;

    return (
      <li key={expansionKey}>
        <div>
          {hasChildren ? (
            <button
              className="resource-folder-tree__toggle"
              type="button"
              aria-label={node.name}
              aria-expanded={expanded}
              onClick={() => onToggleFolder(expansionKey)}
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
            data-active={
              selectedSourceId === sourceId &&
              selectedFolder === node.path
                ? true
                : undefined
            }
            onClick={() => onSelectFolder(sourceId, node.path)}
          >
            <FolderSimple aria-hidden="true" weight="regular" />
            {node.name}
          </button>
        </div>
        {hasChildren && expanded ? (
          <ul>
            {node.children.map((child) => renderFolderNode(child, sourceId))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <ul className="resource-folder-tree">
      <li>
        <button
          className="resource-folder-tree__all"
          type="button"
          data-active={
            selectedSourceId === "all" && selectedFolder === null
              ? true
              : undefined
          }
          onClick={() => onSelectSource("all")}
        >
          <Archive aria-hidden="true" weight="regular" />
          {labels.allSources}
        </button>
      </li>
      {groups.map((group) => {
        const expansionKey = `source:${group.sourceId}`;
        const expanded = expandedFolders.includes(expansionKey);
        const hasChildren = group.nodes.length > 0;

        return (
          <li className="resource-folder-tree__source" key={group.sourceId}>
            <div className="resource-folder-tree__source-row">
              {hasChildren ? (
                <button
                  className="resource-folder-tree__toggle resource-folder-tree__source-toggle"
                  type="button"
                  aria-label={group.sourceName}
                  aria-expanded={expanded}
                  onClick={() => onToggleFolder(expansionKey)}
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
                className="resource-folder-tree__source-item"
                type="button"
                data-active={
                  selectedSourceId === group.sourceId && selectedFolder === null
                    ? true
                    : undefined
                }
                onClick={() => onSelectSource(group.sourceId)}
              >
                <FolderSimple aria-hidden="true" weight="regular" />
                {group.sourceName}
              </button>
            </div>
            {hasChildren && expanded ? (
              <ul>
                {group.nodes.map((node) => renderFolderNode(node, group.sourceId))}
              </ul>
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
  const [viewFilter, setViewFilter] = useState<ResourceViewFilter>("all");
  const [sortMode, setSortMode] = useState<ResourceSortMode>("name");
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
  const [selection, setSelection] = useState<ResourceSelectionState>({
    selectedResourceId: null,
    focusedResourceId: null
  });
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const searchRef = useRef<HTMLInputElement>(null);
  const previousResourcesRef = useRef(resources);
  const previousVisibleIdsRef = useRef<readonly string[]>([]);
  const sortOptions = useMemo<readonly SettingSelectOption<ResourceSortMode>[]>(
    () => [
      { value: "name", label: labels.sortByName },
      { value: "recent", label: labels.sortByRecent },
      { value: "favorite", label: labels.sortByFavorite }
    ],
    [labels.sortByFavorite, labels.sortByName, labels.sortByRecent]
  );
  const navigationResources = useMemo(() => {
    const indexed = filterIndexedResources(
      {
        schemaVersion: 1,
        customSources: [],
        index: { resources, sourceStates: [] }
      },
      "",
      resourceType
    );

    return indexed.filter(
      (resource) =>
        viewFilter === "all" ||
        (viewFilter === "favorites" ? resource.favorite : Boolean(resource.lastUsedAt))
    );
  }, [resourceType, resources, sourceId, viewFilter]);
  const filteredResources = useMemo(() => {
    const indexed = filterIndexedResources(
      {
        schemaVersion: 1,
        customSources: [],
        index: { resources, sourceStates: [] }
      },
      query,
      resourceType,
      sourceId === "all" ? undefined : sourceId
    );

    const next = indexed.filter(
      (resource) =>
        viewFilter === "all" ||
        (viewFilter === "favorites" ? resource.favorite : Boolean(resource.lastUsedAt))
    );
    const folderFiltered = selectedFolder
      ? next.filter((resource) =>
          resource.relativePath.toLocaleLowerCase().startsWith(`${selectedFolder}/`)
        )
      : next;
    return sortIndexedResources(folderFiltered, sortMode);
  }, [query, resourceType, resources, selectedFolder, sortMode, sourceId, viewFilter]);
  const sourceTreeGroups = useMemo<readonly ResourceSourceTreeGroup[]>(
    () =>
      sources
        .map((source) => {
          const sourceResources = navigationResources.filter(
            (resource) => resource.sourceId === source.id
          );
          return {
            sourceId: source.id,
            sourceName: source.name,
            nodes: buildResourceFolderTree(sourceResources),
            hasResources: sourceResources.length > 0
          };
        })
        .filter((group) => group.hasResources)
        .map(({ hasResources: _hasResources, ...group }) => group),
    [navigationResources, sources]
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

  function changeViewFilter(nextFilter: ResourceViewFilter) {
    setViewFilter(nextFilter);
    setSelectedFolder(null);
  }

  function selectSource(nextSourceId: SourceFilter) {
    setSourceId(nextSourceId);
    setSelectedFolder(null);
  }

  function selectFolder(nextSourceId: string, path: string) {
    setSourceId(nextSourceId);
    setSelectedFolder(path);
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
          </div>
          <div className="resource-browser__categories">
            <SourceTree
              groups={sourceTreeGroups}
              selectedSourceId={sourceId}
              selectedFolder={selectedFolder}
              expandedFolders={expandedFolders}
              labels={labels}
              onSelectSource={selectSource}
              onSelectFolder={selectFolder}
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
            <div className="resource-view-filter">
              <button
                className="resource-view-toggle resource-all-toggle"
                type="button"
                aria-label={labels.allResources}
                title={labels.allResources}
                aria-pressed={viewFilter === "all"}
                data-active={viewFilter === "all" || undefined}
                onClick={() => changeViewFilter("all")}
              >
                <Archive aria-hidden="true" weight="regular" />
              </button>
              <button
                className="resource-view-toggle resource-favorites-toggle"
                type="button"
                aria-label={labels.favorite}
                title={labels.favorite}
                aria-pressed={viewFilter === "favorites"}
                data-active={viewFilter === "favorites" || undefined}
                onClick={() =>
                  changeViewFilter(viewFilter === "favorites" ? "all" : "favorites")
                }
              >
                <Heart aria-hidden="true" weight={viewFilter === "favorites" ? "fill" : "regular"} />
              </button>
              <button
                className="resource-view-toggle resource-recent-toggle"
                type="button"
                aria-label={labels.recent}
                title={labels.recent}
                aria-pressed={viewFilter === "recent"}
                data-active={viewFilter === "recent" || undefined}
                onClick={() =>
                  changeViewFilter(viewFilter === "recent" ? "all" : "recent")
                }
              >
                <Clock aria-hidden="true" weight="regular" />
              </button>
            </div>
            <div className="resource-type-filters" aria-label={labels.typeFilterAria}>
              {(["all", "script", "preset", "expression"] as const).map(
                (type) => (
                  <button
                    type="button"
                    key={type}
                    data-active={resourceType === type || undefined}
                    aria-pressed={resourceType === type}
                    onClick={() => {
                      setResourceType(type);
                      setSelectedFolder(null);
                    }}
                  >
                    {type === "all" ? labels.allTypes : labels.typeLabels[type]}
                  </button>
                )
              )}
            </div>
            <SettingSelect
              className="resource-sort-select"
              ariaLabel={labels.sortAria}
              value={sortMode}
              options={sortOptions}
              onChange={setSortMode}
            />
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
    </>
  );
}
