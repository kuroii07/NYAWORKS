# NYAWORKS Layer Creation Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页新建图层九宫格接入真实 AE Action，并提供可复用的文本、纯色、形状、调整层、空对象、摄像机、灯光、预合成与安全解预合成能力。

**Architecture:** 沿用现有 `UI → Action Service → Registry → Host Executor → Bridge → ExtendScript` 链路。九宫格只识别按钮和修饰键；选中状态、时间范围、插入层级、效果控件、父子关系与 Undo 全部由 Host 侧统一处理。预合成与解预合成使用稳定 Action ID，供后续首页独立入口、合成功能页、全局搜索和 Nya Pie 复用。

**Tech Stack:** React 18、TypeScript 5.6、Vitest、Adobe CEP、ExtendScript / After Effects Host API、Phosphor Icons

**Spec:** `docs/superpowers/specs/2026-10-04-layer-creation-grid-design.md`

## Global Constraints

- 目标环境为 After Effects 2022–2026+，Windows 优先，同时考虑 macOS。
- 中文 AE 与 English AE 均不得依赖本地化显示名称实现核心判断。
- React 组件不得直接调用 AE DOM 或拼接 `evalScript`。
- 所有 AE 工程修改必须在一个 Host Undo Group 内完成。
- 无选中时创建到最上方并覆盖 `displayStartTime → displayStartTime + duration`。
- 单选时插入选中层上方并匹配该层时间范围。
- 多选时插入最上方选中层上方并匹配最早 `inPoint →` 最晚 `outPoint`。
- 预合成和解预合成必须是通用 Action，不能在九宫格内保存独立业务逻辑。
- 解预合成遇到不能安全保真的复杂场景必须拒绝执行，不得留下部分结果。
- 用户可见文本覆盖简中、繁中、英文、日文、韩文。

## Review Focus

- 活动项目项不是合成时，九个 Action 都应返回 `no-active-comp` 且不创建任何项目内容。
- 合成起始时间不是 0 时，无选中创建必须从 `displayStartTime` 开始而不是写死 0。
- 多选图层索引顺序与选择数组顺序不同，仍应插入到视觉最上方选中层之前。
- 建立 Null / Camera 父子关系时，被控图层的合成画面位置不得跳动。
- 解预合成包含 3D、时间重映射、折叠变换、外层效果或非默认变换时必须返回可解释的安全拒绝。

---

### Task 1: Layer Action Model and Registry

**Files:**
- Create: `src/actions/layerActionTypes.ts`
- Create: `src/actions/definitions/layerActions.ts`
- Modify: `src/actions/types.ts`
- Modify: `src/actions/registry.ts`
- Test: `tests/layerActions.test.ts`
- Modify: `tests/actionService.test.ts`

**Interfaces:**
- Consumes: existing `NyaActionDefinition`, `ActionRunOptions`, `coreActionRegistry`.
- Produces: `LAYER_ACTIONS`, `LayerAction`, `LayerActionModifier`, `getLayerActionId()`, `isLayerAction()`, and `ActionRunOptions.layerModifier`.

- [ ] **Step 1: Write failing action-definition tests**

Assert that the grid order is exactly:

```ts
[
  "layer.createText",
  "layer.createSolid",
  "layer.createShape",
  "layer.createAdjustment",
  "layer.createNull",
  "layer.createCameraRig",
  "layer.createLight",
  "layer.precomposeSelected",
  "layer.unprecomposeSelected"
]
```

Also assert that create Actions require `host,activeComp`, precompose Actions additionally require `selectedLayers`, all use command `runLayerAction`, all support Pie, and all declare `host-undo-group`.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm.cmd test -- --run tests/layerActions.test.ts tests/actionService.test.ts`

Expected: FAIL because layer Action types and definitions do not exist.

- [ ] **Step 3: Implement the layer Action types**

Define:

```ts
export const LAYER_ACTIONS = [
  "create-text",
  "create-solid",
  "create-shape",
  "create-adjustment",
  "create-null",
  "create-camera-rig",
  "create-light",
  "precompose-selected",
  "unprecompose-selected"
] as const;

