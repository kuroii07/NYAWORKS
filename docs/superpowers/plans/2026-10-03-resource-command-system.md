# Resource Command System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NYAWORKS 资源页建立统一资源命令、稳定单选、完整键盘导航和可访问右键菜单，并让全局搜索复用同一主动作执行链。

**Architecture:** 以 `resourceCommands.ts` 作为资源命令领域边界，统一解析资源上下文、命令可见性、执行依赖和结果；`ResourceProvider` 负责把现有收藏、刷新、Host Bridge 与剪贴板适配器注入命令执行器。资源页只维护选择、焦点、菜单和信息弹层状态，全局搜索只按 `resourceId` 调用 `resource.use`，AE 与 Windows 文件操作继续封装在 `resourceBridge.ts` 和 `public/host/index.jsx`。

**Tech Stack:** React 18、TypeScript 5.6、Vitest 5、jsdom、Vite 8、Adobe CEP / ExtendScript、Windows Explorer

**Spec:** `docs/superpowers/specs/2026-10-03-resource-command-system-design.md`

## Global Constraints

- 目标分支固定为 `feature/settings-updates`，不新建功能分支或 worktree。
- 不新增 npm 运行时依赖；沿用 React、Phosphor Icons、现有 Toast 和现有 Dialog/Portal 模式。
- `public/host/index.jsx` 保持 ExtendScript 可执行语法：使用 `var` 和 ES3 兼容写法，不引入模块或浏览器 API。
- 第一阶段只支持 Windows 文件定位和默认程序打开；不得把任意用户文本拼成可执行系统命令。
- 资源保持单选；不实现多选、批量执行、删除、移动、重命名、首页快捷方式、最近使用界面或表达式编辑器。
- 单击只选择，双击、`Enter` 和 `NumpadEnter` 执行一次；保留现有双击执行能力。
- 资源设置 schema 继续为版本 1；选择、焦点和菜单状态不持久化。
- 所有新增界面文案覆盖简体中文、繁体中文、英文、日文和韩文。
- 资源页须在 520px 面板宽度、深浅主题和高 DPI 下可用。
- 预设和表达式修改 AE 项目时必须在一个 Undo Group 中完成，并返回实际影响数量。
- 未注册 ScriptUI Panel 返回 `panel-not-registered`，不得退化为 `$.evalFile` 后误报已打开。
- 每个任务按 TDD 顺序执行；任务结束只提交本任务文件，不夹带无关修改。

## Review Focus

- 包含中文、空格、引号、换行或 `..` 的路径必须被正确引用或拒绝，不能逃逸来源根目录或注入 Explorer 命令；Task 1 与 Task 2 的路径测试覆盖。
- 过滤结果变空、选中资源被刷新删除或列表在异步执行期间变化时，选择必须确定性保留、迁移或清空；Task 4 与 Task 6 的状态测试覆盖。
- 菜单位于视口四角、高 DPI 或滚动容器内时不能溢出或留在错误位置；Task 5 的坐标和关闭测试覆盖。
- 收藏按钮、搜索框、筛选器和菜单内部按键不得冒泡成资源执行或列表导航；Task 5 与 Task 6 的事件隔离测试覆盖。
- 同一资源快速重复触发或执行期间切换筛选时不得并发执行两次、丢失反馈或错误改写另一行状态；Task 3 与 Task 6 的并发测试覆盖。

---

### Task 1: Resource Command Domain

**Files:**
- Create: `src/resources/resourceCommands.ts`
- Test: `tests/resourceCommands.test.ts`

**Interfaces:**
- Consumes: `IndexedResource`、`ResourceSource`、`ResourceHostStatus`。
- Produces: `ResourceCommandId`、`ResourceCommandContext`、`ResourceCommandAvailability`、`ResourceCommandResult`、`ResourceCommandDependencies`、`resolveResourceCommandContext()`、`getResourceCommandItems()`、`runResourceCommand()`、`buildResourceAbsolutePath()`。

- [ ] **Step 1: Write failing tests for context and safe path construction**

在 `tests/resourceCommands.test.ts` 添加以下用例：

