# Layer Localization and Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏已验收中文功能和旧工程的前提下，让 NYAWORKS 后续新建图层与伪效果能够按面板语言生成稳定、可验证的本地化名称。

**Architecture:** 保留现有 `UI → Action → Bridge → Host` 执行链，在 Bridge payload 中增加可选 `languageId`，由 Host 使用稳定对象/效果 ID 查找显示名称和伪效果模板。现有 `zh-CN` 路径、伪效果资产和参数契约作为冻结兼容基线；其他语言按能力矩阵逐项启用，不做一次性全量迁移。

**Tech Stack:** React 18, TypeScript, Vite, Vitest, CEP, ExtendScript/JSX, After Effects 2022–2026+；首轮真实验收以 Windows + After Effects 2025 为准。

**Spec:** `docs/superpowers/specs/2026-10-11-layer-localization-and-compatibility-design.md`

## Global Constraints

- `zh-CN` 是默认语言；旧 Bridge payload 缺少 `languageId` 时必须继续按 `zh-CN` 执行。
- 已有图层、效果实例、表达式和已发布中文 `.ffx` 不自动重命名、迁移、覆盖或重排参数。
- 稳定 `actionId`、`objectId/effectId`、schema 版本、marker、参数语义 ID 和内部匹配契约不能依赖翻译文本。
- 伪效果不可用或本地化资源未就绪时，必须在创建前失败或走现有安全回退；不得留下半成品图层。
- 不修改 AE 安装目录，不把 `PresetEffects.xml` 修改作为运行时或安装步骤。
- 真实 AE 2025 验收与浏览器、Mock、TypeScript、构建验证分开记录。
- 本计划只覆盖本地化与兼容性；不重做首页布局、Action Registry 或已验收中文伪效果。

## Review Focus

- 旧 payload 与中文输出：没有语言字段时，调整层和形状层必须保持当前名称、参数和表达式行为；测试归入 Task 1。
- 未完成语言模板：模板缺失时不能先创建图层再报错；测试归入 Task 3。
- 已有工程：切换面板语言或重新打开工程不能批量改名；测试归入 Task 2 和 Task 4。
- 表达式名称映射：本地化效果名变化时，表达式必须引用实际创建出的实例名和稳定参数索引；测试归入 Task 4。
- 长文本与能力矩阵：五语言名称不能导致面板溢出，未通过 AE 实机的语言不能显示为已支持；测试归入 Task 5。

---

### Task 1: Freeze the compatibility contract with RED tests

**Files:**
- Create: `tests/layerLocalizationContract.test.ts`
- Modify: `tests/layerCreationHost.test.js`
- Modify: `tests/layerShapeHost.test.js`
- Modify: `docs/testing/layer-creation-grid-ae-test.md`

**Interfaces:**
- Consumes: existing layer Action payloads, current `zh-CN` Host behavior, and the spec's stable ID rules.
- Produces: executable assertions for legacy payloads, exact Chinese baselines, and pre-creation failure behavior.

- [ ] **Step 1: Write failing contract tests**

  Assert that an omitted `languageId` selects `zh-CN`; existing adjustment and shape actions preserve their current names; existing pseudo-effect `matchName`, marker, parameter order and expression references remain unchanged; an unavailable locale template returns a structured failure before `layers.add*` is called.

- [ ] **Step 2: Run the focused tests to verify RED**

  Run: `npm.cmd test -- --run tests/layerLocalizationContract.test.ts tests/layerCreationHost.test.js tests/layerShapeHost.test.js`

  Expected: the new locale and pre-creation contract assertions fail because language-aware naming has not been introduced.

- [ ] **Step 3: Record the frozen baseline**

  Add exact current `zh-CN` names and pseudo-effect identities to the test fixture rather than deriving expected values from the implementation. Do not change production code in this task.

### Task 2: Add a shared display-name Catalog and optional language payload

**Files:**
- Create: `src/layers/layerDisplayNames.ts`
- Create: `src/layers/layerLanguage.ts`
- Modify: `src/actions/executors.ts`
- Modify: `src/host/layerBridge.ts`
- Modify: `public/host/index.jsx`
- Modify: `src/i18n/languages.ts` only if a shared type export is required
- Test: `tests/layerLocalizationContract.test.ts`

**Interfaces:**
- Consumes: `LanguageId` and existing layer Action execution options.
- Produces: `resolveLayerLanguage(languageId?: LanguageId): LanguageId`, `getLayerDisplayName(objectId, languageId)`, and an optional encoded Host field `languageId` with a `zh-CN` default.

- [ ] **Step 1: Implement the smallest Catalog needed by ordinary layers**

  Add entries for text, solid, shape, adjustment, null, camera, light, precompose and unprecompose. Keep display text separate from `actionId`; use the current Chinese strings as the exact `zh-CN` values and add reviewed values for `zh-TW`, `en`, `ja` and `ko`.

