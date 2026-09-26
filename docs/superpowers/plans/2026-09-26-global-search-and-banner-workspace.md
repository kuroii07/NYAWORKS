# 全局搜索与 Banner 工具工作区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页实现统一搜索、双击执行和 Banner 工具工作区，同时保持下方九宫格布局完全独立。

**Architecture:** 新增 `src/search/` 作为统一搜索索引与排序层，合并内置工具、资源 Provider 缓存和当前 AE 效果；新增受控宿主动作接口，浏览器开发环境使用明确 fixture。首页只组合 `GlobalSearchPanel` 与 `BannerWorkspace`，Banner 状态独立于 HomeLayout，不把资源扫描或执行逻辑塞进 `HomePage.tsx`。

**Tech Stack:** React 18、TypeScript、Vite、Phosphor Icons、Vitest、CEP `evalScript` / ExtendScript。

**Spec:** `docs/superpowers/specs/2026-09-26-global-search-and-banner-workspace-design.md`

## Global Constraints

- 全局搜索结果每行默认只显示图标和名称；单击选中，双击或 Enter 执行。
- Banner 默认显示品牌 Banner；右键选择工具后替换为轻量工具面板；不增加第二套九宫格。
- 效果只读取当前打开的 AE；不扫描其他 AE 版本。
- 搜索浮层和 Banner 切换不得改变下方九宫格布局高度或状态。
- 资源扫描、宿主调用和 React UI 必须保持分层；不得在组件中散落 ExtendScript。
- 所有新增文案进入五语言 `src/i18n/`，禁止组件内硬编码用户可见文字。
- 未在真实 CEP/AE 中验证的动作，只能标记为 fixture/未连接，不得声称完成宿主验收。
- 每个增量至少运行相关 Vitest；最终运行 `npm.cmd run verify`。

## Review Focus

- 空输入与无结果：搜索浮层应保持紧凑并显示明确空状态，不撑开首页。
- 资源/效果同名：结果仍只显示名称，必要时使用最短后缀区分，不重复展示详情。
- AE 未连接、无选中图层、失效资源路径：执行失败必须有反馈，不能静默无响应。
- 双击与 Enter 重复触发：同一条结果的动作必须去重或串行化。
- Banner 切换/返回默认：容器尺寸稳定、无闪烁，下方九宫格状态不变。

---

### Task 1: 建立统一搜索数据模型与匹配排序

**Files:**
- Create: `src/search/types.ts`
- Create: `src/search/searchOperations.ts`
- Create: `src/search/toolSearchCatalog.ts`
- Test: `tests/globalSearchOperations.test.ts`

**Interfaces:**
- Consumes: `HOME_TOOL_CATALOG`, `UiCopy["home"].toolLabels`, `IndexedResource`, future host effect records.
- Produces: `GlobalSearchItem`, `GlobalSearchItemKind`, `GlobalSearchIndex`, `buildGlobalSearchIndex`, `searchGlobalItems`, `groupGlobalSearchItems`.

- [ ] **Step 1: Write the failing tests**