- `buildResourceAbsolutePath(source, resource)` 将 `C:\\Tools\\` 与 `/Animation/Loop.jsx` 归一为 `C:/Tools/Animation/Loop.jsx`。
- 中文、空格和深层目录保持原字符。
- 含独立 `..` 段、回车、换行或双引号的 `relativePath` 返回 `null`。
- 资源 `sourceId` 与来源 `id` 不匹配时，`resolveResourceCommandContext()` 返回 `invalid-resource`。
- 来源禁用、来源缺失或资源缺失时返回 `invalid-resource`，不构造命令上下文。

- [ ] **Step 2: Run the path tests and verify failure**

Run: `npm test -- --run tests/resourceCommands.test.ts`

Expected: FAIL because `resourceCommands.ts` and its exports do not exist.

- [ ] **Step 3: Implement the command types and context resolver**

在 `src/resources/resourceCommands.ts` 定义：

```ts
export type ResourceCommandId =
  | "resource.use"
  | "resource.favorite.toggle"
  | "resource.path.copy"
  | "resource.file.reveal"
  | "resource.source.refresh"
  | "resource.info.view"
  | "resource.file.open-default";

export function buildResourceAbsolutePath(
  source: ResourceSource,
  resource: IndexedResource
): string | null;

export function resolveResourceCommandContext(
  resourceId: string,
  resources: readonly IndexedResource[],
  sources: readonly ResourceSource[],
  hostStatus: ResourceHostStatus
): ResourceCommandContext | ResourceCommandFailure;
```

路径函数只接受来源内的相对路径；用路径段校验拒绝 `..`，并拒绝会破坏 Windows 命令边界的控制字符和双引号。

- [ ] **Step 4: Write failing tests for the command registry**

添加测试并断言：

- 五种资源的 `resource.use` 标签键分别为 `runScript`、`openPanel`、`runStartupOnce`、`applyPreset`、`applyExpression`。
- 收藏命令根据 `favorite` 返回 `favorite` 或 `unfavorite`。
- `resource.file.open-default` 只对 `.jsx/.js` 脚本和启动脚本、`.jsx/.txt/.json` 表达式可见；对 `.jsxbin`、面板和预设不可见。
- Host 未连接时 `resource.use`、定位文件、默认程序打开被禁用并返回 `host-unavailable`；复制路径和查看信息仍可用。
- Host 未连接时刷新来源同样禁用；收藏仍可在缓存索引上使用。
- `runResourceCommand()` 将 `use`、收藏、复制、定位、打开、刷新分别转发给一次对应依赖，并把异常归一为确定失败原因。
- `resource.info.view` 成功结果包含只读 `ResourceInfo`，不调用外部依赖。

- [ ] **Step 5: Run the registry tests and verify failure**

Run: `npm test -- --run tests/resourceCommands.test.ts`

Expected: FAIL on missing registry and runner behavior while the path tests pass.

- [ ] **Step 6: Implement the command registry and runner**

定义精确接口：

```ts
export interface ResourceCommandDependencies {
  useResource(resourceId: string): Promise<ResourceUseResult>;
  toggleFavorite(resourceId: string): void;
  refreshSource(sourceId: string): Promise<void>;
  copyText(text: string): Promise<void>;
  revealFile(context: ResourceCommandContext): Promise<ResourceFileActionResult>;
  openDefault(context: ResourceCommandContext): Promise<ResourceFileActionResult>;
}

export type ResourceCommandFailureReason =
  | "host-unavailable"
  | "invalid-resource"
  | "source-missing"
  | "no-selected-layer"
  | "no-selected-property"
  | "empty-expression"
  | "panel-not-registered"
  | "unsupported-file-type"
  | "clipboard-failed"
  | "system-open-failed"
  | "confirmation-required"
  | "untrusted-source"
  | "command-in-progress"
  | "host-error";

export interface ResourceCommandItem {
  id: ResourceCommandId;
  group: "primary" | "organize" | "file" | "source" | "details";
  labelKey: ResourceCommandLabelKey;
  shortcut?: "Enter";
  enabled: boolean;
  disabledReason?: ResourceCommandFailureReason;
}

export interface ResourceInfo {
  name: string;
  resourceType: ResourceType;
  sourceName: string;
  absolutePath: string;
  modifiedAt: string | null;
  favorite: boolean;
}

export function getResourceCommandItems(
  context: ResourceCommandContext
): readonly ResourceCommandItem[];

export async function runResourceCommand(
  commandId: ResourceCommandId,
  context: ResourceCommandContext,
  dependencies: ResourceCommandDependencies
): Promise<ResourceCommandResult>;
```

