import {
  BUILT_IN_CREATIVE_LAYOUT_ID,
  BUILT_IN_HOME_LAYOUTS,
  HOME_GROUP_SLOT_COUNT,
  isKnownHomeGroupIconId,
  isKnownHomeToolId
} from "../homeLayouts/catalog";
import type {
  HomeLayout,
  HomeLayoutGroup,
  HomeLayoutLabel
} from "../homeLayouts/types";
import type { ToolGroupId } from "../i18n/types";
import {
  DEFAULT_HOME_SETTINGS,
  HOME_CREATE_MODES,
  HOME_SPACE_MODES,
  type HomeCreateMode,
  type HomeSettings,
  type HomeSpaceMode
} from "./types";

export const HOME_SETTINGS_STORAGE_KEY = "nyaworks.settings.home.v2";

interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const BUILT_IN_GROUP_KEYS: readonly ToolGroupId[] = [
  "compositionProject",
  "layerActions",
  "animationTime",
  "textShapes",
  "effectsPresets"
];

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isCreateMode(value: unknown): value is HomeCreateMode {
  return (
    typeof value === "string" &&
    HOME_CREATE_MODES.includes(value as HomeCreateMode)
  );
}

function isSpaceMode(value: unknown): value is HomeSpaceMode {
  return (
    typeof value === "string" &&
    HOME_SPACE_MODES.includes(value as HomeSpaceMode)
  );
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeLayoutLabel(
  value: unknown,
  fallback: HomeLayoutLabel,
  maxLength: number
): HomeLayoutLabel {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<HomeLayoutLabel>;

  if (candidate.kind === "custom") {
    const customValue = normalizeText(candidate.value, maxLength);
    return customValue
      ? { kind: "custom", value: customValue }
      : fallback;
  }

  if (
    candidate.kind === "translation" &&
    typeof candidate.key === "string" &&
    (candidate.key === "creativeGeneral" ||
      BUILT_IN_GROUP_KEYS.includes(candidate.key as ToolGroupId))
  ) {
    return {
      kind: "translation",
      key: candidate.key as "creativeGeneral" | ToolGroupId
    };
  }

  return fallback;
}

function normalizeGroup(value: unknown, index: number): HomeLayoutGroup | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<HomeLayoutGroup>;
  const id = normalizeText(candidate.id, 80);

  if (!id) {
    return null;
  }

  const fallbackName: HomeLayoutLabel = {
    kind: "custom",
    value: `Group ${index + 1}`
  };
  const inputSlots = Array.isArray(candidate.toolSlots)
    ? candidate.toolSlots
    : [];
  const validTools = inputSlots
    .filter(isKnownHomeToolId)
    .slice(0, HOME_GROUP_SLOT_COUNT);

  return {
    id,
    name: normalizeLayoutLabel(candidate.name, fallbackName, 16),
    iconId: isKnownHomeGroupIconId(candidate.iconId)
      ? candidate.iconId
      : "folder",
    visible: isBoolean(candidate.visible) ? candidate.visible : true,
    toolSlots: Array.from(
      { length: HOME_GROUP_SLOT_COUNT },
      (_, slotIndex) => validTools[slotIndex] ?? null
    )
  };
}

function normalizeCustomLayout(value: unknown): HomeLayout | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<HomeLayout>;
  const id = normalizeText(candidate.id, 80);
  const createdAt = normalizeText(candidate.createdAt, 40);
  const updatedAt = normalizeText(candidate.updatedAt, 40);

  if (!id || id === BUILT_IN_CREATIVE_LAYOUT_ID) {
    return null;
  }

  const groups = Array.isArray(candidate.groups)
    ? candidate.groups
        .map((group, index) => normalizeGroup(group, index))
        .filter((group): group is HomeLayoutGroup => Boolean(group))
    : [];
  const uniqueGroups = groups.filter(
    (group, index) =>
      groups.findIndex((candidateGroup) => candidateGroup.id === group.id) ===
      index
  );

  return {
    id,
    kind: "custom",
    name: normalizeLayoutLabel(
      candidate.name,
      { kind: "custom", value: "Custom Layout" },
      24
    ),
    groups: uniqueGroups,
    createdAt: createdAt ?? new Date(0).toISOString(),
    updatedAt: updatedAt ?? createdAt ?? new Date(0).toISOString()
  };
}

function normalizeBuiltInLayoutOverride(value: unknown): HomeLayout | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<HomeLayout>;
  if (candidate.id !== BUILT_IN_CREATIVE_LAYOUT_ID) {
    return undefined;
  }

  const groups = Array.isArray(candidate.groups)
    ? candidate.groups
        .map((group, index) => normalizeGroup(group, index))
        .filter((group): group is HomeLayoutGroup => Boolean(group))
    : [];

  return {
    ...BUILT_IN_HOME_LAYOUTS[0],
    kind: "built-in",
    groups,
    updatedAt:
      normalizeText(candidate.updatedAt, 40) ?? BUILT_IN_HOME_LAYOUTS[0].updatedAt
  };
}