Add tests for: exact match before prefix/contains match; Chinese aliases; grouping by `tool/script/preset/effect/expression`; empty query returning a bounded recent/default list; duplicate names using only a short display suffix; stable ordering for equal scores.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd run test -- tests/globalSearchOperations.test.ts`

Expected: FAIL because `src/search/*` does not exist.

- [ ] **Step 3: Implement the search model and operations**

Define `GlobalSearchItem` with `id`, `kind`, `name`, `aliases`, `searchableText`, `iconKey`, `action`, optional `sourceId/resourceId`, `requiresHost`, `opensBanner`, and optional `displaySuffix`. Implement normalized matching and the fixed ranking order from the spec. Keep only one copy of each result in its best-fit group.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm.cmd run test -- tests/globalSearchOperations.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search tests/globalSearchOperations.test.ts
git commit -m "feat: add global search index operations"
```

### Task 2: Add current-AE effect discovery and controlled host actions

**Files:**
- Modify: `src/host/cepBridge.ts`
- Create: `src/host/globalSearchBridge.ts`
- Modify: `public/host/index.jsx`
- Modify: `src/resources/developmentResourceService.ts`
- Test: `tests/globalSearchBridge.test.ts`

**Interfaces:**
- Consumes: existing `evaluateHostScript`, `CepEnvironment`, resource type normalization.
- Produces: `HostEffectItem`, `GlobalSearchHostBridge`, `readCurrentAeEffects()`, `executeGlobalSearchAction()`.

- [ ] **Step 1: Write failing bridge tests**

Cover unavailable CEP, malformed JSON, normalized effect records, script action encoding, preset action encoding, effect action encoding, and the no-selected-layer host response.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd run test -- tests/globalSearchBridge.test.ts`

Expected: FAIL because the bridge interface and host functions are not defined.

- [ ] **Step 3: Implement the bridge and ExtendScript endpoints**

Add `NYAWORKS.getCurrentEffects()` using the currently running AE effect collection and return only normalized name/match-name records. Add controlled action endpoints for running an indexed script, applying an `.ffx` preset to selected layers, and adding an effect to selected layers. Encode all paths and effect match names; never interpolate raw user input into an ExtendScript call. Extend the development resource fixture with deterministic effects and action results.

- [ ] **Step 4: Run bridge tests and existing host tests**

Run: `npm.cmd run test -- tests/globalSearchBridge.test.ts tests/cepBridge.test.ts tests/resourceBridge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/host src/resources/developmentResourceService.ts public/host/index.jsx tests/globalSearchBridge.test.ts
git commit -m "feat: expose current AE effects and search actions"
```

### Task 3: Merge search sources through a provider hook

**Files:**
- Create: `src/search/GlobalSearchProvider.tsx`
- Modify: `src/main.tsx`
- Modify: `src/resources/ResourceProvider.tsx`
- Modify: `src/homeLayouts/catalog.tsx`
- Test: `tests/globalSearchProvider.test.tsx`

**Interfaces:**
- Consumes: Task 1 index operations, Task 2 host bridge, `useResources`, `HOME_TOOL_CATALOG`.
- Produces: `GlobalSearchProvider`, `useGlobalSearch`, `refreshEffects`, `executeItem(item)`.

- [ ] **Step 1: Write failing provider tests**

Assert that built-in tools, cached local resources, and fixture effects are merged; resource refresh changes search results; effect refresh is explicit; unavailable host state does not remove built-in tools; executing a resource delegates to the correct bridge action.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd run test -- tests/globalSearchProvider.test.tsx`

Expected: FAIL because the provider and hook do not exist.

- [ ] **Step 3: Implement the provider**

Mount it inside `ResourceProvider` and before `App`. Rebuild the in-memory index when home labels, resources, or effect records change. Keep the search provider independent from page navigation and HomeLayout persistence. Expose host status and action feedback without rendering source/path metadata in each result row.

- [ ] **Step 4: Run provider and resource regression tests**

Run: `npm.cmd run test -- tests/globalSearchProvider.test.tsx tests/resourceProvider.test.tsx tests/homeLayoutCatalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/search/GlobalSearchProvider.tsx src/main.tsx src/resources/ResourceProvider.tsx src/homeLayouts/catalog.tsx tests/globalSearchProvider.test.tsx
git commit -m "feat: merge home resources into global search"
```

### Task 4: Implement compact global search UI and keyboard behavior

**Files:**
- Create: `src/components/GlobalSearchPanel.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Modify: `src/styles.css`
- Test: `tests/globalSearchPanel.test.tsx`
- Test: `tests/globalSearchStyles.test.js`

**Interfaces:**
- Consumes: `useGlobalSearch`, existing `MagnifyingGlass`, theme/density/motion tokens.
- Produces: compact search field/floating result panel with `onOpen`, `onClose`, `onExecute` behavior.

- [ ] **Step 1: Write failing component and style tests**

Cover read/write input, Ctrl/⌘+K, Escape, arrow navigation, single-click selection, double-click execution, grouped results, empty state, no-results state, bounded scrolling, and assertions that result rows contain only icon/name markup.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm.cmd run test -- tests/globalSearchPanel.test.tsx tests/globalSearchStyles.test.js`

Expected: FAIL because the interactive search panel and selectors do not exist.

- [ ] **Step 3: Implement the search panel**

Replace the current `readOnly` input with a controlled input. Keep the existing search frame size, render results in an absolutely positioned panel, and use `data-selected` for keyboard selection. Double-click and Enter call one execution path with a guard against rapid duplicate execution. Add translated labels for search status, empty state, no results, and host/layer errors.

- [ ] **Step 4: Run focused tests and home regressions**

Run: `npm.cmd run test -- tests/globalSearchPanel.test.tsx tests/globalSearchStyles.test.js tests/homePageLayout.test.tsx tests/homeSettingsPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GlobalSearchPanel.tsx src/pages/HomePage.tsx src/i18n src/styles.css tests/globalSearchPanel.test.tsx tests/globalSearchStyles.test.js
git commit -m "feat: add compact home global search"
```

### Task 5: Implement Banner default/tool workspace and context menu

**Files:**
- Create: `src/components/BannerWorkspace.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/search/toolSearchCatalog.ts`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Modify: `src/styles.css`
- Test: `tests/bannerWorkspace.test.tsx`
- Test: `tests/bannerWorkspaceStyles.test.js`

**Interfaces:**
- Consumes: `HomeToolDefinition`, `useGlobalSearch`, existing `AppDialog`/`CompactActionMenu` patterns, `useSettings` home banner setting.
- Produces: `BannerWorkspace` with default/tool states, right-click selection, reset-to-default action, and stable-height transition.

- [ ] **Step 1: Write failing Banner tests**

Cover default brand state, context-menu open and selection, current selection checkmark, tool panel rendering for at least one parameterized tool, reset action, no second grid, hidden decorative pager/caret when unused, and preservation of home layout state.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm.cmd run test -- tests/bannerWorkspace.test.tsx tests/bannerWorkspaceStyles.test.js`

Expected: FAIL because `BannerWorkspace` and its state model do not exist.

- [ ] **Step 3: Implement Banner state and menu**

Add a local `bannerSelection` state (`default` or a known `ToolId`) in `HomePage`, pass it to `BannerWorkspace`, and keep it independent from layout editing and tool drag state. Right-click opens a compact menu with default, built-in, recent, and favorite tools; selecting a tool replaces the Banner content. Render only the tool’s core controls, not a second tool grid. Add a translated reset tooltip/action.

- [ ] **Step 4: Connect search execution to Banner**

When a search item has `opensBanner`, select that tool in `BannerWorkspace`; simple tools continue through the direct execution path. Keep search overlay close/selection behavior deterministic.

- [ ] **Step 5: Run Banner and home regression tests**

Run: `npm.cmd run test -- tests/bannerWorkspace.test.tsx tests/bannerWorkspaceStyles.test.js tests/homePageLayout.test.tsx tests/pointerReorder.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/BannerWorkspace.tsx src/pages/HomePage.tsx src/search/toolSearchCatalog.ts src/i18n src/styles.css tests/bannerWorkspace.test.tsx tests/bannerWorkspaceStyles.test.js
git commit -m "feat: add banner tool workspace"
```

### Task 6: Documentation, roadmap, visual fixture review, and full verification

**Files:**
- Modify: `README.md`
- Modify: `planning/02-roadmap.md`
- Create: `docs/screenshots/home-global-search.png`
- Create: `docs/screenshots/home-banner-tool-workspace.png`
- Test: `tests/globalSearchTranslations.test.ts`

**Interfaces:**
- Consumes: completed search and Banner UI from Tasks 1–5.
- Produces: accurate roadmap/documentation and browser evidence clearly separated from real CEP/AE validation.

- [ ] **Step 1: Add translation coverage test**

Assert every new search/Banner key exists in all five language bundles and no new user-visible key falls back to hardcoded Chinese.

- [ ] **Step 2: Capture browser fixture screenshots and inspect them**

Run the Vite preview with the development resource/effect fixture. Capture default Banner, right-click menu, selected tool Banner, search results, no-results state, and narrow density. Reject overflow, layout jumps, duplicated grids, or stale placeholder wording.

- [ ] **Step 3: Update README and roadmap**

Mark only the browser/search/Banner work proven by tests as complete. Keep real script execution, preset application, effect insertion, and current-AE discovery as CEP/AE host validation items until tested in an actual AE installation.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run smoke:dist
npm.cmd run verify
```

Expected: all commands pass; `dist/CSXS/manifest.xml` exists; `git diff --check` is clean.

- [ ] **Step 5: Commit documentation and verification**

```bash
git add README.md planning/02-roadmap.md docs/screenshots tests/globalSearchTranslations.test.ts
git commit -m "docs: document global search and banner workspace"
```

## Plan Self-Review

- **Spec coverage:** Search model, source merge, host effects/actions, UI, Banner state/menu, motion, i18n, errors, tests, and validation are covered by Tasks 1–6.
- **Step scan:** Every task has a failing-test step, implementation step, focused verification, and commit boundary; no step relies on an unspecified function body.
- **Type consistency:** Task 1 defines `GlobalSearchItem`; Task 2 defines `HostEffectItem` and `GlobalSearchHostBridge`; Task 3 consumes both; Tasks 4–5 consume `useGlobalSearch` and Banner selection callbacks.
- **Review focus coverage:** Empty/no-results and duplicate names are tested in Task 1/4; host/layer errors in Task 2/4; duplicate execution in Task 4; Banner stability and grid preservation in Task 5.
- **Proportion:** The plan intentionally separates search indexing, host bridge, search UI, and Banner UI because they have different failure boundaries and can be validated independently.

