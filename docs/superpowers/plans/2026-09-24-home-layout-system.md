# NYAWORKS Home Layout System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incorrect global icon-count controls with a complete homepage layout system containing one protected built-in layout and user-created editable layouts whose names, groups, icons, order, visibility, and seven tool slots render directly on the homepage.

**Architecture:** Keep the two nine-grid panels outside the layout model. Store only the active layout ID, custom layouts, and nine-grid preferences in `HomeSettings`; derive the built-in “创作通用” layout from an immutable catalog. Put mutations in a pure reducer/service layer, persist normalized state through `SettingsProvider`, and let both `HomePage` and `HomeSettingsPanel` consume the same layout catalog and state.

**Tech Stack:** React 18, TypeScript 5.6, Vite 8, Vitest 5, Phosphor Icons, browser `localStorage`, CEP-compatible HTML/CSS/JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-24-home-layout-system-design.md`

## Global Constraints

- The global search, Banner, “新建 / 选择” grid, and “锚点 / 对齐” grid remain outside layout switching.
- The first built-in layout is “创作通用”; it always renders five groups with seven tool slots per group.
- Every layout group always contains exactly eight slots; a slot is a tool ID or `null`.
- Built-in layouts cannot be renamed or deleted; editing one creates a custom copy first.
- Custom text entry must use NYAWORKS controls, never `window.prompt()`, AE native input, or Windows native dialogs.
- Layout controls use compact icons and Tooltip text; the selector row is `[layout ▼] [＋] [···]`.
- Import creates a custom layout and never silently overwrites an existing name.
- Layout export excludes theme, language, API keys, license data, general settings, and transient nine-grid mode.
- Simplified Chinese, Traditional Chinese, English, Japanese, and Korean must remain complete.
- The default approximately 493px panel width must not produce horizontal scrolling.
- Existing theme, language, general settings, About page, and update behavior must not regress.
- Browser validation and real AE CEP-host validation must be reported separately.

## Review Focus

- A corrupt or older local-storage payload must fall back to “创作通用” without blanking the homepage; Task 2 adds normalization and migration tests.
- Duplicate custom names after trimming and case folding must be rejected; Tasks 3 and 4 add service and dialog validation tests.
- Deleting the active custom layout must switch to “创作通用” atomically; Task 3 adds reducer coverage.
- Imported unknown tool or icon IDs must become safe empty/default values instead of crashing rendering; Task 4 adds parser tests.
- A custom layout with long Latin, Japanese, or Korean names must not widen the 493px panel; Task 8 adds CSS guard tests and multilingual browser checks.

---

### Task 1: Define the layout domain and immutable built-in catalog

**Files:**
- Create: `src/homeLayouts/types.ts`
- Create: `src/homeLayouts/catalog.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/pages/HomePage.tsx`
- Test: `tests/homeLayoutCatalog.test.ts`

**Interfaces:**
- Consumes: existing `ToolId`, tool labels, and Phosphor icon components currently declared inside `HomePage.tsx`.
- Produces:
  - `HOME_LAYOUT_SCHEMA_VERSION`
  - `BUILT_IN_CREATIVE_LAYOUT_ID`
  - `HOME_GROUP_SLOT_COUNT`
  - `HomeLayout`, `HomeLayoutGroup`, `HomeLayoutLabel`, `HomeGroupIconId`
  - `BUILT_IN_HOME_LAYOUTS`
  - `HOME_TOOL_CATALOG`
  - `HOME_GROUP_ICON_CATALOG`
  - `getHomeLayoutLabel(label, copy)`

- [ ] **Step 1: Write the failing catalog test**

```ts
import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CREATIVE_LAYOUT_ID,
  BUILT_IN_HOME_LAYOUTS,
  HOME_GROUP_SLOT_COUNT
} from "../src/homeLayouts/catalog";