`getResourceCommandItems()` 只返回当前资源可见的项目；不可执行但需要解释的项目保留并设置 `enabled=false`。命令结果只返回结构化 reason、`affectedItems` 和可选 `info`，不包含已翻译 UI 文案；信任确认相关 reason 本阶段先纳入类型边界，不伪造尚未实现的确认流程。

- [ ] **Step 7: Run Task 1 tests**

Run: `npm test -- --run tests/resourceCommands.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: Commit the command domain**

```powershell
git add -- src/resources/resourceCommands.ts tests/resourceCommands.test.ts
git commit -m "feat: add resource command domain"
```

### Task 2: Host and Bridge File Actions

**Files:**
- Modify: `src/host/resourceBridge.ts:23-58, 293-355`
- Modify: `public/host/index.jsx:246-280, 345-478, 1738-1752`
- Modify: `tests/resourceBridge.test.ts`
- Modify: `tests/resourceHostActions.test.js`
- Modify: `tests/resourceHostSources.test.js`
- Modify: `src/resources/developmentResourceService.ts`
- Modify: `tests/resourceProvider.test.tsx`
- Modify: `tests/resourceSettingsInteraction.test.tsx`

**Interfaces:**
- Consumes: `ResourceCommandContext.absolutePath` from Task 1.
- Produces: `ResourceFileActionResult` and new `ResourceHostBridge.revealResourceFile()` / `openResourceFile()` methods; `ResourceUseResult` success with optional `affectedItems`.

- [ ] **Step 1: Write failing Host tests for typed resource execution**

在 `tests/resourceHostActions.test.js` 添加测试：

- 已注册 Panel 调用一次 `app.executeCommand(commandId)` 并返回 `{ok:true}`。
- 未注册 Panel 返回 `{ok:false, reason:"panel-not-registered"}`，且不调用 `$.evalFile`。
- Startup 仍通过 `$.evalFile` 运行一次。
- 两个选中图层应用预设返回 `{ok:true, updatedItems:2}`。
- 三个选中属性中两个可写表达式时返回 `{ok:true, updatedItems:2}`。
- 预设或表达式抛错时 Undo Group 被关闭一次。

- [ ] **Step 2: Run Host action tests and verify failure**

Run: `npm test -- --run tests/resourceHostActions.test.js`

Expected: FAIL on panel fallback and missing `updatedItems`.

- [ ] **Step 3: Implement Host execution result fixes**

修改 `runSearchScript()`、`applySearchPreset()` 和 `applyResourceExpression()`：

- Panel 查找不到命令立即返回 `panel-not-registered`。
- 脚本和 Startup 才调用 `$.evalFile`。
- 预设返回选中图层数。
- 表达式把当前 `updatedProperties` 结果字段统一输出为 `updatedItems`。
- 保留并验证异常路径的 Undo Group 收尾。

- [ ] **Step 4: Write failing tests for reveal and default-open actions**

在 `tests/resourceHostSources.test.js` 和 `tests/resourceBridge.test.ts` 添加测试：

- `revealResourceFile()` 对 `C:/资源/My Tool.jsx` 调用 `explorer.exe /select,"C:\\资源\\My Tool.jsx"`。
- 文件不存在返回 `invalid-resource`。
- 含双引号、回车或换行的路径返回 `invalid-resource`，不调用 `app.system.callSystem`。
- `openResourceFile()` 对允许扩展名调用 `File.execute()`，不使用记事本或 `cmd /c start`。
- `.jsxbin`、`.ffx` 和未知扩展名返回 `unsupported-file-type`。
- Bridge 正确编码 payload，并把 `panel-not-registered`、`system-open-failed`、`unsupported-file-type` 与 `updatedItems` 解析为类型化结果。

- [ ] **Step 5: Run file-action tests and verify failure**

Run: `npm test -- --run tests/resourceHostSources.test.js tests/resourceBridge.test.ts`

Expected: FAIL because the Bridge methods and Host functions do not exist.

- [ ] **Step 6: Implement the Host file functions**

在 `public/host/index.jsx` 新增并导出：

```text
NYAWORKS.revealResourceFile(encodedPayload)
NYAWORKS.openResourceFile(encodedPayload)
```

两者解析仅含绝对路径和资源类型的 URL 编码 JSON。Host 再次检查文件存在、控制字符、引号和允许扩展名；定位文件使用 Explorer `/select,`，默认打开使用 ExtendScript `File.execute()`。

- [ ] **Step 7: Extend `ResourceHostBridge`**

在 `src/host/resourceBridge.ts` 定义：

```ts
export type ResourceFileActionResult =
  | { ok: true; path: string }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "invalid-resource"
        | "unsupported-file-type"
        | "system-open-failed"
        | "host-error";
      detail?: string;
    };
