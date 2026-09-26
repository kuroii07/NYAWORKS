# Local Resource Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build NYAWORKS phase-one local resource library: current-AE/default and custom sources, persisted index, Resource settings, and the new left-side Resource browsing page.

**Architecture:** Keep resource state isolated under `src/resources/`. `ResourceProvider` owns persisted custom sources, cached indexed resources, filters, favorites, and scan state; React views consume it without touching CEP directly. `src/host/resourceBridge.ts` is the only frontend-to-host adapter, while `public/host/index.jsx` discovers and scans only the currently active AE installation; browser development uses an explicit fixture adapter.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, existing NYAWORKS providers/components, CEP `evalScript` / ExtendScript.

**Spec:** `docs/superpowers/specs/2026-09-26-resource-library-system-design.md`

## Global Constraints

- Scope is only spec phase one; script execution, preset application, expression insertion, trusted-script management, generated local previews, and the cloud library remain explicitly unavailable.
- Only the current AE host contributes automatic default sources; never inspect or merge other AE installations.
- Custom sources are user-chosen directories and may point anywhere, including another AE version; scanning never deletes or modifies their files.
- React components must not access files or execute host scripts directly; use a controlled CEP/ExtendScript bridge and an explicit browser fixture.
- Persist custom sources, cached index, favorites, and user metadata independently from general, home, and AI settings; normalize corrupt data safely.
- Use `SettingSelect` for every settings-style choice control; do not introduce native `<select>` elements.
- Preserve five dark themes, five languages, three densities, current tooltip behavior, and a 520px panel without horizontal overflow.
- Feature controls whose host action is not implemented must show an honest disabled/planned state, never a fake success state.

## Review Focus

- Corrupt or pre-schema local resource data must recover to an empty, usable library without affecting unrelated settings; covered in Task 1 storage tests.
- A browser preview or unavailable CEP host must preserve cached resources and explain that a real scan needs AE; covered in Task 2 and Task 3 bridge/provider tests.
- Missing custom directories and a failed refresh must retain the last successful indexed items while marking the source unavailable; covered in Task 3 scan-state tests.
- Nested folders, unsupported extensions, and same-named files from different sources must retain their source/relative-path identity instead of silently collapsing; covered in Task 1 and Task 2 normalization tests.
- Dense localization, small density, keyboard menus, and reduced/off motion must not make the new source rows or resource browser inaccessible; covered in Task 5 markup/style tests and final visual checks.

---

### Task 1: Resource domain, storage, and deterministic index operations

**Files:**
- Create: `src/resources/types.ts`
- Create: `src/resources/resourceStorage.ts`
- Create: `src/resources/resourceOperations.ts`
- Test: `tests/resourceStorage.test.ts`
- Test: `tests/resourceOperations.test.ts`

**Interfaces:**
- Produces `ResourceType`, `ResourceSource`, `IndexedResource`, `ResourceIndexSnapshot`, `ResourceSettings`, `ResourceScanResult`, and `DEFAULT_RESOURCE_SETTINGS` from `src/resources/types.ts`.
- Produces `normalizeResourceSettings(value)`, `readStoredResourceSettings(storage?)`, and `writeStoredResourceSettings(settings, storage?)` from `src/resources/resourceStorage.ts`.
- Produces `createCustomResourceSource(input, now)`, `updateCustomResourceSource(settings, sourceId, patch)`, `removeCustomResourceSource(settings, sourceId)`, `mergeScanResult(settings, result, scannedAt)`, `toggleResourceFavorite(settings, resourceId)`, `filterIndexedResources(settings, query, type, sourceId?)`, and `buildResourceFolderTree(resources)` from `src/resources/resourceOperations.ts`.

- [ ] **Step 1: Write failing domain/storage tests**

Add tests that assert:

```ts
expect(readStoredResourceSettings()).toEqual(DEFAULT_RESOURCE_SETTINGS);
expect(normalizeResourceSettings({ schemaVersion: 999 })).toEqual(DEFAULT_RESOURCE_SETTINGS);
expect(createCustomResourceSource({ name: " 我的脚本 ", resourceType: "script", path: "C:/Tools" }, now).name).toBe("我的脚本");
```

