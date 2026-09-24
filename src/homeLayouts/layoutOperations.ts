import {
  BUILT_IN_CREATIVE_LAYOUT_ID,
  BUILT_IN_HOME_LAYOUTS,
  HOME_GROUP_SLOT_COUNT
} from "./catalog";
import type { ToolId } from "../i18n/types";
import type { HomeLayout, HomeLayoutGroup } from "./types";
import type { HomeSettings } from "../settings/types";

interface CreateLayoutInput {
  id: string;
  name: string;
  source: "blank" | "current";
  blankGroupId: string;
  blankGroupName: string;
  now: string;
}

interface DuplicateLayoutInput {
  id: string;
  name: string;
  now: string;
}

function cloneGroup(group: HomeLayoutGroup): HomeLayoutGroup {
  return {
    ...group,
    name: { ...group.name },
    toolSlots: [...group.toolSlots]
  };
}

function cloneLayout(layout: HomeLayout): HomeLayout {
  return {
    ...layout,
    name: { ...layout.name },
    groups: layout.groups.map(cloneGroup)
  };
}

function findLayout(settings: HomeSettings, layoutId: string): HomeLayout | null {
  return (
    BUILT_IN_HOME_LAYOUTS.find((layout) => layout.id === layoutId) ??
    settings.customLayouts.find((layout) => layout.id === layoutId) ??
    null
  );
}

function updateCustomLayout(
  settings: HomeSettings,
  layoutId: string,
  update: (layout: HomeLayout) => HomeLayout
): HomeSettings {
  let found = false;
  const customLayouts = settings.customLayouts.map((layout) => {
    if (layout.id !== layoutId) {
      return layout;
    }

    found = true;
    return update(layout);
  });

  if (!found) {
    throw new Error(
      layoutId === BUILT_IN_CREATIVE_LAYOUT_ID
        ? "BUILT_IN_LAYOUT_READ_ONLY"
        : "CUSTOM_LAYOUT_NOT_FOUND"
    );
  }

  return { ...settings, customLayouts };
}

function normalizeGroupName(name: string): string {
  return name.trim().slice(0, 16);
}

export function normalizeLayoutName(name: string): string {
  return name.trim().slice(0, 24);
}

export function isDuplicateLayoutName(
  settings: HomeSettings,
  name: string,
  excludedLayoutId?: string
): boolean {
  const normalizedName = normalizeLayoutName(name).toLocaleLowerCase();

  if (!normalizedName) {
    return false;
  }

  const layouts = [...BUILT_IN_HOME_LAYOUTS, ...settings.customLayouts];
  return layouts.some((layout) => {
    if (layout.id === excludedLayoutId || layout.name.kind !== "custom") {
      return false;
    }

    return layout.name.value.toLocaleLowerCase() === normalizedName;
  });
}

export function createCustomLayout(
  settings: HomeSettings,
  input: CreateLayoutInput
): HomeSettings {
  const name = normalizeLayoutName(input.name);

  if (!name) {
    throw new Error("HOME_LAYOUT_NAME_REQUIRED");
  }

  if (isDuplicateLayoutName(settings, name)) {
    throw new Error("DUPLICATE_HOME_LAYOUT_NAME");
  }

  const sourceLayout =
    input.source === "current"
      ? findLayout(settings, settings.activeLayoutId)
      : null;
  const groups = sourceLayout
    ? sourceLayout.groups.map((group, index) => ({
        ...cloneGroup(group),
        id: `${input.id}:group:${index + 1}`
      }))
    : [
        {
          id: input.blankGroupId,
          name: {
            kind: "custom" as const,
            value: normalizeGroupName(input.blankGroupName) || "Group 1"
          },
          iconId: "folder" as const,
          visible: true,
          toolSlots: Array.from(
            { length: HOME_GROUP_SLOT_COUNT },
            () => null
          )
        }
      ];
  const layout: HomeLayout = {
    id: input.id,
    kind: "custom",
    name: { kind: "custom", value: name },
    groups,
    createdAt: input.now,
    updatedAt: input.now
  };

  return {
    ...settings,
    activeLayoutId: layout.id,
    customLayouts: [...settings.customLayouts, layout]
  };
}

export function duplicateLayout(
  settings: HomeSettings,
  layoutId: string,
  input: DuplicateLayoutInput
): HomeSettings {
  const sourceLayout = findLayout(settings, layoutId);

  if (!sourceLayout) {
    throw new Error("HOME_LAYOUT_NOT_FOUND");
  }

  const temporarySettings = {
    ...settings,
    activeLayoutId: layoutId
  };

  return createCustomLayout(temporarySettings, {
    ...input,
    source: "current",
    blankGroupId: `${input.id}:group:first`,
    blankGroupName: "Group 1"
  });
}

export function renameLayout(
  settings: HomeSettings,
  layoutId: string,
  name: string,
  now = new Date().toISOString()
): HomeSettings {
  const normalizedName = normalizeLayoutName(name);

  if (!normalizedName) {
    throw new Error("HOME_LAYOUT_NAME_REQUIRED");
  }

  if (isDuplicateLayoutName(settings, normalizedName, layoutId)) {
    throw new Error("DUPLICATE_HOME_LAYOUT_NAME");
  }

  return updateCustomLayout(settings, layoutId, (layout) => ({
    ...layout,
    name: { kind: "custom", value: normalizedName },
    updatedAt: now
  }));
}

