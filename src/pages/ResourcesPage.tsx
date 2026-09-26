import {
  Archive,
  ArrowClockwise,
  CaretDown,
  CaretRight,
  Copy,
  File,
  FolderSimple,
  Heart,
  MagnifyingGlass
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  SettingSelect,
  type SettingSelectOption
} from "../components/SettingSelect";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  buildResourceFolderTree,
  filterIndexedResources
} from "../resources/resourceOperations";
import { useResources } from "../resources/ResourceProvider";
import type { IndexedResource, ResourceFolderNode, ResourceType } from "../resources/types";

type ResourceFilterType = "all" | ResourceType;

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

function ResourceRow({
  resource,
  isRefreshing,
  labels,
  onFavorite,
  onRefresh
}: {
  resource: IndexedResource;
  isRefreshing: boolean;
  labels: ReturnType<typeof useLanguage>["copy"]["resources"];
  onFavorite: () => void;
  onRefresh: () => void;
}) {
  return (
    <article className="resource-list-row" data-resource-type={resource.resourceType}>
      <File aria-hidden="true" weight="regular" />
      <div className="resource-list-row__copy">
        <strong>{resource.name}</strong>
        <span>{resource.relativePath}</span>
      </div>
      <div className="resource-list-row__actions">
        <button
          type="button"
          aria-label={labels.favorite}
          title={labels.favorite}
          data-active={resource.favorite || undefined}
          onClick={onFavorite}
        >
          <Heart aria-hidden="true" weight={resource.favorite ? "fill" : "regular"} />
        </button>
        <button type="button" disabled title={labels.hostActionUnavailable}>
          <Copy aria-hidden="true" weight="regular" />
          {labels.copyPath}
        </button>
        <button type="button" disabled title={labels.hostActionUnavailable}>
          <FolderSimple aria-hidden="true" weight="regular" />
          {labels.revealSource}
        </button>
        <button
          type="button"
          disabled={isRefreshing}
          title={labels.refreshSource}
          onClick={onRefresh}
        >
          <ArrowClockwise aria-hidden="true" weight="regular" />
        </button>
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
    refreshingSourceIds,
    refreshSource,
    toggleFavorite
  } = useResources();
  const [query, setQuery] = useState("");
  const [resourceType, setResourceType] = useState<ResourceFilterType>("all");
  const [sourceId, setSourceId] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const sourceOptions = useMemo<readonly SettingSelectOption<string>[]>(
    () => [
      { value: "all", label: labels.allSources },
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
      sourceId === "all" ? undefined : sourceId
    );

    return selectedFolder
      ? indexed.filter((resource) =>
          resource.relativePath.toLocaleLowerCase().startsWith(`${selectedFolder}/`)
        )
      : indexed;
  }, [query, resourceType, resources, selectedFolder, sourceId]);
  const folderTree = useMemo(
    () => buildResourceFolderTree(filteredResources),
    [filteredResources]
  );
  const previewResources = filteredResources.filter(
    (resource) => resource.preview.coverUri
  );
  const listResources = filteredResources.filter(
    (resource) => !resource.preview.coverUri
  );

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
          <div>
            <h1>{labels.title}</h1>
            <p>
              {labels.indexStatus} · {resources.length}
            </p>
          </div>
        </div>
        {hostStatus !== "connected" ? <span>{labels.cachedIndex}</span> : null}
      </header>

      <div className="resource-browser">
        <aside className="resource-browser__navigation" aria-label={labels.categories}>
          <div className="resource-browser__source-control">
            <span>{labels.sources}</span>
            <SettingSelect
              ariaLabel={labels.sourceFilterAria}
              value={sourceId}
              options={sourceOptions}
              onChange={(nextSourceId) => {
                setSourceId(nextSourceId);
                setSelectedFolder(null);
              }}
            />
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
              {labels.categories} / {selectedFolder}
            </button>
          ) : null}

          {filteredResources.length === 0 ? (
            <p className="resource-browser__empty">{labels.noResults}</p>
          ) : (
            <>
              {previewResources.length > 0 ? (
                <div className="resource-preview-grid">
                  {previewResources.map((resource) => (
                    <article className="resource-preview-card" key={resource.id}>
                      <img src={resource.preview.coverUri ?? undefined} alt="" />
                      <strong>{resource.name}</strong>
                      <span>{resource.relativePath}</span>
                    </article>
                  ))}
                </div>
              ) : null}
              {listResources.length > 0 ? (
                <div className="resource-list">
                  {listResources.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      labels={labels}
                      isRefreshing={refreshingSourceIds.includes(resource.sourceId)}
                      onFavorite={() => toggleFavorite(resource.id)}
                      onRefresh={() => void refreshSource(resource.sourceId)}
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