Also assert an index item is uniquely identified by source ID plus normalized relative path, unsupported extensions are rejected by the scan-result normalizer, and removing a source removes only its cached index entries and favorites.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm.cmd run test -- tests/resourceStorage.test.ts tests/resourceOperations.test.ts`

Expected: FAIL because the resource modules do not exist.

- [ ] **Step 3: Implement versioned resource types and persistence**

In `src/resources/types.ts`, define resource kinds `script | panel | startup | preset | expression`, source kinds `ae-default | custom`, and source statuses `ready | scanning | missing | error | unavailable`. Keep automatic current-AE sources transient host data; persist only custom source definitions and the cached resource index/user metadata.

Implement storage using a dedicated `nyaworks.resources.v1` key. Trim names and paths, reject invalid resource types, preserve old valid cache on normalization, and never persist raw host error stacks.

- [ ] **Step 4: Implement pure source/index operations**

Implement immutable operations in `src/resources/resourceOperations.ts`. `mergeScanResult` must replace only the scanned source's indexed entries on success; on failed/missing scans it must retain its prior entries and update source status. `buildResourceFolderTree` must derive nested folders from each resource's relative path without storing a duplicate tree.

- [ ] **Step 5: Run domain tests to verify they pass**

Run: `npm.cmd run test -- tests/resourceStorage.test.ts tests/resourceOperations.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the resource domain increment**

```bash
git add src/resources/types.ts src/resources/resourceStorage.ts src/resources/resourceOperations.ts tests/resourceStorage.test.ts tests/resourceOperations.test.ts
git commit -m "feat: add resource source and index domain"
```

### Task 2: Controlled current-AE resource bridge and browser fixture

**Files:**
- Create: `src/host/resourceBridge.ts`
- Create: `src/resources/developmentResourceService.ts`
- Modify: `src/host/cepBridge.ts`
- Modify: `public/host/index.jsx`
- Test: `tests/resourceBridge.test.ts`

**Interfaces:**
- Consumes `ResourceSource`, `ResourceScanResult`, and `ResourceType` from Task 1.
- Produces `ResourceHostBridge` with `readCurrentAeSources()`, `scanSource(source)`, and `chooseDirectory()` in `src/host/resourceBridge.ts`.
- Produces `createDevelopmentResourceService()` returning the same bridge contract, with clearly labeled fixture sources/resources only in Vite development.

- [ ] **Step 1: Write failing bridge tests with mocked CEP runtime**

Assert that the bridge requests exactly `NYAWORKS.getCurrentResourceSources()`, handles unavailable/malformed host responses without throwing, and safely sends a structured source payload to the scan command. Assert the development service returns a current-host fixture with a non-empty version and never claims it read a real machine directory.

- [ ] **Step 2: Run the bridge tests to verify they fail**

Run: `npm.cmd run test -- tests/resourceBridge.test.ts`

Expected: FAIL because `resourceBridge.ts` and its host commands do not exist.

- [ ] **Step 3: Expose a reusable CEP evaluator and implement the typed bridge**

Export the minimal evaluator needed by feature bridges from `src/host/cepBridge.ts`; do not duplicate runtime detection. In `src/host/resourceBridge.ts`, parse only structured JSON response shapes and return `unavailable` / `error` results rather than raw errors. Encode host command payloads as JSON text before interpolation so source names and Windows paths cannot break `evalScript` syntax.

- [ ] **Step 4: Implement current-host discovery and directory scanning in ExtendScript**

Extend `public/host/index.jsx` with:

```js
NYAWORKS.getCurrentResourceSources()
NYAWORKS.scanResourceSource(encodedPayload)
NYAWORKS.chooseResourceDirectory()
```

Resolve only folders under the active `app.path`: `Scripts`, `Scripts/ScriptUI Panels`, `Scripts/Startup`, and `Presets`. Recursively enumerate only the approved extensions, return normalized relative paths and modification metadata, and return structured `missing` / `error` states. The folder chooser may use the host file-dialog capability, but React must never invoke a native browser chooser.

- [ ] **Step 5: Add the explicit development fixture**