```

并为 `ResourceHostBridge` 添加 `revealResourceFile(source, resource)` 与 `openResourceFile(source, resource)`。更新 `ResourceUseResult` 支持 `panel-not-registered` 和 `affectedItems`，兼容解析 Host 的 `updatedItems`。

- [ ] **Step 8: Update every concrete Bridge implementation and test fixture**

在 `src/resources/developmentResourceService.ts`、`tests/resourceProvider.test.tsx` 和 `tests/resourceSettingsInteraction.test.tsx` 的 `ResourceHostBridge` 实现中补齐两个文件动作。开发预览服务返回 `unavailable`；测试 fixture 返回与各测试目的相符的结果。不得用类型断言掩盖缺失方法。

- [ ] **Step 9: Run all Host and Bridge resource tests and typecheck**

Run: `npm test -- --run tests/resourceHostActions.test.js tests/resourceHostSources.test.js tests/resourceBridge.test.ts tests/resourceSettingsInteraction.test.tsx`

Expected: all tests PASS.

Run: `npm run typecheck`

Expected: exit code 0; no interface implementation is incomplete.

- [ ] **Step 10: Commit Host and Bridge changes**

```powershell
git add -- public/host/index.jsx src/host/resourceBridge.ts src/resources/developmentResourceService.ts tests/resourceHostActions.test.js tests/resourceHostSources.test.js tests/resourceBridge.test.ts tests/resourceProvider.test.tsx tests/resourceSettingsInteraction.test.tsx
git commit -m "feat: add resource file host actions"
```

### Task 3: Provider Command Execution

**Files:**
- Modify: `src/resources/ResourceProvider.tsx:25-70, 299-421`
- Modify: `tests/resourceProvider.test.tsx`

**Interfaces:**
- Consumes: `runResourceCommand()` and types from Task 1; Bridge methods from Task 2.
- Produces: `ResourceContextValue.getResourceCommands(resourceId)` and `runResourceCommand(commandId, resourceId)`.

- [ ] **Step 1: Write failing Provider command tests**

在 `tests/resourceProvider.test.tsx` 添加测试并断言：

- `getResourceCommands(resourceId)` 返回与资源类型匹配的命令列表。
- `runResourceCommand("resource.use", id)` 只调用 Bridge 一次，成功后只更新该资源的 `lastUsedAt`。
- 第二次同资源执行尚未完成时返回 `command-in-progress`，不调用第二次 Bridge。
- 收藏命令更新并持久化 `favorite`。
- 刷新命令只扫描当前资源来源。
- 复制命令把规范绝对路径传给注入的 `copyText` 一次。
- 定位和默认打开分别调用新增 Bridge 方法。
- 异步执行期间外部筛选变化不改变命令目标，最终结果仍对应原 `resourceId`。
- Provider 卸载后的异步结果不写入状态。

- [ ] **Step 2: Run Provider tests and verify failure**

Run: `npm test -- --run tests/resourceProvider.test.tsx`

Expected: FAIL on missing command API.

- [ ] **Step 3: Add a clipboard dependency and command API**

为 `ResourceProviderProps` 添加可测试的依赖：

```ts
interface ResourceProviderProps extends PropsWithChildren {
  bridge?: ResourceHostBridge;
  storage?: ResourceStorage;
  now?: () => Date;
  copyText?: (text: string) => Promise<void>;
}
```

默认 `copyText` 优先调用 `navigator.clipboard.writeText`，不可用时使用同步 textarea + `document.execCommand("copy")` 回退；两者失败时抛出，由命令执行器映射为 `clipboard-failed`。

- [ ] **Step 4: Implement Provider command orchestration**

在 Context 中新增：

```ts
getResourceCommands(resourceId: string): readonly ResourceCommandItem[];
runResourceCommand(
  commandId: ResourceCommandId,
  resourceId: string
): Promise<ResourceCommandResult>;
```

用 `Set<string>` 或等价 ref 按资源 ID 防止主动作并发；收藏、刷新、复制、定位和信息命令不复用页面局部状态。保留 `useResource()` 作为内部或兼容入口，后续页面和全局搜索不得直接调用它。

- [ ] **Step 5: Run Provider tests**

Run: `npm test -- --run tests/resourceProvider.test.tsx tests/resourceCommands.test.ts`

Expected: all tests PASS.

- [ ] **Step 6: Commit Provider command orchestration**

```powershell
git add -- src/resources/ResourceProvider.tsx tests/resourceProvider.test.tsx
git commit -m "feat: expose resource command service"
```

### Task 4: Resource Selection State

**Files:**
- Create: `src/resources/resourceSelection.ts`
- Test: `tests/resourceSelection.test.ts`

**Interfaces:**
- Consumes: visible resource IDs in rendered order.
- Produces: `ResourceSelectionState` and pure selection transition functions used by `ResourcesPage`.

- [ ] **Step 1: Write failing selection tests**

在 `tests/resourceSelection.test.ts` 覆盖：

- 无选择时向下选择第一项、向上选择最后一项。
- 中间项上下移动一项，首尾不循环。
- `Home` / `End` 到首尾。
- 空列表始终返回 `{selectedResourceId:null, focusedResourceId:null}`。
- 当前资源过滤后不可见时清空选择。
- 刷新删除当前资源时选择原可见索引上的新资源；该索引越界时选择新末项；无项目时清空。
- 仍存在的资源在重排后保持选择和焦点。

- [ ] **Step 2: Run selection tests and verify failure**

Run: `npm test -- --run tests/resourceSelection.test.ts`

Expected: FAIL because the selection module does not exist.

- [ ] **Step 3: Implement pure selection transitions**

导出：

```ts
export interface ResourceSelectionState {
  selectedResourceId: string | null;
  focusedResourceId: string | null;
}