export type LayerAction = (typeof LAYER_ACTIONS)[number];
export type LayerActionModifier = "none" | "alt" | "ctrl" | "shift";
export function getLayerActionId(action: LayerAction): string;
export function isLayerAction(value: unknown): value is LayerAction;
export function isLayerActionModifier(value: unknown): value is LayerActionModifier;
```

Extend `ActionRunOptions` with `layerModifier?: LayerActionModifier` without changing alignment behavior.

- [ ] **Step 4: Register localized definitions**

Create nine five-language Action definitions and add `LAYER_ACTION_DEFINITIONS` to `coreActionRegistry`. Store only `{ action }` in each execution payload; runtime modifier comes from `ActionRunOptions`.

- [ ] **Step 5: Prove runtime modifiers survive Action Service**

Add an `actionService.test.ts` case that calls:

```ts
service.run("layer.createShape", { layerModifier: "alt" })
```

and asserts the executor receives the same option exactly once.

- [ ] **Step 6: Run focused tests**

Run: `npm.cmd test -- --run tests/layerActions.test.ts tests/actionService.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/actions/layerActionTypes.ts src/actions/definitions/layerActions.ts src/actions/types.ts src/actions/registry.ts tests/layerActions.test.ts tests/actionService.test.ts
git commit -m "feat: register layer creation actions"
```

### Task 2: Layer Host Bridge and Executor Routing

**Files:**
- Create: `src/host/layerBridge.ts`
- Modify: `src/actions/executors.ts`
- Test: `tests/layerBridge.test.ts`
- Test: `tests/layerActionExecutor.test.ts`

**Interfaces:**
- Consumes: `LayerAction`, `LayerActionModifier`, `NyaActionDefinition`.
- Produces: `LayerHostBridge.runLayerAction(action, modifier)` and normalized `LayerHostActionResult`.

- [ ] **Step 1: Write failing Bridge tests**

Assert that `runLayerAction("create-shape", "alt")` calls:

```text
NYAWORKS.runLayerAction("<URL encoded JSON>")
```

with payload `{action:"create-shape",modifier:"alt"}`. Cover `null` CEP response, invalid JSON, success counts, and the allowlisted failure reasons from the spec.

- [ ] **Step 2: Write failing executor tests**

Assert that the executor:

- accepts only registered Layer Action payloads;
- rejects invalid runtime modifiers before Bridge execution;
- defaults missing modifier to `none`;
- maps Bridge `unavailable` to `host-unavailable`;
- preserves `createdLayers`, `updatedLayers`, `createdItems` and structured failure detail.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `npm.cmd test -- --run tests/layerBridge.test.ts tests/layerActionExecutor.test.ts`

Expected: FAIL because the Bridge and routing branch do not exist.

- [ ] **Step 4: Implement `LayerHostBridge`**

Define:

```ts
export type LayerHostFailureReason =
  | "unavailable"
  | "invalid-host-response"
  | "no-active-comp"
  | "no-selected-layer"
  | "invalid-selection"
  | "unsupported-layer-type"
  | "unsupported-precomp"
  | "unsafe-unprecompose"
  | "host-error";

export interface LayerHostBridge {
  runLayerAction(
    action: LayerAction,
    modifier: LayerActionModifier
  ): Promise<LayerHostActionResult>;
}
```

- [ ] **Step 5: Add `runLayerAction` routing to `createCepHostExecutor`**

Inject `LayerHostBridge` as a fourth optional dependency so existing Anchor and Alignment tests remain source-compatible. Validate definition payload and runtime options before invoking it.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm.cmd test -- --run tests/layerBridge.test.ts tests/layerActionExecutor.test.ts tests/alignmentActionExecutor.test.ts`

Run: `npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/host/layerBridge.ts src/actions/executors.ts tests/layerBridge.test.ts tests/layerActionExecutor.test.ts
git commit -m "feat: route layer actions to AE host"
```

### Task 3: Host Context and Basic Layer Creation

**Files:**
- Modify: `public/host/index.jsx`
- Create: `tests/layerCreationHost.test.js`
- Modify: `tests/hostScriptCompatibility.test.js`

**Interfaces:**
- Consumes: encoded `{action,modifier}` from Task 2.
- Produces: exported Host function `NYAWORKS.runLayerAction(encodedPayload)` and shared creation context helpers.