- [ ] **Step 2: Implement language normalization**

  Accept only the existing five `LanguageId` values. Treat missing, malformed or unsupported values as `zh-CN`. Do not read AE's UI language.

- [ ] **Step 3: Pass language through the existing execution chain**

  Extend the existing options/payload without changing the public Action IDs. Keep old callers source-compatible and keep `HomePage.tsx` free of direct Host calls.

- [ ] **Step 4: Run focused tests to verify GREEN**

  Run: `npm.cmd test -- --run tests/layerLocalizationContract.test.ts tests/layerCreationHost.test.js tests/layerShapeHost.test.js`

  Expected: ordinary-layer names resolve by language; omitted language reproduces the frozen Chinese baseline.

### Task 3: Localize ordinary layer creation with adjustment-layer regression coverage

**Files:**
- Modify: `public/host/index.jsx`
- Modify: `tests/layerCreationHost.test.js`
- Modify: `docs/testing/layer-creation-grid-ae-test.md`
- Modify: `docs/current-feature-inventory.md`

**Interfaces:**
- Consumes: `resolveLayerLanguage()` and `getLayerDisplayName()` from Task 2.
- Produces: ordinary layer creators that use localized names while preserving timing, insertion, selection, Undo and no-effect behavior.

- [ ] **Step 1: Route adjustment-layer naming first**

  Replace only the hard-coded adjustment base name with the Catalog result. Preserve full-comp size, selected-range timing, insert-above-selection, unique suffixing, selected-only result and no effects.

- [ ] **Step 2: Add RED coverage for all ordinary layer names**

  Add one test per object ID for `zh-CN` and at least one non-Chinese language. Assert only the name changes; geometry, timing, parent/selection behavior and effect lists remain unchanged.

- [ ] **Step 3: Implement the remaining ordinary names incrementally**

  Update text, solid, shape, null, camera, light and precompose names through the same helper. Do not touch geometry or pseudo-effect expression code in this task.

- [ ] **Step 4: Run the ordinary-layer regression set**

  Run: `npm.cmd test -- --run tests/layerCreationHost.test.js tests/layerShapeHost.test.js tests/layerLocalizationContract.test.ts`

  Expected: all ordinary names are localized, and `zh-CN` output remains byte-for-byte equivalent wherever the test fixture captures it.

- [ ] **Step 5: Perform the first AE 2025 acceptance**

  In one clean Windows / Chinese AE 2025 session, verify adjustment creation, duplicate-name suffixing, selection range, insertion position, Undo and save/reopen. Record this separately from the automated result.

### Task 4: Add locale-aware pseudo-effect Catalog without changing the Chinese baseline

**Files:**
- Modify: `public/host/pseudo-effects/catalog.json`
- Modify: `public/host/index.jsx`
- Create: `assets/pseudo-effects/<shape>/v<version>/<locale>/schema.json` for each newly enabled locale
- Create: `public/host/pseudo-effects/<locale>/<artifact>.ffx` for each newly enabled locale
- Modify: `tests/pseudoEffectAssets.test.js`
- Modify: `tests/layerShapeHost.test.js`
- Create: `tests/pseudoEffectLocalization.test.js`

**Interfaces:**
- Consumes: stable `effectId`, schema version and `languageId` from Tasks 2–3.
- Produces: a Catalog lookup that can resolve a localized template without overwriting the current flat `zh-CN` assets.

- [ ] **Step 1: Define the locale-aware Catalog contract**

  Add tests for locale, artifact path, `matchName`, marker, parameter IDs, parameter order, types, defaults and ranges. Assert the existing four Chinese entries remain unchanged.

- [ ] **Step 2: Run the asset tests to verify RED**

  Run: `npm.cmd test -- --run tests/pseudoEffectLocalization.test.js tests/pseudoEffectAssets.test.js`

  Expected: new locale lookup tests fail because only the frozen Chinese entries exist.

- [ ] **Step 3: Implement lookup and preflight**

  Resolve `(effectId, schemaVersion, languageId)` before creating a shape layer. If a locale is not ready, return a structured `pseudo-template-locale-unavailable` result before mutation. Keep the existing Chinese fallback path only where the current Host already guarantees safe fallback, and return an explicit warning when it is used.

- [ ] **Step 4: Add one locale at a time**

  Start with `en`, then `zh-TW`, `ja`, and `ko` only after each asset's byte presence, signature and parameter contract pass. Do not copy a Chinese FFX and merely rename its display text.

- [ ] **Step 5: Run shape and asset regression tests**

  Run: `npm.cmd test -- --run tests/pseudoEffectLocalization.test.js tests/pseudoEffectAssets.test.js tests/layerShapeHost.test.js`

  Expected: Chinese shape behavior is unchanged; ready locales resolve their own artifact and unready locales fail before a layer is created.

### Task 5: Make expressions use the actual localized effect instance

**Files:**
- Modify: `public/host/index.jsx`
- Modify: `tests/layerShapeHost.test.js`
- Modify: `tests/pseudoEffectLocalization.test.js`