export function moveResourceSelection(
  state: ResourceSelectionState,
  visibleIds: readonly string[],
  direction: "previous" | "next" | "first" | "last"
): ResourceSelectionState;

export function reconcileFilteredSelection(
  state: ResourceSelectionState,
  visibleIds: readonly string[]
): ResourceSelectionState;

export function reconcileRefreshedSelection(
  state: ResourceSelectionState,
  previousVisibleIds: readonly string[],
  nextVisibleIds: readonly string[]
): ResourceSelectionState;
```

- [ ] **Step 4: Run selection tests**

Run: `npm test -- --run tests/resourceSelection.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit selection state**

```powershell
git add -- src/resources/resourceSelection.ts tests/resourceSelection.test.ts
git commit -m "feat: add resource selection model"
```

### Task 5: Accessible Resource Context Menu

**Files:**
- Create: `src/components/ResourceContextMenu.tsx`
- Create: `tests/resourceContextMenu.test.tsx`
- Modify: `src/components/CompactActionMenu.tsx:12-157` only if extracting shared primitives is smaller than duplication
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `ResourceCommandItem[]`, mouse or element anchor, `onSelect(commandId)` and `onClose()`.
- Produces: `ResourceContextMenu`, `getResourceContextMenuPosition()` and keyboard/focus behavior.

- [ ] **Step 1: Write failing position tests**