function isAccidentalBuiltInCopy(layout: HomeLayout): boolean {
  if (
    layout.name.kind !== "custom" ||
    !/^(创作通用|創作通用|Creative General)\s+\d+$/i.test(layout.name.value) ||
    layout.groups.length === 0
  ) {
    return false;
  }

  const generatedGroupPrefix = `${layout.id}:group:`;
  return layout.groups.every((group) => {
    const generatedIndex = group.id.slice(generatedGroupPrefix.length);
    return (
      group.id.startsWith(generatedGroupPrefix) &&
      /^\d+$/.test(generatedIndex)
    );
  });
}

export function normalizeHomeSettings(value: unknown): HomeSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_HOME_SETTINGS;
  }

  const candidate = value as Partial<Record<keyof HomeSettings, unknown>>;
  const showQuickPanels = isBoolean(candidate.showQuickPanels)
    ? candidate.showQuickPanels
    : DEFAULT_HOME_SETTINGS.showQuickPanels;
  const rememberPanelModes = isBoolean(candidate.rememberPanelModes)
    ? candidate.rememberPanelModes
    : DEFAULT_HOME_SETTINGS.rememberPanelModes;
  const defaultCreateMode = isCreateMode(candidate.defaultCreateMode)
    ? candidate.defaultCreateMode
    : DEFAULT_HOME_SETTINGS.defaultCreateMode;
  const defaultSpaceMode = isSpaceMode(candidate.defaultSpaceMode)
    ? candidate.defaultSpaceMode
    : DEFAULT_HOME_SETTINGS.defaultSpaceMode;
  let customLayouts = Array.isArray(candidate.customLayouts)
    ? candidate.customLayouts
        .map(normalizeCustomLayout)
        .filter((layout): layout is HomeLayout => Boolean(layout))
        .filter(
          (layout, index, layouts) =>
            layouts.findIndex((candidateLayout) => candidateLayout.id === layout.id) ===
            index
        )
    : [];
  let builtInLayoutOverride = normalizeBuiltInLayoutOverride(
    candidate.builtInLayoutOverride
  );
  const requestedActiveId =
    typeof candidate.activeLayoutId === "string"
      ? candidate.activeLayoutId
      : BUILT_IN_CREATIVE_LAYOUT_ID;
  const activeLayoutId =
    requestedActiveId === BUILT_IN_CREATIVE_LAYOUT_ID ||
    customLayouts.some((layout) => layout.id === requestedActiveId)
      ? requestedActiveId
      : BUILT_IN_CREATIVE_LAYOUT_ID;

  if (!builtInLayoutOverride && activeLayoutId !== BUILT_IN_CREATIVE_LAYOUT_ID) {
    const activeCustomLayout = customLayouts.find(
      (layout) => layout.id === activeLayoutId
    );

    if (activeCustomLayout && isAccidentalBuiltInCopy(activeCustomLayout)) {
      builtInLayoutOverride = {
        ...BUILT_IN_HOME_LAYOUTS[0],
        groups: activeCustomLayout.groups,
        updatedAt: activeCustomLayout.updatedAt
      };
      customLayouts = customLayouts.filter(
        (layout) => layout.id !== activeCustomLayout.id
      );
    }
  }

  const resolvedActiveLayoutId =
    !normalizeBuiltInLayoutOverride(candidate.builtInLayoutOverride) &&
    activeLayoutId !== BUILT_IN_CREATIVE_LAYOUT_ID &&
    !customLayouts.some((layout) => layout.id === activeLayoutId)
      ? BUILT_IN_CREATIVE_LAYOUT_ID
      : activeLayoutId;

  return {
    activeLayoutId: resolvedActiveLayoutId,
    customLayouts,
    ...(builtInLayoutOverride ? { builtInLayoutOverride } : {}),
    showQuickPanels,
    rememberPanelModes,
    defaultCreateMode,
    defaultSpaceMode,
    createMode:
      rememberPanelModes && isCreateMode(candidate.createMode)
        ? candidate.createMode
        : defaultCreateMode,
    spaceMode:
      rememberPanelModes && isSpaceMode(candidate.spaceMode)
        ? candidate.spaceMode
        : defaultSpaceMode
  };
}

export function getActiveHomeLayout(settings: HomeSettings): HomeLayout {
  return (
    (settings.activeLayoutId === BUILT_IN_CREATIVE_LAYOUT_ID
      ? settings.builtInLayoutOverride
      : undefined) ??
    BUILT_IN_HOME_LAYOUTS.find(
      (layout) => layout.id === settings.activeLayoutId
    ) ??
    settings.customLayouts.find(
      (layout) => layout.id === settings.activeLayoutId
    ) ??
    BUILT_IN_HOME_LAYOUTS[0]
  );
}

export function readStoredHomeSettings(
  storage?: SettingsStorage
): HomeSettings {
  if (!storage) {
    return DEFAULT_HOME_SETTINGS;
  }

  try {
    const storedValue = storage.getItem(HOME_SETTINGS_STORAGE_KEY);
    return storedValue
      ? normalizeHomeSettings(JSON.parse(storedValue))
      : DEFAULT_HOME_SETTINGS;
  } catch {
    return DEFAULT_HOME_SETTINGS;
  }
}

export function writeStoredHomeSettings(
  settings: HomeSettings,
  storage?: SettingsStorage
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      HOME_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeHomeSettings(settings))
    );
  } catch {
    // CEP can run with storage disabled. Keep the active session usable.
  }
}