- [ ] **Step 1: Create a host-function loader and failing context tests**

Extract the layer Action section from `public/host/index.jsx` in a test harness. Cover:

- non-composition active item returns `no-active-comp`;
- no selection yields full range from non-zero `displayStartTime`;
- one selection yields its `inPoint/outPoint` and index;
- multiple selections use minimum `inPoint`, maximum `outPoint`, and minimum layer index regardless of selection array order.

- [ ] **Step 2: Run context tests and verify failure**

Run: `npm.cmd test -- --run tests/layerCreationHost.test.js`

Expected: FAIL because `runLayerAction` and context helpers do not exist.

- [ ] **Step 3: Implement the shared creation context**

Add focused helpers inside the Host IIFE:

```text
decodeLayerActionPayload(encodedPayload)
getLayerCreationContext()
applyLayerTiming(layer, context)
placeLayerAboveSelection(layer, context)
selectOnlyLayers(layers, comp)
```

Use `displayStartTime` and `duration`; never hardcode zero. Keep ExtendScript-compatible `var` and function syntax.

- [ ] **Step 4: Write failing tests for text, solid, adjustment, and light**

Assert:

- text content is `text`, uses `layers.addText`, and centers Anchor Point from `sourceRectAtTime` without setting `TextDocument.font`;
- solid uses `layers.addSolid([0,0,0], ...)`, comp dimensions/pixel aspect, and adds `ADBE Fill` with black color;
- adjustment creates a full-comp AVLayer and sets `adjustmentLayer = true`;
- light defaults to `LightType.POINT`, with Alt / Ctrl / Shift selecting spot / parallel / ambient;
- every action opens and closes exactly one Undo Group, applies timing, placement, and final selection.

- [ ] **Step 5: Implement the four basic actions and dispatcher allowlist**

Add:

```text
createTextLayer(context, modifier)
createSolidLayer(context, modifier)
createAdjustmentLayer(context, modifier)
createLightLayer(context, modifier)
runLayerAction(encodedPayload)
```

Do not assign a font in `createTextLayer`; `addText("text")` must allow AE to supply the most recently used or default font.

- [ ] **Step 6: Run Host tests**

Run: `npm.cmd test -- --run tests/layerCreationHost.test.js tests/hostScriptCompatibility.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- public/host/index.jsx tests/layerCreationHost.test.js tests/hostScriptCompatibility.test.js
git commit -m "feat: create basic AE layers"
```

### Task 4: Parameterized Shape Layer

**Files:**
- Modify: `public/host/index.jsx`
- Create: `tests/layerShapeHost.test.js`

**Interfaces:**
- Consumes: shared creation context from Task 3.
- Produces: `createShapeLayer(context, modifier)` with effect-control-backed geometry.

- [ ] **Step 1: Write failing shape tests**

Assert the normal action:

- creates one Shape Layer centered at `[comp.width / 2, comp.height / 2]`;
- leaves the layer Anchor Point at the rectangle center;
- defaults to width 500, height 500, roundness 50;
- creates Slider Controls for width, height, roundness and four corner percentages plus a Checkbox Control for separate corners;
- uses match names `ADBE Slider Control` and `ADBE Checkbox Control`;
- assigns an enabled path expression that references the stable custom control names.

Assert `Alt`, `Ctrl`, and `Shift` select circle, triangle, and star variants respectively.

- [ ] **Step 2: Run shape tests and verify failure**

Run: `npm.cmd test -- --run tests/layerShapeHost.test.js`

Expected: FAIL because Shape creation is missing.

- [ ] **Step 3: Implement the shape geometry**

Create a single focused Shape contents group. For the rounded rectangle, build a Bezier `Shape` path expression so the four corner percentage controls can affect individual corners while respecting the master roundness. Clamp width, height and roundness to valid non-negative geometry.

- [ ] **Step 4: Implement modifier variants**

- `none`: controlled rounded rectangle;
- `alt`: controlled ellipse;
- `ctrl`: controlled triangle;
- `shift`: controlled star.

Only expose controls used by the selected variant; do not add non-functional UI controls.

- [ ] **Step 5: Run shape and base Host tests**

Run: `npm.cmd test -- --run tests/layerShapeHost.test.js tests/layerCreationHost.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- public/host/index.jsx tests/layerShapeHost.test.js
git commit -m "feat: add controlled shape creation"
```