在 `tests/resourceContextMenu.test.tsx` 断言：

- 指针位于左上角时菜单保持至少 8px 边距。
- 指针位于右下角时菜单向左、向上修正且不越过视口。
- 元素锚点用于 `Shift+F10` 时从行左下方打开。
- 菜单高度超过可用空间时限制最大高度并允许菜单自身滚动。

- [ ] **Step 2: Write failing interaction tests**

用 jsdom 挂载菜单并断言：

- 打开后聚焦第一个可用项。
- 上下键在可用项间循环，跳过 `aria-disabled=true` 项。
- `Home` / `End` 跳到首尾可用项。
- `Enter` / `Space` 只调用一次 `onSelect`。
- `Escape` 关闭并恢复触发行焦点。
- `Tab` 关闭且不阻止浏览器默认焦点顺序。
- 禁用项展示可访问的禁用原因，但不进入 roving focus，也不能触发 `onSelect`。
- 点击外部、捕获滚动或 resize 时关闭。
- 菜单内部按键不冒泡到资源列表。
- 分隔线只在相邻可见分组之间出现。

- [ ] **Step 3: Run menu tests and verify failure**

Run: `npm test -- --run tests/resourceContextMenu.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement the menu component**

定义：

```ts
type ResourceMenuAnchor =
  | { kind: "point"; x: number; y: number }
  | { kind: "element"; element: HTMLElement };

