import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  DotsThree,
  FolderOpen,
  PencilSimple,
  Plus,
  Power,
  Trash
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  CompactActionMenu,
  type CompactActionMenuItem
} from "../components/CompactActionMenu";
import {
  SettingSelect,
  type SettingSelectOption
} from "../components/SettingSelect";
import { TextInputDialog } from "../components/TextInputDialog";
import { useLanguage } from "../i18n/LanguageProvider";
import { useResources } from "../resources/ResourceProvider";
import type { CustomResourceType, ResourceSource } from "../resources/types";

type SourceDialog =
  | { mode: "add" }
  | { mode: "edit"; source: ResourceSource }
  | null;

export function ResourceSettingsPanel() {
  const { copy } = useLanguage();
  const labels = copy.settings.resources;
  const {
    hostStatus,
    sources,
    refreshingSourceIds,
    refreshAllSources,
    refreshSource,
    chooseDirectory,
    addCustomSource,
    updateCustomSource,
    removeCustomSource
  } = useResources();
  const [sourceType, setSourceType] = useState<CustomResourceType>("script");
  const [expandedSourceIds, setExpandedSourceIds] = useState<string[]>([]);
  const [menuSourceId, setMenuSourceId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SourceDialog>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPath, setDraftPath] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [directoryMessage, setDirectoryMessage] = useState<string | null>(null);

  const typeOptions: readonly SettingSelectOption<CustomResourceType>[] = useMemo(
    () => [
      { value: "script", label: labels.sourceTypes.script },
      { value: "preset", label: labels.sourceTypes.preset },
      { value: "expression", label: labels.sourceTypes.expression }
    ],
    [labels.sourceTypes]
  );
  const currentAeSources = sources.filter((source) => source.kind === "ae-default");
  const customSources = sources.filter((source) => source.kind === "custom");
  const isRefreshing = refreshingSourceIds.length > 0;

  function toggleSourceExpansion(sourceId: string) {
    setExpandedSourceIds((current) =>
      current.includes(sourceId)
        ? current.filter((candidate) => candidate !== sourceId)
        : [...current, sourceId]
    );
  }

  function openAddDialog() {
    setDraftName("");
    setDraftPath("");
    setDraftError(null);
    setDirectoryMessage(null);
    setDialog({ mode: "add" });
  }

  function openEditDialog(source: ResourceSource) {
    setDraftName(source.name);
    setDraftPath(source.path);
    setDraftError(null);
    setDirectoryMessage(null);
    setDialog({ mode: "edit", source });
  }

  async function requestDirectory() {
    const result = await chooseDirectory();

    if (result.status === "selected" && result.path) {
      setDraftPath(result.path);
      setDirectoryMessage(null);
      return;
    }

    if (result.status === "unavailable") {
      setDirectoryMessage(labels.directoryUnavailable);
    }
  }

  function saveSource() {
    if (!dialog) {
      return;
    }

    if (!draftName.trim()) {
      setDraftError(labels.sourceNameRequired);
      return;
    }

    if (!draftPath) {
      setDirectoryMessage(labels.directoryNotSelected);
      return;
    }

    if (dialog.mode === "add") {
      addCustomSource({ name: draftName, path: draftPath, resourceType: sourceType });
    } else {
      updateCustomSource(dialog.source.id, { name: draftName, path: draftPath });
    }

    setDialog(null);
  }

  function sourceActions(source: ResourceSource): readonly CompactActionMenuItem[] {
    const shared: CompactActionMenuItem[] = [
      {
        id: "refresh",
        label: labels.refreshSource,
        icon: ArrowsClockwise,
        disabled: refreshingSourceIds.includes(source.id),
        onSelect: () => void refreshSource(source.id)
      }
    ];

    if (source.kind === "ae-default") {
      return shared;
    }

    return [
      ...shared,
      {
        id: "edit",
        label: labels.editSourceTitle,
        icon: PencilSimple,
        onSelect: () => openEditDialog(source)
      },
      {
        id: "enabled",
        label: source.enabled ? labels.disableSource : labels.enableSource,
        icon: Power,
        onSelect: () => updateCustomSource(source.id, { enabled: !source.enabled })
      },
      {
        id: "remove",
        label: labels.removeSource,
        icon: Trash,
        danger: true,
        onSelect: () => removeCustomSource(source.id)
      }
    ];
  }

  function renderSource(source: ResourceSource) {
    const expanded = expandedSourceIds.includes(source.id);

    return (
      <article
        className="resource-source-row"
        data-status={source.status}
        data-source-kind={source.kind}
        key={source.id}
      >
        <button
          className="resource-source-row__summary"
          type="button"
          aria-expanded={expanded}
          onClick={() => toggleSourceExpansion(source.id)}
        >
          {expanded ? (
            <CaretDown aria-hidden="true" weight="bold" />
          ) : (
            <CaretRight aria-hidden="true" weight="bold" />
          )}
          <span className="resource-source-row__name">{source.name}</span>
        </button>
        <div className="resource-source-row__actions">
          <button
            className="resource-source-row__menu-button"
            type="button"
            aria-label={labels.sourceActions}
            title={labels.sourceActions}
            onClick={() =>
              setMenuSourceId((current) => (current === source.id ? null : source.id))
            }
          >
            <DotsThree aria-hidden="true" weight="bold" />
          </button>
          <CompactActionMenu
            ariaLabel={labels.sourceActions}
            open={menuSourceId === source.id}
            items={sourceActions(source)}
            onClose={() => setMenuSourceId(null)}
          />
        </div>
        {expanded ? (
          <dl className="resource-source-row__details">
            <div>
              <dt>{labels.sourcePath}</dt>
              <dd title={source.path}>{source.path}</dd>
            </div>
          </dl>
        ) : null}
      </article>
    );
  }

  return (
    <div className="resource-settings">
      <header className="resource-settings__header">
        <div>
          <h2>{copy.settings.tabs.resources}</h2>
          {hostStatus !== "connected" ? (
            <p role="status">
              {hostStatus === "error" ? labels.hostError : labels.hostUnavailable}
            </p>
          ) : null}
        </div>
        <button
          className="resource-settings__refresh-button"
          type="button"
          disabled={isRefreshing}
          onClick={() => void refreshAllSources()}
        >
          <ArrowsClockwise aria-hidden="true" weight="bold" />
          {isRefreshing ? labels.updatingIndex : labels.updateIndex}
        </button>
      </header>

      <section className="resource-settings__section" aria-labelledby="current-ae-sources">
        <div className="resource-settings__section-heading">
          <FolderOpen aria-hidden="true" weight="regular" />
          <h3 id="current-ae-sources">{labels.currentAeSources}</h3>
        </div>
        <div className="resource-settings__source-list">
          {currentAeSources.map(renderSource)}
        </div>
      </section>

      <section className="resource-settings__section" aria-labelledby="custom-resource-sources">
        <div className="resource-settings__section-heading resource-settings__section-heading--actions">
          <div>
            <FolderOpen aria-hidden="true" weight="regular" />
            <h3 id="custom-resource-sources">{labels.mySources}</h3>
          </div>
          <div className="resource-settings__add-controls">
            <SettingSelect
              ariaLabel={labels.sourceType}
              value={sourceType}
              options={typeOptions}
              onChange={setSourceType}
            />
            <button type="button" onClick={openAddDialog}>
              <Plus aria-hidden="true" weight="bold" />
              {labels.addSource}
            </button>
          </div>
        </div>
        <div className="resource-settings__source-list">
          {customSources.map(renderSource)}
        </div>
      </section>

      {dialog ? (
        <TextInputDialog
          title={dialog.mode === "add" ? labels.newSourceTitle : labels.editSourceTitle}
          value={draftName}
          placeholder={labels.sourceNamePlaceholder}
          maxLength={48}
          error={draftError}
          confirmLabel={dialog.mode === "add" ? labels.addAction : labels.saveAction}
          cancelLabel={labels.cancelAction}
          onValueChange={(value) => {
            setDraftName(value);
            setDraftError(null);
          }}
          onConfirm={saveSource}
          onCancel={() => setDialog(null)}
        >
          <div className="resource-directory-picker">
            <span>{draftPath || labels.directoryNotSelected}</span>
            <button type="button" onClick={() => void requestDirectory()}>
              <FolderOpen aria-hidden="true" weight="regular" />
              {labels.chooseDirectory}
            </button>
          </div>
          {directoryMessage ? (
            <span className="nyaworks-field-error" role="status">
              {directoryMessage}
            </span>
          ) : null}
        </TextInputDialog>
      ) : null}
    </div>
  );
}