### Task 5: Null Controllers and Camera Rig

**Files:**
- Modify: `public/host/index.jsx`
- Create: `tests/layerControllerHost.test.js`

**Interfaces:**
- Consumes: shared context, timing, placement and selection helpers.
- Produces: `createNullLayer(context, modifier)` and `createCameraRig(context, modifier)`.

- [ ] **Step 1: Write failing Null tests**

Cover:

- every Null sets `guideLayer = true` and centers Anchor Point from its source dimensions;
- no selection creates one independent Null at comp center;
- one or many selected layers become children of one Null and keep visual position;
- multi-selection Null timing uses the union range;
- Alt creates one Null per selected layer;
- Shift creates a 3D Null;
- parented, locked or mixed 2D/3D inputs either succeed safely or return a structured reason without a partial hierarchy.

- [ ] **Step 2: Write failing Camera Rig tests**

Assert the default Action creates:

```text
Nya Camera Controller (3D, guide layer)
└── Nya Camera (35mm)
```

and selects only the controller. Assert controller controls use Slider / Angle / Checkbox match names for position XYZ, rotation XYZ, focal length, depth of field and focus-to-point. Assert camera properties reference the controller using expressions and the camera/controller timing matches.

- [ ] **Step 3: Run controller tests and verify failure**

Run: `npm.cmd test -- --run tests/layerControllerHost.test.js`

Expected: FAIL because controller actions do not exist.

- [ ] **Step 4: Implement Null creation and safe parenting**

Use `layer.parent = controller` rather than `setParentWithJump`, because AE's parent setter compensates transforms. Snapshot all target layers before mutation; if validation fails, return before creating controllers.

- [ ] **Step 5: Implement the 35mm camera rig**

Create the camera without opening AE UI. Set zoom from comp width and 35mm focal length using a 36mm horizontal film size. Put custom controls on the controller while leaving native Camera Options on the camera. Alt may create camera-only; undefined modifiers fall back to default and are not advertised in Tooltip.

- [ ] **Step 6: Run controller and base Host tests**

Run: `npm.cmd test -- --run tests/layerControllerHost.test.js tests/layerCreationHost.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- public/host/index.jsx tests/layerControllerHost.test.js
git commit -m "feat: add null and camera controllers"
```

### Task 6: Reusable Precompose and Safe Unprecompose

**Files:**
- Modify: `public/host/index.jsx`
- Create: `tests/layerPrecomposeHost.test.js`

**Interfaces:**
- Consumes: selected-layer context and generic layer Action dispatcher.
- Produces: reusable `precomposeSelected(context, modifier)` and `unprecomposeSelected(context, modifier)` Host actions.

- [ ] **Step 1: Write failing precompose tests**

Assert:

- no selection returns `no-selected-layer` before starting Undo;
- selected layer indices are sorted numerically before `layers.precompose`;
- default and Ctrl use `moveAllAttributes = true`;
- Alt uses `moveAllAttributes = false` only for a single valid layer, otherwise returns `invalid-selection`;
- the resulting precomp layer is selected and the result reports one created project item.

- [ ] **Step 2: Write failing unprecompose safety tests**

Accept exactly one selected AVLayer whose source is a CompItem. Reject before mutation when the outer precomp layer has any of:

- non-default Position, Anchor Point, Scale, Rotation, Orientation or Opacity;
- time remapping, stretch other than 100, reverse time or non-default time relation;
- masks, effects, parenting, 3D, collapse transformations or track-matte dependency;
- a source containing camera/light or unsupported cross-comp dependencies.

Assert every rejection returns `unsafe-unprecompose` with a short `detail` and leaves the parent comp untouched.

- [ ] **Step 3: Run precompose tests and verify failure**

Run: `npm.cmd test -- --run tests/layerPrecomposeHost.test.js`

Expected: FAIL because the two actions do not exist.

- [ ] **Step 4: Implement native precompose**

Generate a unique name from the top selected layer, call `layers.precompose`, find the resulting layer by source identity, and return structured counts.

- [ ] **Step 5: Implement transactional safe unprecompose**