export function deleteLayout(
  settings: HomeSettings,
  layoutId: string
): HomeSettings {
  if (layoutId === BUILT_IN_CREATIVE_LAYOUT_ID) {
    throw new Error("BUILT_IN_LAYOUT_READ_ONLY");
  }

  const customLayouts = settings.customLayouts.filter(
    (layout) => layout.id !== layoutId
  );

  return {
    ...settings,
    activeLayoutId:
      settings.activeLayoutId === layoutId
        ? BUILT_IN_CREATIVE_LAYOUT_ID
        : settings.activeLayoutId,
    customLayouts
  };
}

export function setActiveLayout(
  settings: HomeSettings,
  layoutId: string
): HomeSettings {
  if (!findLayout(settings, layoutId)) {
    return { ...settings, activeLayoutId: BUILT_IN_CREATIVE_LAYOUT_ID };
  }

  return { ...settings, activeLayoutId: layoutId };
}

export function addLayoutGroup(
  settings: HomeSettings,
  layoutId: string,
  group: HomeLayoutGroup,
  now = new Date().toISOString()
): HomeSettings {
  return updateCustomLayout(settings, layoutId, (layout) => ({
    ...layout,
    groups: [...layout.groups, cloneGroup(group)],
    updatedAt: now
  }));
}

export function updateLayoutGroup(
  settings: HomeSettings,
  layoutId: string,
  groupId: string,
  patch: Partial<Omit<HomeLayoutGroup, "id" | "toolSlots">>,
  now = new Date().toISOString()
): HomeSettings {
  return updateCustomLayout(settings, layoutId, (layout) => ({
    ...layout,
    groups: layout.groups.map((group) =>
      group.id === groupId ? { ...group, ...patch } : group
    ),
    updatedAt: now
  }));
}

export function duplicateLayoutGroup(
  settings: HomeSettings,
  layoutId: string,
  groupId: string,
  newGroupId: string,
  now = new Date().toISOString()
): HomeSettings {
  return updateCustomLayout(settings, layoutId, (layout) => {
    const sourceIndex = layout.groups.findIndex((group) => group.id === groupId);

    if (sourceIndex === -1) {
      return layout;
    }

    const source = layout.groups[sourceIndex];
    const groups = [...layout.groups];
    groups.splice(sourceIndex + 1, 0, {
      ...cloneGroup(source),
      id: newGroupId,
      name:
        source.name.kind === "custom"
          ? { kind: "custom", value: `${source.name.value} Copy`.slice(0, 16) }
          : { ...source.name }
    });
    return { ...layout, groups, updatedAt: now };
  });
}

export function deleteLayoutGroup(
  settings: HomeSettings,
  layoutId: string,
  groupId: string,
  now = new Date().toISOString()
): HomeSettings {
  return updateCustomLayout(settings, layoutId, (layout) => ({
    ...layout,
    groups: layout.groups.filter((group) => group.id !== groupId),
    updatedAt: now
  }));
}

export function moveLayoutGroup(
  settings: HomeSettings,
  layoutId: string,
  sourceId: string,
  targetId: string,
  now = new Date().toISOString()
): HomeSettings {
  return updateCustomLayout(settings, layoutId, (layout) => {
    if (sourceId === targetId) {
      return layout;
    }

    const sourceIndex = layout.groups.findIndex(
      (group) => group.id === sourceId
    );
    const targetIndex = layout.groups.findIndex(
      (group) => group.id === targetId
    );

    if (sourceIndex === -1 || targetIndex === -1) {
      return layout;
    }

    const groups = [...layout.groups];
    const [source] = groups.splice(sourceIndex, 1);
    groups.splice(targetIndex, 0, source);
    return { ...layout, groups, updatedAt: now };
  });
}

export function setToolSlot(
  settings: HomeSettings,
  layoutId: string,
  groupId: string,
  slotIndex: number,
  toolId: ToolId | null,
  now = new Date().toISOString()
): HomeSettings {
  if (slotIndex < 0 || slotIndex >= HOME_GROUP_SLOT_COUNT) {
    return settings;
  }

  return updateCustomLayout(settings, layoutId, (layout) => ({
    ...layout,
    groups: layout.groups.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      const toolSlots = [...group.toolSlots];
      toolSlots[slotIndex] = toolId;
      return { ...group, toolSlots };
    }),
    updatedAt: now
  }));
}

export function moveToolSlot(
  settings: HomeSettings,
  layoutId: string,
  groupId: string,
  sourceIndex: number,
  targetIndex: number,
  now = new Date().toISOString()
): HomeSettings {
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= HOME_GROUP_SLOT_COUNT ||
    targetIndex >= HOME_GROUP_SLOT_COUNT
  ) {
    return settings;
  }

  return updateCustomLayout(settings, layoutId, (layout) => ({
    ...layout,
    groups: layout.groups.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      const toolSlots = [...group.toolSlots];
      const [source] = toolSlots.splice(sourceIndex, 1);
      toolSlots.splice(targetIndex, 0, source ?? null);
      return { ...group, toolSlots };
    }),
    updatedAt: now
  }));
}

export function cloneHomeLayout(layout: HomeLayout): HomeLayout {
  return cloneLayout(layout);
}
