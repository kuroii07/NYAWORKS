import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type DragEvent,
  type ReactNode
} from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  Check,
  CopySimple,
  DotsSixVertical,
  DotsThree,
  DownloadSimple,
  Eye,
  EyeSlash,
  GridFour,
  ListChecks,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple
} from "@phosphor-icons/react";
import { AppDialog } from "../components/AppDialog";
import {
  CompactActionMenu,
  type CompactActionMenuItem
} from "../components/CompactActionMenu";
import { IconPickerDialog } from "../components/IconPickerDialog";
import {
  SettingSelect,
  type SettingSelectOption
} from "../components/SettingSelect";
import { TextInputDialog } from "../components/TextInputDialog";
import {
  BUILT_IN_CREATIVE_LAYOUT_ID,
  BUILT_IN_HOME_LAYOUTS,
  HOME_GROUP_ICON_CATALOG,
  HOME_GROUP_SLOT_COUNT,
  HOME_TOOL_CATALOG,
  getHomeLayoutLabel
} from "../homeLayouts/catalog";
import {
  addLayoutGroup,
  createCustomLayout,
  deleteLayout,
  deleteLayoutGroup,
  duplicateLayoutGroup,
  moveLayoutGroup,
  moveToolSlot,
  renameLayout,
  setActiveLayout,
  setToolSlot,
  updateLayoutGroup
} from "../homeLayouts/layoutOperations";
import type { HomeGroupIconId } from "../homeLayouts/types";
import type { ToolId } from "../i18n/types";
import {
  createHomeLayoutPreset,
  parseHomeLayoutPreset
} from "../settings/homeLayoutPreset";
import { getActiveHomeLayout } from "../settings/homeSettingsStorage";
import { useSettings } from "../settings/SettingsProvider";
import type { HomeCreateMode, HomeSpaceMode } from "../settings/types";
import { useLanguage } from "../i18n/LanguageProvider";

type SettingIcon = ComponentType<IconProps>;
type NameDialog =
  | { kind: "createLayout"; source: "current" | "blank" }
  | { kind: "renameLayout"; layoutId: string }
  | { kind: "newGroup"; layoutId: string }
  | { kind: "renameGroup"; layoutId: string; groupId: string };

function makeLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

function SettingsSection({
  icon: Icon,
  title,
  action,
  children
}: {
  icon: SettingIcon;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="settings-section home-settings-section">
      <h2>
        <Icon aria-hidden="true" weight="regular" />
        <span>{title}</span>
        {action}
      </h2>
      <div className="settings-section__rows">{children}</div>
    </section>
  );
}