Create fixture sources/resources that look like local examples but include `status: "unavailable"` or a visible development marker where host-only behavior would otherwise be implied. The production bridge must never fall back to these fixture paths.

- [ ] **Step 6: Run bridge tests to verify they pass**

Run: `npm.cmd run test -- tests/cepBridge.test.ts tests/resourceBridge.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the bridge increment**

```bash
git add src/host/cepBridge.ts src/host/resourceBridge.ts src/resources/developmentResourceService.ts public/host/index.jsx tests/resourceBridge.test.ts
git commit -m "feat: add current AE resource bridge"
```

### Task 3: Resource provider, scan lifecycle, and cached-state resilience

**Files:**
- Create: `src/resources/ResourceProvider.tsx`
- Test: `tests/resourceProvider.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes the Task 1 storage/operations and Task 2 `ResourceHostBridge`.
- Produces `ResourceProvider`, `useResources()`, and `ResourceContextValue` with `sources`, `resources`, `refreshAllSources()`, `refreshSource(sourceId)`, `addCustomSource(input)`, `updateCustomSource(sourceId, patch)`, `removeCustomSource(sourceId)`, `toggleFavorite(resourceId)`, and filter state.
- `main.tsx` supplies `createDevelopmentResourceService()` only when `import.meta.env.DEV`; production supplies the CEP bridge.

- [ ] **Step 1: Write failing provider lifecycle tests**

Render a provider with a fake bridge and assert it:

```ts
await context.refreshSource("custom:tools");
expect(context.sources.find((item) => item.id === "custom:tools")?.status).toBe("missing");
expect(context.resources.map((item) => item.id)).toContain("custom:tools:legacy.jsx");
```

Add cases for unavailable browser host, successful scan replacement, favorite persistence, and custom source removal without clearing unrelated sources.

- [ ] **Step 2: Run the provider tests to verify they fail**

Run: `npm.cmd run test -- tests/resourceProvider.test.tsx`

Expected: FAIL because `ResourceProvider` does not exist.

- [ ] **Step 3: Implement provider state and persistence boundaries**

Initialize custom definitions/cache from Task 1 storage, hydrate active current-AE sources from the bridge, and write only normalized non-sensitive settings to local storage. Keep current-host sources separate from persisted custom sources. Use cancellation/`isMounted` guards so an old scan response cannot update an unmounted page.

- [ ] **Step 4: Implement refresh behavior and failure preservation**

`refreshAllSources()` scans enabled current-host and custom sources one at a time, exposes per-source progress, and continues after one failure. A failed scan changes source status while retaining its last successful index. Browser-host absence must leave current cache visible and expose an honest host-unavailable state.

- [ ] **Step 5: Register the provider at the app root**

Wrap `App` with `ResourceProvider` inside existing theme/language/settings providers. Dependency injection must keep static markup tests able to supply a fake bridge without a real CEP runtime.

- [ ] **Step 6: Run provider and storage tests to verify they pass**

Run: `npm.cmd run test -- tests/resourceStorage.test.ts tests/resourceOperations.test.ts tests/resourceProvider.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the provider increment**

```bash
git add src/resources/ResourceProvider.tsx src/main.tsx tests/resourceProvider.test.tsx
git commit -m "feat: add resource scan state provider"
```

### Task 4: Resource settings panel and source-management dialogs

**Files:**
- Create: `src/pages/ResourceSettingsPanel.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Test: `tests/resourceSettingsPanel.test.tsx`
- Test: `tests/resourceTranslations.test.ts`

**Interfaces:**
- Consumes `useResources()` from Task 3 and existing `AppDialog`, `SettingSelect`, `CompactActionMenu`, `TextInputDialog`, and Tooltip patterns.
- Produces `ResourceSettingsPanel` rendered for `activeTab === "resources"`; `SettingsPlaceholder` remains only for any still-unimplemented settings tab.
- Adds `UiCopy.settings.resources` and all navigation/resource copy for five languages.

- [ ] **Step 1: Write failing rendering and translation tests**

Assert simplified-Chinese markup includes separate “当前 AE 内置来源” and “我的资源来源” regions, one `SettingSelect`-backed resource-type control, “更新资源索引”, source status text, and no native `<select>`. Test every locale supplies non-empty resource settings copy and a concise `navigation.resources` label.