describe("home layout catalog", () => {
  it("defines the protected creative layout with five complete groups", () => {
    const layout = BUILT_IN_HOME_LAYOUTS.find(
      (item) => item.id === BUILT_IN_CREATIVE_LAYOUT_ID
    );

    expect(layout?.kind).toBe("built-in");
    expect(layout?.groups).toHaveLength(5);
    expect(layout?.groups.every(
      (group) => group.toolSlots.length === HOME_GROUP_SLOT_COUNT
    )).toBe(true);
    expect(layout?.groups.flatMap((group) => group.toolSlots)).not.toContain(null);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- --run tests/homeLayoutCatalog.test.ts
```

Expected: FAIL because `src/homeLayouts/catalog.tsx` does not exist.

- [ ] **Step 3: Create the domain types**

Create `src/homeLayouts/types.ts` with these public shapes:

```ts
import type { ToolId, ToolGroupId } from "../i18n/types";

export const HOME_LAYOUT_SCHEMA_VERSION = 1 as const;
export const HOME_GROUP_SLOT_COUNT = 7 as const;

export type HomeLayoutLabel =
  | { kind: "translation"; key: "creativeGeneral" | ToolGroupId }
  | { kind: "custom"; value: string };

export type HomeGroupIconId =
  | "folder"
  | "layers"
  | "curve"
  | "text"
  | "effects"
  | "project"
  | "camera"
  | "shape"
  | "media"
  | "sparkle";

export interface HomeLayoutGroup {
  id: string;
  name: HomeLayoutLabel;
  iconId: HomeGroupIconId;
  visible: boolean;
  toolSlots: Array<ToolId | null>;
}

export interface HomeLayout {
  id: string;
  name: HomeLayoutLabel;
  kind: "built-in" | "custom";
  groups: HomeLayoutGroup[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Move tool and icon declarations into the shared catalog**

Create `src/homeLayouts/catalog.tsx`:

```tsx
export const BUILT_IN_CREATIVE_LAYOUT_ID = "built-in:creative-general";

export const BUILT_IN_HOME_LAYOUTS: readonly HomeLayout[] = [
  {
    id: BUILT_IN_CREATIVE_LAYOUT_ID,
    kind: "built-in",
    name: { kind: "translation", key: "creativeGeneral" },
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    groups: [
      {
        id: "compositionProject",
        name: { kind: "translation", key: "compositionProject" },
        iconId: "folder",
        visible: true,
        toolSlots: [
          "newProjectFolder",
          "organizeProject",
          "duplicateComp",
          "packageLayers",
          "fitComp",
          "findFootage",
          "removeUnused"
        ]
      },
      {
        id: "layerActions",
        name: { kind: "translation", key: "layerActions" },
        iconId: "layers",
        visible: true,
        toolSlots: [
          "duplicateLayer",
          "linkParent",
          "unlinkParent",
          "moveUp",
          "moveDown",
          "reverseOrder",
          "soloLayers"
        ]
      },
      {
        id: "animationTime",
        name: { kind: "translation", key: "animationTime" },
        iconId: "curve",
        visible: true,
        toolSlots: [
          "addKeyframe",
          "graphEditor",
          "steppedAnimation",
          "loopAnimation",
          "sequenceAnimation",
          "timeOffset",
          "easingControl"
        ]
      },
      {
        id: "textShapes",
        name: { kind: "translation", key: "textShapes" },
        iconId: "text",
        visible: true,
        toolSlots: [
          "newText",
          "textLayout",
          "splitText",
          "rectangle",
          "circle",
          "star",
          "path"
        ]
      },
      {
        id: "effectsPresets",
        name: { kind: "translation", key: "effectsPresets" },
        iconId: "effects",
        visible: true,
        toolSlots: [
          "effects",
          "adjust",
          "quickPreset",
          "layerStyles",
          "linkEffects",
          "audioResponse",
          "moreTools"
        ]
      }
    ]
  }
];
```

Move the tool icon map out of `HomePage.tsx` into `HOME_TOOL_CATALOG`, and create `HOME_GROUP_ICON_CATALOG`. Export React icon components only from `catalog.tsx`; keep stored data as string IDs.

- [ ] **Step 5: Add layout-name translation keys**

Extend `UiCopy.settings.home`:

```ts
layoutNames: {
  creativeGeneral: string;
};
```

Add `creativeGeneral` to all five language dictionaries.

- [ ] **Step 6: Run catalog and translation tests**

Run:

```powershell
npm.cmd run test -- --run tests/homeLayoutCatalog.test.ts tests/translations.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/homeLayouts/types.ts src/homeLayouts/catalog.tsx src/i18n/types.ts src/i18n/translations.ts src/pages/HomePage.tsx tests/homeLayoutCatalog.test.ts
git commit -m "feat: define homepage layout catalog"
```

---

### Task 2: Replace the incorrect count-based storage model

**Files:**
- Modify: `src/settings/types.ts`
- Rewrite: `src/settings/homeSettingsStorage.ts`
- Modify: `src/settings/SettingsProvider.tsx`
- Test: `tests/homeSettingsStorage.test.ts`

**Interfaces:**
- Consumes: `HomeLayout` and `BUILT_IN_CREATIVE_LAYOUT_ID` from Task 1.
- Produces:
  - `HomeSettings`
  - `DEFAULT_HOME_SETTINGS`
  - `normalizeHomeSettings(value)`
  - `readStoredHomeSettings(storage?)`
  - `writeStoredHomeSettings(settings, storage?)`
  - `getActiveHomeLayout(settings)`

- [ ] **Step 1: Replace storage tests with the desired state model**

```ts
it("falls back to the built-in layout when stored data is corrupt", () => {
  const storage = new MemoryStorage();
  storage.setItem(HOME_SETTINGS_STORAGE_KEY, "{broken");

  expect(readStoredHomeSettings(storage)).toEqual(DEFAULT_HOME_SETTINGS);
});

it("drops the unfinished count-based fields during normalization", () => {
  const normalized = normalizeHomeSettings({
    activeLayoutId: "missing-layout",
    customLayouts: [],
    fixedToolCount: 20,
    customShortcutSlots: 12
  });

  expect(normalized.activeLayoutId).toBe(BUILT_IN_CREATIVE_LAYOUT_ID);
  expect(normalized).not.toHaveProperty("fixedToolCount");
  expect(normalized).not.toHaveProperty("customShortcutSlots");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npm.cmd run test -- --run tests/homeSettingsStorage.test.ts
```

Expected: FAIL because the current model still contains fixed-count fields.

- [ ] **Step 3: Replace `HomeSettings`**

Use:

```ts
export interface HomeSettings {
  activeLayoutId: string;
  customLayouts: HomeLayout[];
  rememberPanelModes: boolean;
  defaultCreateMode: HomeCreateMode;
  defaultSpaceMode: HomeSpaceMode;
  createMode: HomeCreateMode;
  spaceMode: HomeSpaceMode;
}
```

Remove:

```ts
fixedToolCount
customShortcutSlots
toolGroupOrder
visibleToolGroups
hiddenToolIds
```

- [ ] **Step 4: Normalize stored layouts safely**

Implement normalization rules:

```ts
const normalizedCustomLayouts = normalizeCustomLayouts(candidate.customLayouts);
const activeLayoutExists =
  candidate.activeLayoutId === BUILT_IN_CREATIVE_LAYOUT_ID ||
  normalizedCustomLayouts.some((layout) => layout.id === candidate.activeLayoutId);

return {
  activeLayoutId: activeLayoutExists
    ? candidate.activeLayoutId
    : BUILT_IN_CREATIVE_LAYOUT_ID,
  customLayouts: normalizedCustomLayouts,
  rememberPanelModes,
  defaultCreateMode,
  defaultSpaceMode,
  createMode: rememberPanelModes ? createMode : defaultCreateMode,
  spaceMode: rememberPanelModes ? spaceMode : defaultSpaceMode
};
```

For every imported or stored group, normalize `toolSlots` to exactly seven entries:

```ts
const slots = Array.from({ length: HOME_GROUP_SLOT_COUNT }, (_, index) =>
  isKnownToolId(candidate.toolSlots?.[index])
    ? candidate.toolSlots[index]
    : null
);
```

- [ ] **Step 5: Keep provider behavior stable**

Update `SettingsProvider` to persist the new `HomeSettings` unchanged through its existing `updateHomeSettings` and `resetHomeSettings` interface. Do not change general settings, theme, density, language, or update providers.

- [ ] **Step 6: Run storage tests**

Run:

```powershell
npm.cmd run test -- --run tests/homeSettingsStorage.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/settings/types.ts src/settings/homeSettingsStorage.ts src/settings/SettingsProvider.tsx tests/homeSettingsStorage.test.ts
git commit -m "refactor: store complete homepage layouts"
```

---

### Task 3: Add pure layout-management operations

**Files:**
- Create: `src/homeLayouts/layoutOperations.ts`
- Test: `tests/homeLayoutOperations.test.ts`

**Interfaces:**
- Consumes: `HomeSettings`, `HomeLayout`, `HomeLayoutGroup`.
- Produces:
  - `createCustomLayout(settings, input)`
  - `duplicateLayout(settings, layoutId, input)`
  - `renameLayout(settings, layoutId, name, now)`
  - `deleteLayout(settings, layoutId)`
  - `setActiveLayout(settings, layoutId)`
  - `addLayoutGroup(settings, layoutId, group)`
  - `updateLayoutGroup(settings, layoutId, groupId, patch)`
  - `duplicateLayoutGroup(settings, layoutId, groupId, newGroupId)`
  - `deleteLayoutGroup(settings, layoutId, groupId)`
  - `moveLayoutGroup(settings, layoutId, sourceId, targetId)`
  - `setToolSlot(settings, layoutId, groupId, slotIndex, toolId)`
  - `moveToolSlot(settings, layoutId, groupId, sourceIndex, targetIndex)`
  - `normalizeLayoutName(name)`
  - `isDuplicateLayoutName(settings, name, excludedLayoutId?)`

- [ ] **Step 1: Write failing operation tests**

```ts
it("creates a named custom copy without mutating the built-in layout", () => {
  const next = duplicateLayout(DEFAULT_HOME_SETTINGS, BUILT_IN_CREATIVE_LAYOUT_ID, {
    id: "custom:motion",
    name: "  MG 动画  ",
    now: "2026-09-24T10:00:00.000Z"
  });

  expect(next.activeLayoutId).toBe("custom:motion");
  expect(next.customLayouts[0].name).toEqual({
    kind: "custom",
    value: "MG 动画"
  });
  expect(next.customLayouts[0].groups).toHaveLength(5);
  expect(BUILT_IN_HOME_LAYOUTS[0].kind).toBe("built-in");
});

it("deleting the active custom layout returns to the built-in layout", () => {
  const created = createCustomLayout(DEFAULT_HOME_SETTINGS, {
    id: "custom:blank",
    name: "空白",
    source: "blank",
    blankGroupName: "工具组 1",
    now: "2026-09-24T10:00:00.000Z"
  });

  expect(deleteLayout(created, "custom:blank").activeLayoutId)
    .toBe(BUILT_IN_CREATIVE_LAYOUT_ID);
});

it("rejects duplicate names after trimming and case folding", () => {
  const created = createCustomLayout(DEFAULT_HOME_SETTINGS, {
    id: "custom:first",
    name: "Motion",
    source: "blank",
    now: "2026-09-24T10:00:00.000Z"
  });

  expect(isDuplicateLayoutName(created, " motion ")).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- --run tests/homeLayoutOperations.test.ts
```

Expected: FAIL because layout operations do not exist.

- [ ] **Step 3: Implement immutable operations**

Use helper guards:

```ts
function requireCustomLayout(settings: HomeSettings, layoutId: string) {
  const layout = settings.customLayouts.find((item) => item.id === layoutId);
  if (!layout) throw new Error("CUSTOM_LAYOUT_NOT_FOUND");
  return layout;
}

export function normalizeLayoutName(name: string): string {
  return name.trim().slice(0, 24);
}
```

All operations must return new objects and arrays. Never mutate `BUILT_IN_HOME_LAYOUTS`.

Blank layouts start with one visible empty group and seven `null` slots so the user has an immediate editing target. The UI passes the localized first-group name through `blankGroupName`; the operation layer must not hard-code Chinese.

- [ ] **Step 4: Add group and slot mutation tests**

```ts
it("keeps every group at eight compact slots while replacing and moving tools", () => {
  const created = createCustomLayout(DEFAULT_HOME_SETTINGS, {
    id: "custom:test",
    name: "测试",
    source: "blank",
    now: "2026-09-24T10:00:00.000Z"
  });
  const replaced = setToolSlot(
    created,
    "custom:test",
    created.customLayouts[0].groups[0].id,
    0,
    "newText"
  );

  expect(replaced.customLayouts[0].groups[0].toolSlots).toHaveLength(7);
  expect(replaced.customLayouts[0].groups[0].toolSlots[0]).toBe("newText");
});
```

- [ ] **Step 5: Run operation tests**

Run:

```powershell
npm.cmd run test -- --run tests/homeLayoutOperations.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/homeLayouts/layoutOperations.ts tests/homeLayoutOperations.test.ts
git commit -m "feat: add homepage layout operations"
```

---

### Task 4: Rewrite layout import and export around one complete layout

**Files:**
- Rewrite: `src/settings/homeLayoutPreset.ts`
- Test: `tests/homeLayoutPreset.test.ts`

**Interfaces:**
- Consumes: `HomeLayout`, catalog validators, `normalizeLayoutName`.
- Produces:
  - `HomeLayoutPreset`
  - `createHomeLayoutPreset(layout, exportedAt?)`
  - `parseHomeLayoutPreset(source, input)`

- [ ] **Step 1: Write failing preset tests**

```ts
it("exports one layout without unrelated application settings", () => {
  const preset = createHomeLayoutPreset(customLayout, "2026-09-24T10:00:00.000Z");
  const json = JSON.stringify(preset);

  expect(preset.layout.groups.every((group) => group.toolSlots.length === 8))
    .toBe(true);
  expect(json).not.toContain("theme");
  expect(json).not.toContain("language");
  expect(json).not.toContain("apiKey");
  expect(json).not.toContain("createMode");
});

it("turns unknown imported tools into empty slots", () => {
  const imported = parseHomeLayoutPreset(
    JSON.stringify({
      schemaVersion: 1,
      product: "NYAWORKS",
      layout: {
        ...customLayout,
        groups: [{
          ...customLayout.groups[0],
          toolSlots: ["unknown-tool"]
        }]
      }
    }),
    {
      id: "custom:imported",
      now: "2026-09-24T10:00:00.000Z",
      existingNames: []
    }
  );

  expect(imported.groups[0].toolSlots).toEqual([
    null, null, null, null, null, null, null
  ]);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- --run tests/homeLayoutPreset.test.ts
```

Expected: FAIL because the current preset exports the obsolete full `HomeSettings`.

- [ ] **Step 3: Implement the preset envelope**

```ts
export interface HomeLayoutPreset {
  schemaVersion: 1;
  product: "NYAWORKS";
  exportedAt: string;
  layout: Omit<HomeLayout, "id" | "kind" | "createdAt" | "updatedAt">;
}
```

`parseHomeLayoutPreset()` must:

- reject a wrong product or schema,
- normalize the imported name,
- reject duplicate names with `DUPLICATE_HOME_LAYOUT_NAME`,
- assign the caller-provided new ID and timestamps,
- force `kind: "custom"`,
- normalize unknown icon IDs to `"folder"`,
- normalize unknown tool IDs to `null`,
- normalize every group to eight compact slots.

- [ ] **Step 4: Run preset tests**

Run:

```powershell
npm.cmd run test -- --run tests/homeLayoutPreset.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/settings/homeLayoutPreset.ts tests/homeLayoutPreset.test.ts
git commit -m "feat: import and export homepage layouts"
```

---

### Task 5: Build reusable NYAWORKS layout dialogs and menus

**Files:**
- Create: `src/components/TextInputDialog.tsx`
- Create: `src/components/CompactActionMenu.tsx`
- Create: `src/components/IconPickerDialog.tsx`
- Modify: `src/styles.css`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Test: `tests/textInputDialog.test.tsx`
- Test: `tests/compactActionMenu.test.tsx`
- Test: `tests/iconPickerDialog.test.tsx`

**Interfaces:**
- Consumes: `AppDialog`, `HOME_GROUP_ICON_CATALOG`, current theme tokens.
- Produces:
  - `TextInputDialog`
  - `CompactActionMenu`
  - `IconPickerDialog`

- [ ] **Step 1: Write failing dialog markup tests**

```tsx
it("renders a project-styled input with inline validation", () => {
  const markup = renderToStaticMarkup(
    <TextInputDialog
      title="新建布局"
      value=""
      maxLength={24}
      error="请输入布局名称"
      confirmLabel="创建"
      cancelLabel="取消"
      onValueChange={() => undefined}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />
  );

  expect(markup).toContain('maxlength="24"');
  expect(markup).toContain("请输入布局名称");
  expect(markup).not.toContain("prompt(");
});
```

- [ ] **Step 2: Run component tests and verify RED**

Run:

```powershell
npm.cmd run test -- --run tests/textInputDialog.test.tsx tests/compactActionMenu.test.tsx tests/iconPickerDialog.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the text dialog**

`TextInputDialog` must render a controlled `<input>` inside `AppDialog`, submit on Enter, cancel on Escape through the existing dialog behavior, and disable confirm when `value.trim()` is empty or `error` is non-null.

- [ ] **Step 4: Implement the compact action menu**

Use this item contract:

```ts
export interface CompactActionMenuItem {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}
```

The menu must:

- stay within the trigger width or explicitly supplied width,
- close after a successful selection,
- close on Escape or outside pointer-down,
- expose disabled actions without allowing selection,
- reuse the established dark popover styling.

- [ ] **Step 5: Implement the icon picker**

Render `HOME_GROUP_ICON_CATALOG` as a compact grid of icon-only buttons with Tooltip labels. The selected icon uses `data-active="true"` and theme accent tokens.

- [ ] **Step 6: Add five-language copy**

Add exact labels for:

- new layout,
- copy current layout,
- blank layout,
- rename,
- delete,
- change icon,
- duplicate group,
- layout/group validation messages,
- replace tool,
- remove tool,
- imported layout errors.

- [ ] **Step 7: Run component and translation tests**

Run:

```powershell
npm.cmd run test -- --run tests/textInputDialog.test.tsx tests/compactActionMenu.test.tsx tests/iconPickerDialog.test.tsx tests/translations.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/components/TextInputDialog.tsx src/components/CompactActionMenu.tsx src/components/IconPickerDialog.tsx src/styles.css src/i18n/types.ts src/i18n/translations.ts tests/textInputDialog.test.tsx tests/compactActionMenu.test.tsx tests/iconPickerDialog.test.tsx tests/translations.test.ts
git commit -m "feat: add homepage layout editing controls"
```

---

### Task 6: Rebuild the Home settings page as a layout editor

**Files:**
- Rewrite: `src/pages/HomeSettingsPanel.tsx`
- Modify: `src/settings/SettingsProvider.tsx`
- Modify: `src/styles.css`
- Test: `tests/homeSettingsPanel.test.tsx`
- Test: `tests/settingsSelect.test.tsx`

**Interfaces:**
- Consumes: layout operations from Task 3, preset functions from Task 4, dialog/menu components from Task 5.
- Produces: a complete layout-management UI and provider action surface used by `HomePage`.

- [ ] **Step 1: Write failing settings-panel structure tests**

```tsx
it("renders the compact layout selector instead of icon-count controls", () => {
  const markup = renderHomeSettingsPanel();

  expect(markup).toContain('aria-label="当前布局"');
  expect(markup).toContain('aria-label="新建布局"');
  expect(markup).toContain('aria-label="布局操作"');
  expect(markup).not.toContain("固定工具数量");
  expect(markup).not.toContain("自定义快捷位");
});

it("renders five seven-slot groups for the creative layout", () => {
  const markup = renderHomeSettingsPanel({ initialEditing: true });

  expect(markup.match(/data-home-layout-group="true"/g)).toHaveLength(5);
  expect(markup.match(/data-home-layout-slot="true"/g)).toHaveLength(35);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd run test -- --run tests/homeSettingsPanel.test.tsx tests/settingsSelect.test.tsx
```

Expected: FAIL because the current page still renders count selectors and the obsolete global group model.

- [ ] **Step 3: Expose atomic layout actions from `SettingsProvider`**

Add provider methods:

```ts
setActiveHomeLayout(layoutId: string): void;
createHomeLayout(input: CreateLayoutInput): void;
renameHomeLayout(layoutId: string, name: string): void;
deleteHomeLayout(layoutId: string): void;
updateHomeLayout(nextLayout: HomeLayout): void;
importHomeLayout(layout: HomeLayout): void;
```

Each method must call the pure operations from Task 3 and then persist through the existing provider effect.

- [ ] **Step 4: Replace the top layout section**

Render:

```tsx
<div className="home-layout-selector-row">
  <SettingSelect
    value={homeSettings.activeLayoutId}
    ariaLabel={labels.currentLayout}
    options={layoutOptions}
    onChange={setActiveHomeLayout}
  />
  <button aria-label={labels.newLayout}><Plus /></button>
  <button aria-label={labels.layoutActions}><DotsThree /></button>
</div>
```

Remove the fixed-tool and custom-slot selects completely.

- [ ] **Step 5: Implement create, copy, rename, and delete flows**

- New layout opens `TextInputDialog` and allows “copy current” or “blank”.
- Copy current opens the same dialog with a generated localized suggestion such as `创作通用 副本`.
- Rename is disabled for built-in layouts.
- Delete is disabled for built-in layouts and uses `AppDialog` confirmation for custom layouts.
- Right-clicking the layout selector opens the same action menu as the `···` button.

- [ ] **Step 6: Implement group editing**

For custom layouts:

- section header `＋` adds a group through `TextInputDialog`,
- row `···` opens rename/change icon/duplicate/delete,
- drag handle and arrow buttons reorder groups,
- eye button controls group visibility,
- expanded group renders exactly eight slots.

For the built-in layout:

- rows can be inspected,
- any editing action first opens the copy-layout flow,
- no mutation is written to the built-in catalog.

- [ ] **Step 7: Implement slot editing**

Each slot renders:

```tsx
<button
  data-home-layout-slot="true"
  data-empty={toolId === null || undefined}
  onClick={() => openToolPicker(group.id, slotIndex)}
  onContextMenu={(event) => openSlotMenu(event, group.id, slotIndex)}
>
  {toolId ? <ToolIcon /> : <Plus />}
</button>
```

The tool picker writes one known tool ID into the selected slot. The context menu provides replace and remove. Drag-and-drop reorders slots within the current group.

- [ ] **Step 8: Keep the nine-grid section unchanged**

Retain:

- remember last mode,
- default create/select,
- default anchor/align.

Do not place these values in a layout preset.

- [ ] **Step 9: Run settings tests**

Run:

```powershell
npm.cmd run test -- --run tests/homeSettingsPanel.test.tsx tests/settingsSelect.test.tsx tests/homeLayoutOperations.test.ts tests/homeLayoutPreset.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/pages/HomeSettingsPanel.tsx src/settings/SettingsProvider.tsx src/styles.css tests/homeSettingsPanel.test.tsx tests/settingsSelect.test.tsx
git commit -m "feat: build homepage layout editor"
```

---

### Task 7: Render the active layout on the homepage

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `tests/homePageLayout.test.tsx`

**Interfaces:**
- Consumes: `getActiveHomeLayout()`, `HOME_TOOL_CATALOG`, shared layout labels, and the settings-entry behavior already present in `App.tsx`.
- Produces: a homepage whose title and five-by-seven default tool structure follow the active layout.

- [ ] **Step 1: Replace count assertions with active-layout assertions**

```tsx
it("renders the built-in layout name and all forty fixed slots", () => {
  const markup = renderHomePage();

  expect(markup).toContain("<h2>创作通用</h2>");
  expect(markup.match(/data-home-layout-group="true"/g)).toHaveLength(5);
  expect(markup.match(/data-home-layout-slot="true"/g)).toHaveLength(35);
  expect(markup).not.toContain("自定义快捷");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- --run tests/homePageLayout.test.tsx
```

Expected: FAIL because the homepage still truncates groups using `fixedToolCount`.

- [ ] **Step 3: Render the active layout**

Replace the current filtering and count logic with:

```ts
const activeLayout = getActiveHomeLayout(homeSettings);
const layoutName = getHomeLayoutLabel(activeLayout.name, copy);
const visibleGroups = activeLayout.groups.filter((group) => group.visible);
```

Render `layoutName` as the section `<h2>`. Render each group and all eight slots in stored order. A `null` slot renders a disabled empty “＋” placeholder until the user edits it from settings.

- [ ] **Step 4: Preserve the direct edit entry**

Keep:

```tsx
<HomePage onEditLayout={() => openSettings("home", true)} />
```

When the active layout is built-in, the settings editor must show the protected state and start the copy-before-edit flow only when the user performs the first mutation.

- [ ] **Step 5: Run homepage and App integration tests**

Run:

```powershell
npm.cmd run test -- --run tests/homePageLayout.test.tsx tests/settingsSelect.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/pages/HomePage.tsx src/App.tsx src/styles.css tests/homePageLayout.test.tsx tests/settingsSelect.test.tsx
git commit -m "feat: render selected layout on homepage"
```

---

### Task 8: Documentation, responsive review, and full verification

**Files:**
- Modify: `README.md`
- Modify: `planning/02-roadmap.md`
- Modify: `src/i18n/translations.ts`
- Modify: `src/styles.css`
- Test: `tests/translations.test.ts`
- Test: `tests/homeLayoutStyles.test.js`

**Interfaces:**
- Consumes: all completed layout-system behavior.
- Produces: documented, built, smoke-tested browser candidate.

- [ ] **Step 1: Update documentation**

README must state:

- “创作通用” is the protected built-in layout.
- The homepage displays five groups with eight slots each by default.
- Custom layouts support create/copy/rename/delete.
- Groups support create/copy/rename/icon/reorder/delete.
- Layouts can be imported and exported.
- Tool execution and external resource binding remain staged where not implemented.

Remove all references to:

- fixed tool count,
- custom shortcut count,
- global hidden-tool lists.

- [ ] **Step 2: Run five-language text checks**

Extend `tests/translations.test.ts`:

```ts
for (const languageId of LANGUAGE_IDS) {
  const home = UI_COPY[languageId].settings.home;
  expect(home.currentLayout).toBeTruthy();
  expect(home.newLayout).toBeTruthy();
  expect(home.layoutActions).toBeTruthy();
  expect(home.renameLayout).toBeTruthy();
  expect(home.deleteLayout).toBeTruthy();
  expect(home.newGroup).toBeTruthy();
  expect(home.changeGroupIcon).toBeTruthy();
}
```

Run:

```powershell
npm.cmd run test -- --run tests/translations.test.ts
```

Expected: PASS.

- [ ] **Step 3: Add and run narrow-panel style guards**

Add a style guard before the full run:

```js
it("keeps long layout and group names inside the narrow panel", () => {
  expect(styles).toMatch(/\.shortcut-heading h2\s*\{[^}]*min-width:\s*0/s);
  expect(styles).toMatch(/\.shortcut-heading h2\s*\{[^}]*text-overflow:\s*ellipsis/s);
  expect(styles).toMatch(/\.home-group-setting > span\s*\{[^}]*min-width:\s*0/s);
  expect(styles).toMatch(/\.home-group-setting > span\s*\{[^}]*text-overflow:\s*ellipsis/s);
});
```

Run:

```powershell
npm.cmd run test -- --run tests/homeLayoutStyles.test.js
```

Expected: PASS.

- [ ] **Step 4: Run the full automated verification**

Run:

```powershell
npm.cmd run verify
```

Expected:

- TypeScript succeeds.
- Every Vitest file passes.
- Vite production build succeeds.
- `smoke:dist` reports all required files/assets.

- [ ] **Step 5: Perform browser visual and interaction checks at 493px**

Verify in `http://127.0.0.1:4174/`:

1. “创作通用” shows five groups and 35 tool slots.
2. The layout selector is `[layout ▼] [＋] [···]`.
3. New/copy/rename dialogs use NYAWORKS styling.
4. Built-in rename/delete actions are disabled.
5. A custom layout can add, rename, icon-change, reorder, and delete a group.
6. Every group stays at eight slots.
7. Import/export/restore controls are icon-only with Tooltip.
8. No horizontal scrollbar exists at 493px.
9. Chinese, Traditional Chinese, English, Japanese, and Korean do not visibly overflow.
10. Theme, language, general settings, About page, and update controls still behave as before.

- [ ] **Step 6: Record the host-validation boundary**

Document that browser tests validate React, storage, styling, and interactions only. Real AE CEP-host validation remains required for extension loading, host bridge behavior, panel resizing, Windows/macOS paths, and AE 2018–2026 compatibility.

- [ ] **Step 7: Commit**

```powershell
git add README.md planning/02-roadmap.md src/i18n/translations.ts src/styles.css tests/translations.test.ts tests/homeLayoutStyles.test.js
git commit -m "docs: finalize homepage layout workflow"
```

- [ ] **Step 8: Review the complete branch**

Run:

```powershell
git status --short
git diff --check HEAD~8..HEAD
git log --oneline -8
```

Expected: no unintended files, no whitespace errors, and a readable sequence of layout-system commits.
