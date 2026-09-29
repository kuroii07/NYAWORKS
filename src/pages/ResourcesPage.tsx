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
import { useMemo, useState } from "react";
import {
  SettingSelect,
  type SettingSelectOption
} from "../components/SettingSelect";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  buildResourceFolderTree,
  displayResourcePath,
  filterIndexedResources
} from "../resources/resourceOperations";
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

function ResourceRow({ resource, labels, executing, onUse, onFavorite }: {
  resource: IndexedResource;
  labels: ReturnType<typeof useLanguage>["copy"]["resources"];
  executing: boolean;
  onUse: () => void;
  onFavorite: () => void;
}) {
  return (
    <article className="resource-list-row" data-resource-type={resource.resourceType} role="button" tabIndex={0} aria-label={resource.name} aria-busy={executing || undefined} onDoubleClick={onUse} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onUse(); } }}>
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
    useResource,
    toggleFavorite
  } = useResources();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [resourceType, setResourceType] = useState<ResourceFilterType>("all");
  const [sourceId, setSourceId] = useState<SourceFilter>("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
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

  async function handleUse(resource: IndexedResource) {
    if (executingId) return;
    setExecutingId(resource.id);
    try {
      const result = await useResource(resource.id);
      if (result.ok) toast.success(`${labels.useSuccess}: ${resource.name}`);
      else toast.error(result.reason === "no-selected-layer" ? labels.noSelectedLayer : result.reason === "no-selected-property" ? labels.noSelectedProperty : result.reason === "empty-expression" ? labels.emptyExpression : result.reason === "invalid-resource" ? labels.invalidResource : result.reason === "unavailable" ? labels.hostActionUnavailable : labels.useFailed);
    } finally {
      setExecutingId(null);
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
                <div className="resource-list">
                  {listResources.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      labels={labels}
                      executing={executingId === resource.id}
                      onUse={() => void handleUse(resource)}
                      onFavorite={() => toggleFavorite(resource.id)}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