Validate the complete operation first. Copy source layers in reverse order with `copyToComp`, restore order, offset timing relative to the precomp layer, then remove the original precomp only after all copies succeed. On an exception, remove newly copied layers before returning failure.

- [ ] **Step 6: Run precompose and Host regression tests**

Run: `npm.cmd test -- --run tests/layerPrecomposeHost.test.js tests/layerCreationHost.test.js tests/resourceHostActions.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- public/host/index.jsx tests/layerPrecomposeHost.test.js
git commit -m "feat: add reusable precompose actions"
```

### Task 7: Home Grid, Icons, Modifiers, Tooltips, and Legacy Migration

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/translations.ts`
- Modify: `src/homeLayouts/catalog.tsx`
- Modify: `src/settings/homeSettingsStorage.ts`
- Modify: `src/styles.css`
- Create: `src/actions/layerFeedback.ts`
- Create: `tests/homePageLayerActions.test.tsx`
- Modify: `tests/homePageLayout.test.tsx`
- Modify: `tests/homeSettingsStorage.test.ts`
- Modify: `tests/anchorActionIntegration.test.js`

**Interfaces:**
- Consumes: stable Action IDs and `ActionRunOptions.layerModifier`.
- Produces: functional nine-button grid and five-language user feedback without direct Bridge imports.

- [ ] **Step 1: Write failing grid order and routing tests**

Render the create mode and assert exactly nine active buttons in this order:

```text
text, solid, shape, adjustment, null, camera, light, precompose, unprecompose
```

Dispatch plain / Alt / Ctrl / Shift click events and assert each calls `actionService.run(actionId, {layerModifier})` exactly once. Dispatch `Alt+Ctrl+Shift` and assert it opens the button's compact variant menu without immediately executing an Action; selecting a menu item then runs the corresponding single modifier.

- [ ] **Step 2: Write failing Tooltip and accessibility tests**

Assert each active button has a localized label and only lists supported modifiers. Planned suffixes and `aria-disabled` must be absent from implemented create buttons. The inactive select layer remains non-focusable.

- [ ] **Step 3: Write failing legacy Tool ID migration tests**

Pass stored and imported layouts containing `threeDObject`; assert normalization replaces it with `unprecompose`, preserves slot position, and never emits the obsolete ID again.

- [ ] **Step 4: Run UI tests and verify failure**

Run: `npm.cmd test -- --run tests/homePageLayerActions.test.tsx tests/homePageLayout.test.tsx tests/homeSettingsStorage.test.ts`

Expected: FAIL on order, routing, copy and migration.

- [ ] **Step 5: Update tool identity, catalog and icons**

Replace `threeDObject` with `unprecompose` in `ToolId` and the visible catalog. Add a normalization alias for legacy persisted input before known-ID filtering. Use one consistent Phosphor icon per action and do not mix external icon packs.

- [ ] **Step 6: Add five-language labels, Tooltip copy and feedback**

Add localized Action failure copy for `no-active-comp`, `no-selected-layer`, `invalid-selection`, `unsupported-layer-type`, `unsupported-precomp`, `unsafe-unprecompose`, `host-unavailable`, and `host-error`. Tooltips must describe only behavior implemented by Tasks 3–6.

- [ ] **Step 7: Replace create placeholders with Action buttons**

Keep the existing animated 3×3 layer. Introduce a dedicated implemented Action button component instead of changing `PlannedToolButton` globally. A click with exactly one supported modifier executes that variant; `Alt+Ctrl+Shift` opens the existing compact menu with only the variants that button actually supports. Other multi-key combinations use the deterministic priority `shift`, `ctrl`, `alt`, then `none`; plain click remains the default behavior.

- [ ] **Step 8: Add HomePage feedback and architecture guard test**

On failure, show localized Toast and retain current mode. Update the integration test to require `getLayerActionId()` and prohibit importing `layerBridge` or calling `evalScript` from `HomePage.tsx`.

- [ ] **Step 9: Run UI tests and typecheck**

Run: `npm.cmd test -- --run tests/homePageLayerActions.test.tsx tests/homePageLayout.test.tsx tests/homeSettingsStorage.test.ts tests/anchorActionIntegration.test.js`

Run: `npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add -- src/pages/HomePage.tsx src/i18n/types.ts src/i18n/translations.ts src/homeLayouts/catalog.tsx src/settings/homeSettingsStorage.ts src/styles.css src/actions/layerFeedback.ts tests/homePageLayerActions.test.tsx tests/homePageLayout.test.tsx tests/homeSettingsStorage.test.ts tests/anchorActionIntegration.test.js
git commit -m "feat: activate layer creation grid"
```

### Task 8: Search Reuse, Documentation, Build, and AE Handoff

**Files:**
- Modify: `tests/globalSearchProvider.test.tsx`
- Create: `docs/references/xuanruyi-feature-reference.md`
- Create: `docs/testing/layer-creation-grid-ae-test.md`
- Modify: `README.md`
- Modify: `planning/02-roadmap.md`

**Interfaces:**
- Consumes: registered layer Actions and completed Host chain.
- Produces: search discoverability proof, full repository verification, and real-AE acceptance checklist.

- [x] **Step 1: Add global search reuse tests**

Assert searching localized titles discovers all nine stable Action IDs and executing precompose/unprecompose uses the shared Action Service without adding page-specific Host branches.

- [x] **Step 2: Run search tests**

Run: `npm.cmd test -- --run tests/globalSearchProvider.test.tsx tests/actionSearchAdapter.test.ts`

Expected: PASS after definitions are registered; if copy tokenization exposes a real gap, fix only the shared search adapter.

- [x] **Step 3: Write the real-AE acceptance document**

Cover AE version, UI language, OS, display scale, no/single/multi selection, non-zero comp start, Undo, text font inheritance, black Solid + Fill, shape controls, guide Nulls, 35mm Camera rig, light variants, precompose, safe unprecompose and every safety rejection.

- [x] **Step 4: Record the external feature reference**

Create `docs/references/xuanruyi-feature-reference.md` as a long-term reference baseline for every current and future NYAWORKS tool, not merely the layer-creation grid. Include the source URL `https://my.feishu.cn/wiki/Sxfcw2XldiRMXzkj9Ltc7FkencW`, access date, source categories (project, layer, composition, guides, animation, properties, text, graphics, effects, media, other tools and asset management), and a mandatory rule to consult the corresponding section before designing each future tool. Add a reusable per-tool ledger for `reference behavior → real AE use case → retained value → NYAWORKS upgrade → rejected clutter`, so later features are analyzed when they enter development rather than pretending that every source tool has already been reviewed. Use independently summarized observations and explicitly state that NYAWORKS must improve or optimize the workflow through its own Action architecture, multi-entry reuse, compatibility, safety, batch behavior and UI rather than copy UI, source code, naming or behavior verbatim. Record the currently verified points: application-center reuse, seven layer-create types, controlled independent-corner shape, centered/batch Null, expression-driven Camera with Alt plain-camera variant, and per-layer precompose.