**Interfaces:**
- Consumes: the resolved pseudo-effect contract and the effect instance name returned after `applyPreset()`.
- Produces: expression builders that use the actual instance display name plus stable parameter indices, while preserving old Chinese expressions.

- [ ] **Step 1: Write failing expression tests**

  Create a localized mock effect name containing quotes or non-ASCII text and assert the generated expression references the escaped actual name, not `Nya 圆角矩形` or another fixed Chinese literal. Assert parameter indices remain the Catalog values.

- [ ] **Step 2: Run the expression tests to verify RED**

  Run: `npm.cmd test -- --run tests/layerShapeHost.test.js tests/pseudoEffectLocalization.test.js`

  Expected: the expression still contains a hard-coded Chinese effect name.

- [ ] **Step 3: Implement name capture and safe expression encoding**

  After the pseudo effect is applied and renamed, read the actual instance name, escape it for the expression string and pass it to the existing geometry/style expression builders. Keep the stable parameter ID/index mapping in the Catalog; do not parse translated labels at runtime.

- [ ] **Step 4: Test failure cleanup**

  Assert that an expression assignment error removes only the new layer/effect created by the current Undo Group and leaves existing layers untouched.

- [ ] **Step 5: Run shape regression and typecheck**

  Run: `npm.cmd test -- --run tests/layerShapeHost.test.js tests/pseudoEffectLocalization.test.js`

  Run: `npm.cmd run typecheck`

  Expected: all localized expression tests pass and no existing Bridge types regress.

### Task 6: CEP language UX, documentation and acceptance matrix

**Files:**
- Modify: `src/i18n/translations.ts`
- Modify: `src/pages/HomePage.tsx` only for localized feedback if required by existing Action copy
- Modify: `src/styles.css` only for language-length overflow fixes
- Create: `docs/testing/layer-localization-ae-test.md`
- Modify: `docs/current-feature-inventory.md`
- Modify: `planning/02-roadmap.md`

**Interfaces:**
- Consumes: localized ordinary-layer names, pseudo-effect capability status and structured Host warnings.
- Produces: a five-language UI status that does not claim unsupported locales are ready and an AE 2025 acceptance record.

- [ ] **Step 1: Add failure and fallback copy**

  Localize `pseudo-template-locale-unavailable`, `pseudo-effect-fallback`, and generic layer-creation errors through the existing i18n resources. Do not expose filesystem paths or stack traces in user-facing copy.

- [ ] **Step 2: Add overflow regression cases**

  Cover the longest layer/effect labels in the existing panel fixture or DOM tests. Assert buttons, tooltips and status text remain readable in all five languages.

- [ ] **Step 3: Write the real AE acceptance matrix**

  Record Windows version, AE exact version, AE UI language, NYAWORKS panel language, clean/new project state, each ordinary layer, each ready pseudo-effect locale, missing-template behavior, Undo, keyframes, duplicate names, save/reopen and extension refresh. Keep browser/Host automation results in separate columns.

- [ ] **Step 4: Run repository verification**

  Run: `npm.cmd run typecheck`

  Run: `npm.cmd run test`

  Run: `npm.cmd run build`

  Run: `npm.cmd run smoke:dist`

  Existing historical failures must be listed separately; a new failure introduced by localization blocks completion.

- [ ] **Step 5: Update status only after AE evidence**

  Mark a language ready only when its assets, expressions and real AE checks pass. Keep the adjustment layer marked as automated-complete / AE-pending until the user confirms the Windows / Chinese AE 2025 test.

### Task 7: Release-safe review and commit

**Files:**
- Review only the files owned by Tasks 1–6.
- Exclude: `assets/pseudo-effects/rounded-rectangle/v6/`, `docs/pseudo-effects/`, `docs/superpowers/plans/2026-10-07-pseudo-effect-infrastructure.md`, `docs/superpowers/specs/2026-10-07-pseudo-effect-infrastructure-design.md`, `tests/pseudoEffect*.test.js`, and `tools/` unless a later task explicitly adopts them.

- [ ] **Step 1: Inspect the diff and whitespace**

  Run: `git diff --check` and `git status --short --branch`. Confirm unrelated user changes remain untouched.

- [ ] **Step 2: Re-run the narrow and release checks**

  Repeat the focused localization/layer tests, `npm.cmd run typecheck`, `npm.cmd run build` and `npm.cmd run smoke:dist`.

- [ ] **Step 3: Commit only the approved increment**

  Suggested message after implementation and user AE confirmation: `feat: localize layer creation contracts`.

  Documentation-only updates may use: `docs: define layer localization compatibility`.

- [ ] **Step 4: Push only after explicit authorization**

  Push the reviewed commit to `origin/main`; report the exact commit, remote result, and any intentionally uncommitted pseudo-effect experiments.

## Current Handoff

This plan is documentation for future implementation. The current round does not enable new languages, rename existing objects, or alter pseudo-effect assets. The next code change should begin at Task 1, then proceed through ordinary layers before touching pseudo-effect templates.
