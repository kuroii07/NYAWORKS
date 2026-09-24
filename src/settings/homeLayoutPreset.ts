import { HOME_LAYOUT_SCHEMA_VERSION } from "../homeLayouts/types";
import type {
  HomeLayout,
  HomeLayoutGroup,
  HomeLayoutLabel
} from "../homeLayouts/types";
import { normalizeLayoutName } from "../homeLayouts/layoutOperations";
import { normalizeHomeSettings } from "./homeSettingsStorage";
import { DEFAULT_HOME_SETTINGS } from "./types";

interface PortableHomeLayout {
  name: HomeLayoutLabel;
  groups: HomeLayoutGroup[];
}

export interface HomeLayoutPreset {
  schemaVersion: typeof HOME_LAYOUT_SCHEMA_VERSION;
  product: "NYAWORKS";
  exportedAt: string;
  layout: PortableHomeLayout;
}

interface ParseHomeLayoutPresetInput {
  id: string;
  now: string;
  existingNames: readonly string[];
}

function hasImportableGroupShape(value: unknown): value is HomeLayoutGroup {
  if (!value || typeof value !== "object") {
    return false;
  }

  const group = value as Partial<HomeLayoutGroup>;
  return (
    typeof group.id === "string" &&
    Boolean(group.id.trim()) &&
    Boolean(group.name && typeof group.name === "object") &&
    Array.isArray(group.toolSlots)
  );
}

function clonePortableLayout(layout: HomeLayout): PortableHomeLayout {
  return {
    name: { ...layout.name },
    groups: layout.groups.map((group) => ({
      ...group,
      name: { ...group.name },
      toolSlots: [...group.toolSlots]
    }))
  };
}

export function createHomeLayoutPreset(
  layout: HomeLayout,
  exportedAt = new Date().toISOString()
): HomeLayoutPreset {
  return {
    schemaVersion: HOME_LAYOUT_SCHEMA_VERSION,
    product: "NYAWORKS",
    exportedAt,
    layout: clonePortableLayout(layout)
  };
}

export function parseHomeLayoutPreset(
  source: string,
  input: ParseHomeLayoutPresetInput
): HomeLayout {
  try {
    const parsed = JSON.parse(source) as Partial<HomeLayoutPreset>;

    if (
      parsed.schemaVersion !== HOME_LAYOUT_SCHEMA_VERSION ||
      parsed.product !== "NYAWORKS" ||
      !parsed.layout ||
      typeof parsed.layout !== "object" ||
      !Array.isArray(parsed.layout.groups) ||
      !parsed.layout.groups.every(hasImportableGroupShape)
    ) {
      throw new Error("INVALID_HOME_LAYOUT_PRESET");
    }

    const candidateName =
      parsed.layout.name?.kind === "custom"
        ? normalizeLayoutName(parsed.layout.name.value)
        : "";

    if (!candidateName) {
      throw new Error("INVALID_HOME_LAYOUT_PRESET");
    }

    const normalizedExistingNames = input.existingNames.map((name) =>
      normalizeLayoutName(name).toLocaleLowerCase()
    );

    if (
      normalizedExistingNames.includes(candidateName.toLocaleLowerCase())
    ) {
      throw new Error("DUPLICATE_HOME_LAYOUT_NAME");
    }

    const normalized = normalizeHomeSettings({
      ...DEFAULT_HOME_SETTINGS,
      activeLayoutId: input.id,
      customLayouts: [
        {
          id: input.id,
          kind: "custom",
          name: { kind: "custom", value: candidateName },
          groups: parsed.layout.groups.map((group, index) => ({
            ...group,
            id: `${input.id}:group:${index + 1}`
          })),
          createdAt: input.now,
          updatedAt: input.now
        }
      ]
    });
    const layout = normalized.customLayouts[0];

    if (!layout) {
      throw new Error("INVALID_HOME_LAYOUT_PRESET");
    }

    return layout;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "DUPLICATE_HOME_LAYOUT_NAME" ||
        error.message === "INVALID_HOME_LAYOUT_PRESET")
    ) {
      throw error;
    }

    throw new Error("INVALID_HOME_LAYOUT_PRESET");
  }
}