- [x] **Step 5: Update README and Roadmap**

Mark code completion separately from real-AE acceptance. State that the nine Actions are reusable by future homepage and composition-page entries; do not claim those later UI entries already exist.

- [x] **Step 6: Run full verification**

Run: `pnpm.cmd run typecheck`, focused regression tests, `pnpm.cmd run build`, `pnpm.cmd run smoke:dist`, and `pnpm.cmd exec vitest run --exclude tests/nyaLauncherBuildContract.test.js`.

Result: typecheck, 597 tests excluding the unrelated missing NyaLauncher artifact, production build and dist smoke passed. The full suite is 600/601; the only failure is the pre-existing Git-ignored `outputs/nya-launcher-p1/NyaLauncher.exe` contract.

- [x] **Step 7: Inspect final changes**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short --branch`

Expected: only Task 8 documentation/test changes remain uncommitted.

- [x] **Step 8: Commit verification and documentation**

```powershell
git add -- tests/globalSearchProvider.test.tsx docs/references/xuanruyi-feature-reference.md docs/testing/layer-creation-grid-ae-test.md README.md planning/02-roadmap.md docs/superpowers/plans/2026-10-05-layer-creation-grid.md
git commit -m "docs: add layer creation AE acceptance"
```

- [x] **Step 9: Push the completed implementation**

Run: `git push origin feature/settings-updates`

Expected: local and remote `feature/settings-updates` point to the same final commit.