interface ResourceContextMenuProps {
  open: boolean;
  ariaLabel: string;
  anchor: ResourceMenuAnchor | null;
  restoreFocusTo: HTMLElement | null;
  items: readonly ResourceCommandItem[];
  onSelect(commandId: ResourceCommandId): void;
  onClose(): void;
}
```

通过 Portal 渲染，使用 `role="menu"` / `role="menuitem"`、roving `tabIndex` 和 `aria-disabled`。复用现有菜单色彩、边框、阴影、圆角 token，不复制 `CompactActionMenu` 的锚点 marker 限制。

- [ ] **Step 5: Add compact menu styles**

在 `src/styles.css` 添加资源菜单分组、快捷键列、禁用原因、分隔线、聚焦态和最大高度样式；菜单宽度允许五语言短文案，不能遮挡快捷键。

- [ ] **Step 6: Run menu tests**

Run: `npm test -- --run tests/resourceContextMenu.test.tsx`

Expected: all tests PASS.

- [ ] **Step 7: Commit the menu component**

```powershell
git add -- src/components/ResourceContextMenu.tsx src/components/CompactActionMenu.tsx src/styles.css tests/resourceContextMenu.test.tsx
git commit -m "feat: add accessible resource context menu"
```

仅当 `CompactActionMenu.tsx` 实际变更时将其加入提交。

### Task 6: Resources Page Selection, Keyboard, Menu, and Feedback

**Files:**
- Modify: `src/pages/ResourcesPage.tsx:1-292`
- Modify: `src/i18n/types.ts:286-321`
- Modify: `src/i18n/translations.ts:187-213, 638-664, 1083-1109, 1529-1555, 1974-2000`
- Modify: `src/styles.css`
- Modify: `tests/resourcePage.test.tsx`
- Create: `tests/resourcePageInteraction.test.tsx`

**Interfaces:**
- Consumes: Provider command API from Task 3, selection functions from Task 4, `ResourceContextMenu` from Task 5.
- Produces: fully interactive single-select resource list and localized command feedback.

- [ ] **Step 1: Add all five-language resource command copy**

在 `copy.resources` 中增加类型化主动作、取消收藏、菜单标题、资源信息字段、全部失败原因、数量成功反馈和禁用原因。类型键必须与 Task 1 label keys 一致；英文使用短句，数量文案使用明确的数值插值函数或现有项目支持的字符串组合方式。

- [ ] **Step 2: Write failing page interaction tests for selection and execution**

在 `tests/resourcePageInteraction.test.tsx` 挂载真实 `LanguageProvider`、`ToastProvider`、测试 Provider，并断言：

- 行语义为 `listbox` / `option`，单击设置 `aria-selected=true` 且不执行。
- 双击只执行一次。
- `ArrowDown/ArrowUp`、`Numpad2/Numpad8`、`Home/End` 更新选择与 DOM 焦点。
- `Enter` 与 `NumpadEnter` 各执行一次当前选择。
- 末项继续向下不循环。
- `Ctrl+F` 聚焦并全选搜索框。
- 从收藏按钮、搜索框、筛选器触发的键盘或双击不执行资源。

- [ ] **Step 3: Run selection interaction tests and verify failure**

Run: `npm test -- --run tests/resourcePageInteraction.test.tsx`

Expected: FAIL because the page has no stable selected resource or list keyboard controller.

- [ ] **Step 4: Integrate the selection model into `ResourcesPage`**

将 `ResourceRow` 改为语义化 option，并传入：

```ts
selected: boolean;
focused: boolean;
tabIndex: 0 | -1;
onSelect(): void;
onFocus(): void;
onUse(): void;
onContextMenu(event: React.MouseEvent): void;
```

页面保存 `ResourceSelectionState` 和行 ref map。筛选变化使用 `reconcileFilteredSelection`；刷新资源数组变化使用 `reconcileRefreshedSelection`。方向键后调用目标行 `.focus()` 和 `scrollIntoView({block:"nearest"})`。

- [ ] **Step 5: Write failing context-menu and feedback tests**

追加断言：

- 右键未选中行先选中目标，再按鼠标坐标打开菜单。
- 右键已选中行保持选择。
- `Shift+F10` 和 `ContextMenu` 键以行元素打开菜单。
- `Escape` 后焦点回到触发行且选择保留。
- 收藏菜单动作更新同一行状态。
- 复制、定位和刷新成功分别显示对应反馈，刷新只影响当前资源来源。
- 信息命令打开只读弹层，并展示名称、类型、来源、完整路径、修改时间和收藏状态。
- 预设成功 Toast 含资源名和图层数量；表达式成功 Toast 含属性数量。
- `panel-not-registered`、无图层、无属性、空表达式、剪贴板失败、系统打开失败均显示各自文案。
- 失败和筛选切换都不把执行中状态显示到另一行。
- 同一资源执行中再次双击或按 Enter 不触发第二次调用。

- [ ] **Step 6: Run menu integration tests and verify failure**

Run: `npm test -- --run tests/resourcePageInteraction.test.tsx`

Expected: FAIL on context menu, information dialog and structured feedback.

- [ ] **Step 7: Integrate commands and information dialog**

资源页只调用：

```ts
getResourceCommands(resourceId)
runResourceCommand(commandId, resourceId)
```

实现单一 `handleCommand()` 将结构化结果映射到五语言 Toast；`resource.info.view` 的 `info` 打开现有风格的只读 Dialog。菜单执行后关闭，行选择保持；刷新命令完成后由选择协调规则处理资源是否仍存在。

- [ ] **Step 8: Add selected, focus-visible, executing, menu, and dialog styles**

在 `src/styles.css` 明确区分 hover、`data-selected`、`:focus-visible` 和 `aria-busy`；收藏按钮仍有 Tooltip，行执行中只锁定主动作，不阻止列表滚动。

- [ ] **Step 9: Update static resource page tests**

调整 `tests/resourcePage.test.tsx`：保留紧凑资源行和收藏按钮断言，新增 `listbox` / `option` 与菜单文案类型存在性，不要求静态 SSR 输出关闭状态的 Portal 菜单。

- [ ] **Step 10: Run all page and i18n tests**

Run: `npm test -- --run tests/resourcePage.test.tsx tests/resourcePageInteraction.test.tsx tests/resourceContextMenu.test.tsx`

Expected: all tests PASS, no React act warnings.

- [ ] **Step 11: Commit the resource page integration**

```powershell
git add -- src/pages/ResourcesPage.tsx src/i18n/types.ts src/i18n/translations.ts src/styles.css tests/resourcePage.test.tsx tests/resourcePageInteraction.test.tsx
git commit -m "feat: add resource menu and keyboard navigation"
```

### Task 7: Global Search Uses the Shared Resource Command

**Files:**
- Modify: `src/search/GlobalSearchProvider.tsx:29-50, 81-151`
- Modify: `tests/globalSearchProvider.test.tsx`

**Interfaces:**
- Consumes: `ResourceContextValue.runResourceCommand()` from Task 3.
- Produces: global search resource execution without local path construction or resource-type branching.

- [ ] **Step 1: Write failing global-search tests**

在 `tests/globalSearchProvider.test.tsx` 添加或修改用例：

- script、panel、startup、preset 和 expression 搜索项执行时都调用 `runResourceCommand("resource.use", resourceId)`。
- Provider 不再调用 `GlobalSearchHostBridge.executeGlobalSearchAction()` 执行资源。
- 资源命令成功的 `affectedItems` 映射成现有 `GlobalSearchActionResult` 成功。
- `panel-not-registered`、`no-selected-layer` 等失败 reason 原样传递。
- 工具、Action Registry 项和 AE 效果仍走原执行链，不受资源改动影响。

- [ ] **Step 2: Run global-search tests and verify failure**

Run: `npm test -- --run tests/globalSearchProvider.test.tsx`

Expected: FAIL because resource items still branch by `run-script` / `apply-preset` and build paths locally.

- [ ] **Step 3: Replace resource execution branches**

在 `GlobalSearchProvider` 从 `useResources()` 获取 `runResourceCommand`。保留资源搜索项的 kind、图标和显示后缀，但资源执行统一为：

```ts
runResourceCommand("resource.use", item.resourceId)
```

删除资源执行所需的 `sources` 路径拼接及 `run-script` / `apply-preset` / `open-expression` 类型分支；不要改变效果与 Action Service 的执行逻辑。

- [ ] **Step 4: Run global search and command tests**

Run: `npm test -- --run tests/globalSearchProvider.test.tsx tests/resourceProvider.test.tsx tests/resourceCommands.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit the global-search migration**