function SwitchControl({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="setting-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function HomeSettingsPanel({
  initialEditing = false
}: {
  initialEditing?: boolean;
}) {
  const { copy } = useLanguage();
  const { homeSettings, updateHomeSettings, resetHomeSettings } = useSettings();
  const labels = copy.settings.home;
  const activeLayout = getActiveHomeLayout(homeSettings);
  const activeLayoutName = getHomeLayoutLabel(activeLayout.name, copy);
  const isCustomLayout = activeLayout.kind === "custom";
  const allLayouts = [...BUILT_IN_HOME_LAYOUTS, ...homeSettings.customLayouts];
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(
    initialEditing ? activeLayout.groups[0]?.id ?? null : null
  );
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const [slotMenuKey, setSlotMenuKey] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [iconGroupId, setIconGroupId] = useState<string | null>(null);
  const [selectedIconId, setSelectedIconId] =
    useState<HomeGroupIconId>("folder");
  const [toolTarget, setToolTarget] = useState<{
    groupId: string;
    slotIndex: number;
  } | null>(null);
  const [toolSearch, setToolSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "layout"; id: string } | { kind: "group"; id: string } | null
  >(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [importStatus, setImportStatus] = useState<"success" | "error" | null>(
    null
  );
  const importInputRef = useRef<HTMLInputElement>(null);

  const layoutOptions = useMemo<
    readonly SettingSelectOption<string>[]
  >(
    () =>
      allLayouts.map((layout) => ({
        value: layout.id,
        label: getHomeLayoutLabel(layout.name, copy)
      })),
    [allLayouts, copy]
  );

  const visibleTools = useMemo(
    () =>
      Object.values(HOME_TOOL_CATALOG).filter((tool) =>
        copy.home.toolLabels[tool.id]
          .toLocaleLowerCase()
          .includes(toolSearch.trim().toLocaleLowerCase())
      ),
    [copy, toolSearch]
  );

  useEffect(() => {
    if (
      initialEditing &&
      activeLayout.id === BUILT_IN_CREATIVE_LAYOUT_ID &&
      !nameDialog
    ) {
      setNameValue(`${activeLayoutName} 2`);
      setNameDialog({ kind: "createLayout", source: "current" });
    }
  }, [activeLayout.id, activeLayoutName, initialEditing, nameDialog]);

  function validateLayoutName(value: string, excludedId?: string) {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized) {
      return labels.nameRequired;
    }

    const duplicate = allLayouts.some(
      (layout) =>
        layout.id !== excludedId &&
        getHomeLayoutLabel(layout.name, copy).trim().toLocaleLowerCase() ===
          normalized
    );
    return duplicate ? labels.nameDuplicate : null;
  }

  function openNameDialog(dialog: NameDialog, initialValue: string) {
    setNameValue(initialValue);
    setNameError(null);
    setNameDialog(dialog);
    setLayoutMenuOpen(false);
    setGroupMenuId(null);
  }

  function submitNameDialog() {
    if (!nameDialog) {
      return;
    }

    const excludedId =
      nameDialog.kind === "renameLayout" ? nameDialog.layoutId : undefined;
    const error =
      nameDialog.kind === "createLayout" ||
      nameDialog.kind === "renameLayout"
        ? validateLayoutName(nameValue, excludedId)
        : nameValue.trim()
          ? null
          : labels.nameRequired;

    if (error) {
      setNameError(error);
      return;
    }

    if (nameDialog.kind === "createLayout") {
      updateHomeSettings(
        createCustomLayout(homeSettings, {
          id: makeLocalId("layout"),
          name: nameValue,
          source: nameDialog.source,
          blankGroupId: makeLocalId("group"),
          blankGroupName: labels.defaultGroupName,
          now: new Date().toISOString()
        })
      );
      setIsEditing(true);
    } else if (nameDialog.kind === "renameLayout") {
      updateHomeSettings(
        renameLayout(homeSettings, nameDialog.layoutId, nameValue)
      );
    } else if (nameDialog.kind === "newGroup") {
      updateHomeSettings(
        addLayoutGroup(homeSettings, nameDialog.layoutId, {
          id: makeLocalId("group"),
          name: { kind: "custom", value: nameValue.trim().slice(0, 16) },
          iconId: "folder",
          visible: true,
          toolSlots: Array.from(
            { length: HOME_GROUP_SLOT_COUNT },
            () => null
          )
        })
      );
    } else {
      updateHomeSettings(
        updateLayoutGroup(
          homeSettings,
          nameDialog.layoutId,
          nameDialog.groupId,
          {
            name: { kind: "custom", value: nameValue.trim().slice(0, 16) }
          }
        )
      );
    }

    setNameDialog(null);
    setNameError(null);
  }

  function exportLayout() {
    const exportableLayout =
      activeLayout.name.kind === "custom"
        ? activeLayout
        : {
            ...activeLayout,
            name: { kind: "custom" as const, value: activeLayoutName }
          };
    const preset = createHomeLayoutPreset(exportableLayout);
    const blob = new Blob([JSON.stringify(preset, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NYAWORKS-${activeLayoutName}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importLayout(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = parseHomeLayoutPreset(await file.text(), {
        id: makeLocalId("layout"),
        now: new Date().toISOString(),
        existingNames: allLayouts.map((layout) =>
          getHomeLayoutLabel(layout.name, copy)
        )
      });
      updateHomeSettings({
        activeLayoutId: imported.id,
        customLayouts: [...homeSettings.customLayouts, imported]
      });
      setImportStatus("success");
      setIsEditing(true);
    } catch {
      setImportStatus("error");
    } finally {
      event.target.value = "";
    }
  }

  function updateActiveGroup(
    groupId: string,
    patch: Parameters<typeof updateLayoutGroup>[3]
  ) {
    if (!isCustomLayout) return;
    updateHomeSettings(
      updateLayoutGroup(homeSettings, activeLayout.id, groupId, patch)
    );
  }

  function moveGroupByOffset(groupId: string, offset: -1 | 1) {
    if (!isCustomLayout) return;
    const index = activeLayout.groups.findIndex((group) => group.id === groupId);
    const target = activeLayout.groups[index + offset];
    if (!target) return;
    updateHomeSettings(
      moveLayoutGroup(homeSettings, activeLayout.id, groupId, target.id)
    );
  }

  const layoutMenuItems: readonly CompactActionMenuItem[] = [
    {
      id: "copy",
      label: labels.copyLayout,
      icon: CopySimple,
      onSelect: () =>
        openNameDialog(
          { kind: "createLayout", source: "current" },
          `${activeLayoutName} 2`
        )
    },
    {
      id: "rename",
      label: labels.renameLayout,
      icon: PencilSimple,
      disabled: !isCustomLayout,
      onSelect: () =>
        openNameDialog(
          { kind: "renameLayout", layoutId: activeLayout.id },
          activeLayoutName
        )
    },
    {
      id: "delete",
      label: labels.deleteLayout,
      icon: Trash,
      disabled: !isCustomLayout,
      danger: true,
      onSelect: () =>
        setDeleteTarget({ kind: "layout", id: activeLayout.id })
    }
  ];

  return (
    <div className="settings-home">
      <SettingsSection icon={PencilSimple} title={labels.layoutSection}>
        <div className="home-layout-summary">
          <div>
            <strong>{labels.customLayout}</strong>
            <small>{labels.autoSaveNote}</small>
          </div>
          <button
            className="home-layout-edit-button"
            type="button"
            data-active={isEditing || undefined}
            onClick={() => {
              if (isEditing) {
                setIsEditing(false);
              } else if (isCustomLayout) {
                setIsEditing(true);
              } else {
                openNameDialog(
                  { kind: "createLayout", source: "current" },
                  `${activeLayoutName} 2`
                );
              }
            }}
          >
            {isEditing ? (
              <Check aria-hidden="true" weight="bold" />
            ) : (
              <PencilSimple aria-hidden="true" weight="bold" />
            )}
            {isEditing ? labels.finishEditing : labels.editLayout}
          </button>
        </div>

        <div
          className="home-layout-selector-row"
          onContextMenu={(event) => {
            event.preventDefault();
            setLayoutMenuOpen(true);
          }}
        >
          <span>{labels.currentLayout}</span>
          <div className="home-layout-selector-row__controls">
            <SettingSelect
              value={activeLayout.id}
              ariaLabel={labels.currentLayout}
              options={layoutOptions}
              onChange={(layoutId) => {
                updateHomeSettings(setActiveLayout(homeSettings, layoutId));
                setIsEditing(false);
                setExpandedGroupId(null);
              }}
            />
            <button
              type="button"
              aria-label={labels.newLayout}
              title={labels.newLayout}
              onClick={() =>
                openNameDialog(
                  { kind: "createLayout", source: "current" },
                  `${activeLayoutName} 2`
                )
              }
            >
              <Plus aria-hidden="true" weight="bold" />
            </button>
            <div className="compact-menu-anchor">
              <button
                type="button"
                aria-label={labels.layoutActions}
                title={labels.layoutActions}
                aria-expanded={layoutMenuOpen}
                onClick={() => setLayoutMenuOpen((open) => !open)}
              >
                <DotsThree aria-hidden="true" weight="bold" />
              </button>
              <CompactActionMenu
                ariaLabel={labels.layoutActions}
                open={layoutMenuOpen}
                items={layoutMenuItems}
                onClose={() => setLayoutMenuOpen(false)}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={ListChecks}
        title={labels.toolGroupsSection}
        action={
          <button
            className="settings-section__icon-action"
            type="button"
            aria-label={labels.newGroup}
            title={labels.newGroup}
            disabled={!isEditing || !isCustomLayout}
            onClick={() =>
              openNameDialog(
                { kind: "newGroup", layoutId: activeLayout.id },
                labels.defaultGroupName
              )
            }
          >
            <Plus aria-hidden="true" weight="bold" />
          </button>
        }
      >
        <p className="home-settings-description">
          {labels.toolGroupsDescription}
        </p>
        <div className="home-group-settings">
          {activeLayout.groups.map((group, index) => {
            const groupLabel = getHomeLayoutLabel(group.name, copy);
            const GroupIcon = HOME_GROUP_ICON_CATALOG[group.iconId];
            const isExpanded = expandedGroupId === group.id;
            const menuOpen = groupMenuId === group.id;
            const groupMenuItems: readonly CompactActionMenuItem[] = [
              {
                id: "rename",
                label: labels.renameGroup,
                icon: PencilSimple,
                disabled: !isEditing || !isCustomLayout,
                onSelect: () =>
                  openNameDialog(
                    {
                      kind: "renameGroup",
                      layoutId: activeLayout.id,
                      groupId: group.id
                    },
                    groupLabel
                  )
              },
              {
                id: "icon",
                label: labels.changeGroupIcon,
                icon: GridFour,
                disabled: !isEditing || !isCustomLayout,
                onSelect: () => {
                  setSelectedIconId(group.iconId);
                  setIconGroupId(group.id);
                }
              },
              {
                id: "copy",
                label: labels.duplicateGroup,
                icon: CopySimple,
                disabled: !isEditing || !isCustomLayout,
                onSelect: () =>
                  updateHomeSettings(
                    duplicateLayoutGroup(
                      homeSettings,
                      activeLayout.id,
                      group.id,
                      makeLocalId("group")
                    )
                  )
              },
              {
                id: "delete",
                label: labels.deleteGroup,
                icon: Trash,
                disabled: !isEditing || !isCustomLayout,
                danger: true,
                onSelect: () =>
                  setDeleteTarget({ kind: "group", id: group.id })
              }
            ];

            return (
              <div
                className="home-group-setting-wrap"
                data-home-layout-group="true"
                key={group.id}
              >
                <div
                  className="home-group-setting"
                  data-dragging={draggedGroupId === group.id || undefined}
                  draggable={isEditing && isCustomLayout}
                  onDragStart={(event: DragEvent<HTMLDivElement>) => {
                    setDraggedGroupId(group.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={() => {
                    if (draggedGroupId && isCustomLayout) {
                      updateHomeSettings(
                        moveLayoutGroup(
                          homeSettings,
                          activeLayout.id,
                          draggedGroupId,
                          group.id
                        )
                      );
                    }
                    setDraggedGroupId(null);
                  }}
                  onDragEnd={() => setDraggedGroupId(null)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setGroupMenuId(group.id);
                  }}
                >
                  <DotsSixVertical
                    className="home-group-setting__handle"
                    data-enabled={isEditing && isCustomLayout ? true : undefined}
                    aria-hidden="true"
                    weight="bold"
                  />
                  <GroupIcon
                    className="home-group-setting__icon"
                    aria-hidden="true"
                    weight="regular"
                  />
                  <span>{groupLabel}</span>
                  <div className="home-group-setting__actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={!isCustomLayout || index === 0}
                          aria-label={`${labels.moveUp}：${groupLabel}`}
                          title={labels.moveUp}
                          onClick={() => moveGroupByOffset(group.id, -1)}
                        >
                          <ArrowUp aria-hidden="true" weight="bold" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            !isCustomLayout ||
                            index === activeLayout.groups.length - 1
                          }
                          aria-label={`${labels.moveDown}：${groupLabel}`}
                          title={labels.moveDown}
                          onClick={() => moveGroupByOffset(group.id, 1)}
                        >
                          <ArrowDown aria-hidden="true" weight="bold" />
                        </button>
                      </>
                    ) : null}
                    <button
                      className="home-group-visibility"
                      type="button"
                      disabled={!isEditing || !isCustomLayout}
                      data-active={group.visible || undefined}
                      aria-pressed={group.visible}
                      aria-label={`${labels.showGroup}：${groupLabel}`}
                      title={`${labels.showGroup}：${groupLabel}`}
                      onClick={() =>
                        updateActiveGroup(group.id, {
                          visible: !group.visible
                        })
                      }
                    >
                      {group.visible ? (
                        <Eye aria-hidden="true" weight="regular" />
                      ) : (
                        <EyeSlash aria-hidden="true" weight="regular" />
                      )}
                    </button>
                    {isEditing ? (
                      <div className="compact-menu-anchor">
                        <button
                          type="button"
                          disabled={!isCustomLayout}
                          aria-label={`${labels.groupActions}：${groupLabel}`}
                          title={labels.groupActions}
                          aria-expanded={menuOpen}
                          onClick={() =>
                            setGroupMenuId(menuOpen ? null : group.id)
                          }
                        >
                          <DotsThree aria-hidden="true" weight="bold" />
                        </button>
                        <CompactActionMenu
                          ariaLabel={`${labels.groupActions}：${groupLabel}`}
                          open={menuOpen}
                          items={groupMenuItems}
                          onClose={() => setGroupMenuId(null)}
                        />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${
                        isExpanded ? labels.collapseGroup : labels.expandGroup
                      }：${groupLabel}`}
                      title={
                        isExpanded ? labels.collapseGroup : labels.expandGroup
                      }
                      onClick={() =>
                        setExpandedGroupId(isExpanded ? null : group.id)
                      }
                    >
                      {isExpanded ? (
                        <CaretUp aria-hidden="true" weight="bold" />
                      ) : (
                        <CaretDown aria-hidden="true" weight="bold" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="home-layout-slots">
                    {group.toolSlots.map((toolId, slotIndex) => {
                      const tool = toolId ? HOME_TOOL_CATALOG[toolId] : null;
                      const ToolIcon = tool?.icon ?? Plus;
                      const slotKey = `${group.id}:${slotIndex}`;
                      const slotMenuOpen = slotMenuKey === slotKey;
                      const slotLabel = toolId
                        ? copy.home.toolLabels[toolId]
                        : labels.emptySlot;

                      return (
                        <div className="home-layout-slot-wrap" key={slotKey}>
                          <button
                            className="home-layout-slot"
                            type="button"
                            data-home-layout-slot="true"
                            data-empty={!toolId || undefined}
                            draggable={Boolean(
                              toolId && isEditing && isCustomLayout
                            )}
                            aria-label={slotLabel}
                            title={
                              isEditing && isCustomLayout
                                ? toolId
                                  ? labels.replaceTool
                                  : labels.selectTool
                                : slotLabel
                            }
                            onClick={() => {
                              if (isEditing && isCustomLayout) {
                                setToolTarget({
                                  groupId: group.id,
                                  slotIndex
                                });
                                setToolSearch("");
                              }
                            }}
                            onContextMenu={(event) => {
                              if (!toolId || !isEditing || !isCustomLayout) {
                                return;
                              }
                              event.preventDefault();
                              setSlotMenuKey(slotKey);
                            }}
                            onDragStart={(event) => {
                              setDraggedSlotIndex(slotIndex);
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(event) => {
                              if (isEditing && isCustomLayout) {
                                event.preventDefault();
                              }
                            }}
                            onDrop={() => {
                              if (
                                draggedSlotIndex !== null &&
                                isCustomLayout
                              ) {
                                updateHomeSettings(
                                  moveToolSlot(
                                    homeSettings,
                                    activeLayout.id,
                                    group.id,
                                    draggedSlotIndex,
                                    slotIndex
                                  )
                                );
                              }
                              setDraggedSlotIndex(null);
                            }}
                            onDragEnd={() => setDraggedSlotIndex(null)}
                          >
                            <ToolIcon aria-hidden="true" weight="regular" />
                            <span>{slotLabel}</span>
                          </button>
                          <CompactActionMenu
                            ariaLabel={slotLabel}
                            open={slotMenuOpen}
                            items={[
                              {
                                id: "replace",
                                label: labels.replaceTool,
                                icon: PencilSimple,
                                onSelect: () => {
                                  setToolTarget({
                                    groupId: group.id,
                                    slotIndex
                                  });
                                  setToolSearch("");
                                }
                              },
                              {
                                id: "remove",
                                label: labels.removeTool,
                                icon: Trash,
                                danger: true,
                                onSelect: () =>
                                  updateHomeSettings(
                                    setToolSlot(
                                      homeSettings,
                                      activeLayout.id,
                                      group.id,
                                      slotIndex,
                                      null
                                    )
                                  )
                              }
                            ]}
                            onClose={() => setSlotMenuKey(null)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="home-layout-actions">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importLayout}
          />
          <button
            type="button"
            aria-label={labels.importLayout}
            title={labels.importLayout}
            onClick={() => importInputRef.current?.click()}
          >
            <UploadSimple aria-hidden="true" weight="bold" />
          </button>
          <button
            type="button"
            aria-label={labels.exportLayout}
            title={labels.exportLayout}
            onClick={exportLayout}
          >
            <DownloadSimple aria-hidden="true" weight="bold" />
          </button>
          <button
            type="button"
            aria-label={labels.resetAction}
            title={labels.resetAction}
            onClick={() =>
              setDeleteTarget({ kind: "layout", id: "__reset__" })
            }
          >
            <ArrowsClockwise aria-hidden="true" weight="bold" />
          </button>
        </div>
        {importStatus ? (
          <p className="home-layout-status" data-status={importStatus}>
            {importStatus === "success"
              ? labels.importSuccess
              : labels.importError}
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection icon={GridFour} title={labels.gridDefaultsSection}>
        <div className="setting-row">
          <span className="setting-row__label">{labels.rememberPanelModes}</span>
          <div className="setting-row__control">
            <SwitchControl
              checked={homeSettings.rememberPanelModes}
              label={labels.rememberPanelModes}
              onChange={(rememberPanelModes) =>
                updateHomeSettings({
                  rememberPanelModes,
                  createMode: rememberPanelModes
                    ? homeSettings.createMode
                    : homeSettings.defaultCreateMode,
                  spaceMode: rememberPanelModes
                    ? homeSettings.spaceMode
                    : homeSettings.defaultSpaceMode
                })
              }
            />
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-row__label">{labels.createSelectDefault}</span>
          <div className="setting-row__control">
            <div className="setting-segments" data-count="2">
              {(["create", "select"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  data-active={
                    homeSettings.defaultCreateMode === mode || undefined
                  }
                  aria-pressed={homeSettings.defaultCreateMode === mode}
                  onClick={() =>
                    updateHomeSettings({
                      defaultCreateMode: mode as HomeCreateMode,
                      createMode: mode as HomeCreateMode
                    })
                  }
                >
                  {labels[mode]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-row__label">{labels.anchorAlignDefault}</span>
          <div className="setting-row__control">
            <div className="setting-segments" data-count="2">
              {(["anchor", "align"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  data-active={
                    homeSettings.defaultSpaceMode === mode || undefined
                  }
                  aria-pressed={homeSettings.defaultSpaceMode === mode}
                  onClick={() =>
                    updateHomeSettings({
                      defaultSpaceMode: mode as HomeSpaceMode,
                      spaceMode: mode as HomeSpaceMode
                    })
                  }
                >
                  {labels[mode]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      {nameDialog ? (
        <TextInputDialog
          title={
            nameDialog.kind === "createLayout"
              ? labels.createLayoutTitle
              : nameDialog.kind === "renameLayout"
                ? labels.renameLayout
                : nameDialog.kind === "newGroup"
                  ? labels.newGroup
                  : labels.renameGroup
          }
          description={
            nameDialog.kind === "createLayout"
              ? labels.createLayoutDescription
              : undefined
          }
          value={nameValue}
          placeholder={
            nameDialog.kind === "newGroup" ||
            nameDialog.kind === "renameGroup"
              ? labels.groupNamePlaceholder
              : labels.layoutNamePlaceholder
          }
          maxLength={
            nameDialog.kind === "newGroup" ||
            nameDialog.kind === "renameGroup"
              ? 16
              : 24
          }
          error={nameError}
          confirmLabel={
            nameDialog.kind === "createLayout"
              ? labels.createAction
              : labels.saveAction
          }
          cancelLabel={labels.resetCancel}
          onValueChange={(value) => {
            setNameValue(value);
            setNameError(null);
          }}
          onConfirm={submitNameDialog}
          onCancel={() => {
            setNameDialog(null);
            setNameError(null);
          }}
        >
          {nameDialog.kind === "createLayout" ? (
            <div className="layout-source-options">
              {(["current", "blank"] as const).map((source) => (
                <button
                  type="button"
                  key={source}
                  data-active={nameDialog.source === source || undefined}
                  onClick={() =>
                    setNameDialog({ kind: "createLayout", source })
                  }
                >
                  {source === "current"
                    ? labels.createFromCurrent
                    : labels.createBlank}
                </button>
              ))}
            </div>
          ) : null}
        </TextInputDialog>
      ) : null}

      {iconGroupId ? (
        <IconPickerDialog
          title={labels.selectIcon}
          selectedIconId={selectedIconId}
          iconLabels={labels.groupIconLabels}
          confirmLabel={labels.saveAction}
          cancelLabel={labels.resetCancel}
          onSelect={setSelectedIconId}
          onConfirm={() => {
            updateActiveGroup(iconGroupId, { iconId: selectedIconId });
            setIconGroupId(null);
          }}
          onCancel={() => setIconGroupId(null)}
        />
      ) : null}

      {toolTarget ? (
        <AppDialog
          title={labels.selectTool}
          primaryAction={{
            label: labels.resetCancel,
            onClick: () => setToolTarget(null)
          }}
          onClose={() => setToolTarget(null)}
        >
          <div className="home-tool-picker">
            <input
              className="nyaworks-text-input"
              type="search"
              value={toolSearch}
              placeholder={copy.home.searchPlaceholder}
              onChange={(event) => setToolSearch(event.target.value)}
            />
            <div className="home-tool-picker__grid">
              {visibleTools.map((tool) => {
                const ToolIcon = tool.icon;
                return (
                  <button
                    type="button"
                    key={tool.id}
                    title={copy.home.toolLabels[tool.id]}
                    onClick={() => {
                      updateHomeSettings(
                        setToolSlot(
                          homeSettings,
                          activeLayout.id,
                          toolTarget.groupId,
                          toolTarget.slotIndex,
                          tool.id as ToolId
                        )
                      );
                      setToolTarget(null);
                    }}
                  >
                    <ToolIcon aria-hidden="true" weight="regular" />
                    <span>{copy.home.toolLabels[tool.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </AppDialog>
      ) : null}

      {deleteTarget ? (
        <AppDialog
          title={
            deleteTarget.kind === "group"
              ? labels.deleteGroupTitle
              : deleteTarget.id === "__reset__"
                ? labels.resetDialogTitle
                : labels.deleteLayoutTitle
          }
          description={
            deleteTarget.kind === "group"
              ? labels.deleteGroupBody
              : deleteTarget.id === "__reset__"
                ? labels.resetDialogBody
                : labels.deleteLayoutBody
          }
          primaryAction={{
            label:
              deleteTarget.kind === "group"
                ? labels.deleteGroupConfirm
                : deleteTarget.id === "__reset__"
                  ? labels.resetConfirm
                  : labels.deleteLayoutConfirm,
            onClick: () => {
              if (deleteTarget.kind === "group") {
                updateHomeSettings(
                  deleteLayoutGroup(
                    homeSettings,
                    activeLayout.id,
                    deleteTarget.id
                  )
                );
              } else if (deleteTarget.id === "__reset__") {
                resetHomeSettings();
                setIsEditing(false);
              } else {
                updateHomeSettings(
                  deleteLayout(homeSettings, deleteTarget.id)
                );
                setIsEditing(false);
              }
              setDeleteTarget(null);
            }
          }}
          secondaryAction={{
            label: labels.resetCancel,
            onClick: () => setDeleteTarget(null)
          }}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