- [ ] **Step 2: Run settings/translation tests to verify they fail**

Run: `npm.cmd run test -- tests/resourceSettingsPanel.test.tsx tests/resourceTranslations.test.ts`

Expected: FAIL because the resource panel and copy contract do not exist.

- [ ] **Step 3: Implement source display and scan controls**

Render current-AE sources as read-only, expandable rows with host version, truncated path, count, state and more menu. Render custom sources with the same visual grammar plus edit, enable/disable, refresh and remove actions. The top-level scan action calls `refreshAllSources()` and exposes a local progress/summary state.

- [ ] **Step 4: Implement add/edit custom-source flow**

Use NYAWORKS dialogs for source type and name; call `chooseDirectory()` only after the user requests a folder. Validate blank names/paths and duplicate custom-source IDs before persistence. If the host chooser is unavailable, leave the dialog open with a translated host-only explanation instead of inventing a path input that works only in browser preview.

- [ ] **Step 5: Replace the resource placeholder and verify tab behavior**

In `SettingsPage`, render `ResourceSettingsPanel` for the resources tab. Preserve the existing AI dirty-tab guard, home editor entry, settings navigation icon order, and all other settings panels.

- [ ] **Step 6: Run panel and related settings tests to verify they pass**

Run: `npm.cmd run test -- tests/resourceSettingsPanel.test.tsx tests/resourceTranslations.test.ts tests/settingsSelect.test.tsx tests/aiSettingsNavigation.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit resource settings UI**

```bash
git add src/pages/ResourceSettingsPanel.tsx src/pages/SettingsPage.tsx src/i18n/types.ts src/i18n/translations.ts tests/resourceSettingsPanel.test.tsx tests/resourceTranslations.test.ts
git commit -m "feat: add resource source settings"
```

### Task 5: Left navigation and local resource browser

**Files:**
- Create: `src/pages/ResourcesPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/types/navigation.ts`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Test: `tests/resourcePage.test.tsx`
- Test: `tests/navigation.test.ts`
- Test: `tests/resourceStyles.test.js`

**Interfaces:**
- Consumes `useResources()` from Task 3 and all resource copy from Task 4.
- Produces `ResourcesPage` and `RESOURCE_NAVIGATION_ID` / exported navigation ordering helpers required by tests.
- `App` renders `ResourcesPage` for the new `resources` page ID rather than `PlaceholderPage`.

- [ ] **Step 1: Write failing navigation and page tests**

Assert navigation contains `resources` immediately after `media`, the simplified-Chinese sidebar label is “资源”, and the Resource route renders search, type filters, source/category entry, index status, and grouped resource content. Assert scripts render as list rows and preview-capable fixture items render resource cards; an unavailable action has a disabled/planned state rather than a success button.

- [ ] **Step 2: Run navigation/page tests to verify they fail**

Run: `npm.cmd run test -- tests/navigation.test.ts tests/resourcePage.test.tsx`

Expected: FAIL because the resource page ID and component do not exist.

- [ ] **Step 3: Add the resource page route and sidebar destination**

Add `resources` after `media` to startup/page IDs, sidebar item order, translation types and every language bundle. Choose one existing Phosphor linear storage/resource icon and use it consistently in sidebar, page sections and source rows. Keep all existing page IDs, startup-page normalization and last-page storage backward compatible.

- [ ] **Step 4: Implement resource browsing, folders, and filters**

`ResourcesPage` owns only view state: search string, type, selected source/folder and expanded directory branch. Use Task 1's derived folder tree and filter operation; do not write a second index/filter implementation in the page. At 520px, expose source/category navigation as a compact selector/drawer plus breadcrumb rather than a permanently wide tree column.

- [ ] **Step 5: Implement adaptive resource presentation and honest actions**

Render scripts, panels and startup items as compact rows. Render only items with `preview.coverUri` as three-column cards; all other presets/expressions remain clean type cards/list items. Add favorite, copy path, reveal source and refresh affordances; actions requiring unimplemented host commands must be disabled with translated explanatory tooltips.

- [ ] **Step 6: Add reduced-motion and narrow-style tests**

Add CSS/markup assertions that preview media does not autoplay when `data-motion="reduced"` or `off`, the browser has no fixed secondary sidebar at narrow width, and source/category controls retain accessible labels. These tests satisfy the Review Focus accessibility case; actual cross-language/visual review remains in Task 7.

- [ ] **Step 7: Run page/navigation/style tests to verify they pass**

Run: `npm.cmd run test -- tests/navigation.test.ts tests/resourcePage.test.tsx tests/resourceStyles.test.js`

Expected: PASS.

- [ ] **Step 8: Commit resource browsing UI**

```bash
git add src/pages/ResourcesPage.tsx src/App.tsx src/components/Sidebar.tsx src/types/navigation.ts src/i18n/types.ts src/i18n/translations.ts tests/resourcePage.test.tsx tests/navigation.test.ts tests/resourceStyles.test.js
git commit -m "feat: add local resource browser"
```

### Task 6: Resource visual polish, documentation, and complete validation

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`
- Modify: `planning/02-roadmap.md`
- Create: `docs/screenshots/resources-local-library.png`
- Create: `docs/screenshots/settings-resources.png`
- Test: `tests/resourceSettingsStyles.test.js`