```powershell
git add -- src/search/GlobalSearchProvider.tsx tests/globalSearchProvider.test.tsx
git commit -m "refactor: share resource commands with search"
```

### Task 8: Documentation, Full Verification, and AE Handoff

**Files:**
- Create: `docs/testing/resource-command-ae-test.md`
- Modify: `README.md`
- Modify: `planning/02-roadmap.md`

**Interfaces:**
- Consumes: completed Tasks 1-7.
- Produces: verified build and a user-executable real-AE acceptance checklist.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all Vitest suites PASS with no unhandled rejection or React act warning.

- [ ] **Step 3: Run production build and dist smoke test**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

Run: `npm run smoke:dist`

Expected: distribution smoke test PASS.

- [ ] **Step 4: Write the real-AE acceptance document**

创建 `docs/testing/resource-command-ae-test.md`，逐项列出规格第 19 节验收内容，并为每项提供：

```text
AE version:
Windows scale:
Result: PASS / FAIL / BLOCKED
Observed behavior:
Screenshot or exact error:
```

文档必须明确“自动化通过不代表真实 AE 验收完成”，并保留用户填写区域。

- [ ] **Step 5: Update project documentation and roadmap**

在 `README.md` 补充资源页右键和键盘操作，在 `planning/02-roadmap.md` 将“资源命令第一阶段”标为代码完成、等待真实 AE 验收；第二阶段功能继续保留为未开始。

- [ ] **Step 6: Re-run repository verification**

Run: `npm run verify`

Expected: typecheck、全部测试、生产构建和 dist smoke test 均通过。

- [ ] **Step 7: Inspect the final diff and working tree**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only Task 8 documentation changes are uncommitted.

- [ ] **Step 8: Commit documentation and verification results**

```powershell
git add -- docs/testing/resource-command-ae-test.md README.md planning/02-roadmap.md
git commit -m "docs: add resource command AE acceptance"
```

提交前用 `git diff --cached --name-only` 确认只包含上述三个文档文件。

- [ ] **Step 9: Record the handoff state without pushing**

Run: `git status --short --branch`

Expected: clean working tree; `feature/settings-updates` ahead of `origin/feature/settings-updates` by the new local commits. 等用户完成真实 AE 验收并决定是否推送。