**Interfaces:**
- Consumes page class names and data attributes from Tasks 4–5.
- Produces responsive, theme-token-only resource styles and accurate project documentation distinguishing browser/fixture proof from real CEP/AE validation.

- [ ] **Step 1: Write failing style/documentation checks**

Add a style test that asserts resource settings/source rows and resource browser styles use NYAWORKS tokens, include 520px-safe narrow rules, expose status/focus states, and contain a static-cover fallback for all preview-capable cards. Extend README assertions only if existing test conventions make that practical; otherwise list it as a manual review item in the task verification.

- [ ] **Step 2: Run the style test to verify it fails**

Run: `npm.cmd run test -- tests/resourceSettingsStyles.test.js`

Expected: FAIL because resource style selectors do not exist.

- [ ] **Step 3: Implement resource visual system**

Add scoped `.resources-*` and `.resource-settings-*` CSS using existing tokens, radii, tooltip spacing and density breakpoints. Keep scan feedback local, use cyan only for selection/progress/primary action, use warnings only for missing/error states, and avoid nested heavy cards. Provide keyboard focus styles and static cover behavior; do not implement video playback or fake animated previews in this phase.

- [ ] **Step 4: Capture browser fixture screenshots and inspect them**

Run the Vite preview with the explicit development resource fixture, capture the local resource page and resource settings page, inspect both at default/small density and at least simplified-Chinese plus English. Reject any screenshot with overflow, cropped menus, misleading host-connected language, or unreadable source rows.

- [ ] **Step 5: Update documentation and roadmap accurately**

Document the new source/index/browser capabilities, the “current host only” rule, and the fact that real AE discovery/scan/action validation remains a separate host test. Do not claim script execution, generated previews, cloud catalog, or multi-version auto-discovery. Mark only the phase-one planning/implementation items actually completed.

- [ ] **Step 6: Run focused and full verification**

Run:

```bash
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run smoke:dist
```

Expected: all commands pass. Then inspect `git diff --check` and verify the generated `dist/CSXS/manifest.xml` remains present.

- [ ] **Step 7: Commit documentation and verification increment**

```bash
git add src/styles.css README.md planning/02-roadmap.md docs/screenshots/resources-local-library.png docs/screenshots/settings-resources.png tests/resourceSettingsStyles.test.js
git commit -m "docs: document local resource library"
```

## Spec Coverage Review

- Resource/function-page split, current-host-only discovery, custom directories, cached index, source states, and source management are implemented by Tasks 1–4.
- Sidebar placement, source/category navigation, adaptive list/card display, favorites, and planned action states are implemented by Task 5.
- Theme, localization, density, reduced-motion, screenshot review, README/roadmap accuracy, and build checks are implemented by Task 6.
- Dynamic local previews and cloud catalog are intentionally excluded from this plan because the confirmed spec classifies them as later independent phases. Their data fields and static-cover fallback are retained so later plans do not require a UI rewrite.
