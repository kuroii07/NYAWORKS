# NYAWORKS Anchor Action Integration Design

日期：2026-09-29
状态：待用户审阅
范围：建立可供所有 NYAWORKS 工具复用的 Action 运行入口，并将锚点九宫格作为第一个正式迁移功能

## 1. 背景

当前锚点九宫格已经具备：

- 首页九宫格 UI；
- 九个锚点位置；
- `anchorBridge.ts` CEP Bridge；
- `NYAWORKS.setAnchorPoint()` Host JSX；
- 2D / 3D、多选、撤销组和错误结果基础；
- 浏览器 Bridge 测试与 AE 手工测试说明。

但当前调用链仍然是：

```text
HomePage
→ anchorHostBridge
→ CSInterface.evalScript
→ NYAWORKS.setAnchorPoint
```

Action Registry 目前只注册 Nya Pie P0 测试 Action，通用 Host Executor 也只支持 `runP0TestAction`。因此锚点功能不能由首页、全局搜索、快捷键和未来 Nya Pie 共享同一个 Action。

## 2. 目标

本阶段建立以下正式调用链：

```text
首页 / 全局搜索 / 未来快捷键与 Nya Pie
→ Action Service
→ AE Context Provider
→ Action Runner
→ Host Executor
→ Anchor Bridge
→ NYAWORKS.setAnchorPoint
→ ActionResult
→ 当前界面的本地化反馈
```

锚点九宫格是第一个迁移功能。完成后，对齐、新建图层、选择与显示沿用同一架构，不再为每个入口复制执行逻辑。

## 3. 非目标

本阶段不开发：

- 正式 Nya Pie UI 或 Pie Editor；
- 对齐九宫格迁移；
- 新建图层或选择工具；
- 新的锚点计算模式；
- 带关键帧或表达的锚点修改；
- 摄像机、灯光等非普通内容图层支持；
- macOS NyaLauncher；
- Action 快捷键配置界面。

现有主题、语言、首页布局、九宫格视觉与动效不得改变。

## 4. 职责划分

### 4.1 Action Definition

描述“这个功能是什么”，不直接访问 CEP 或 AE。

每个锚点位置对应一个独立 Action：

```text
layer.anchor.top-left
layer.anchor.top
layer.anchor.top-right
layer.anchor.left
layer.anchor.center
layer.anchor.right
layer.anchor.bottom-left
layer.anchor.bottom
layer.anchor.bottom-right
```

统一属性：

- `category: "layer"`
- `requirements: ["host", "activeComp", "selectedLayers"]`
- `supportsPie: true`
- `execute.type: "host"`
- `execute.command: "setAnchorPoint"`
- `execute.payload: { position }`
- `undoPolicy: "host-undo-group"`

标题、说明和搜索文字提供简体中文、繁體中文、English、日本語、한국어。

### 4.2 Action Registry

负责注册、查找和列出 Action。

正式 Registry 由多个独立定义模块组合：

```text
coreActionRegistry
├─ P0 compatibility actions
├─ anchor actions
├─ alignment actions（后续）
├─ create-layer actions（后续）
└─ selection actions（后续）
```

现有 `p0ActionRegistry` 在迁移期间保留兼容，但新的产品入口使用 `coreActionRegistry`。不得建立独立的 Anchor Catalog 或 Pie Catalog。

### 4.3 AE Context Provider

负责回答“当前 AE 是否允许执行这个 Action”。

新增 Host 方法：

```text
NYAWORKS.getActionContext()
```

返回：

```json
{
  "ok": true,
  "activeComp": true,
  "selectedLayers": 2,
  "selectedKeys": 0
}
```

CEP 端转换为：

```ts
interface ActionContextSnapshot {
  hostAvailable: boolean;
  activeComp: boolean;
  selectedLayers: number;
  selectedKeys: number;
}
```

规则：

- CEP 不可用时返回安全的全 false / 0 Snapshot；
- 当前项目项不是 CompItem 时 `activeComp: false`；
- `selectedLayers` 使用当前活动合成的选择层数量；
- `selectedKeys` 第一阶段允许返回 `0`，但字段必须保留；
- Context 查询不得修改 AE 项目；
- 每次 `ActionService.run()` 都读取一次新 Snapshot，第一阶段不缓存；
- Snapshot 只用于执行前可用性判断，不能替代 Host JSX 对活动合成、选择层和属性状态的二次校验。

### 4.4 Action Runner

负责执行前的统一检查：

1. 根据 ID 从 Registry 查找 Action；
2. 使用 Context Engine 判断要求是否满足；
3. 找到对应 Executor；
4. 执行；
5. 捕获异常；
6. 返回统一 `ActionResult`。

现有 `createActionRunner()` 的核心职责保持不变。

### 4.5 Action Service

Action Service 是 UI 唯一直接使用的执行入口：

```ts
interface ActionService {
  run(actionId: string): Promise<ActionResult>;
}

interface ActionContextProvider {
  getSnapshot(): Promise<ActionContextSnapshot>;
}
```

它负责：

1. 调用 AE Context Provider；
2. 将 Snapshot 交给 Action Runner；
3. 返回 ActionResult。

UI 不再自行构造虚假的 `selectedLayers: 1`，也不直接访问 Host Bridge。

React 层使用一个共享的 `ActionServiceProvider` 注入同一个 Service 实例。它位于 `GlobalSearchProvider` 外层，使首页和全局搜索可以复用同一 Registry、Context Provider、Runner 与 Executor；测试可以注入假的 Service，不依赖真实 CEP。

### 4.6 Host Executor

Host Executor 负责把通用 Action Definition 转换成具体 Bridge 调用。

第一阶段支持：

- `runP0TestAction`
- `setAnchorPoint`

当命令为 `setAnchorPoint` 时：

1. 校验 `payload.position` 是否属于九个合法位置；
2. 调用现有 `AnchorHostBridge.setAnchorPoint(position)`；
3. 将 `AnchorActionResult` 转换为通用 `ActionResult`；
4. 保留 `updatedLayers` 与 `threeDLayers` 数据；
5. 将 Host 原因写入 `ActionResult.error.code`。

未知命令必须返回 `unsupported-host-command`，不得拼接任意函数名执行。

### 4.7 Bridge

Bridge 继续作为 CEP 与 ExtendScript 之间的低层适配器：

- 编码参数；
- 调用 `CSInterface.evalScript()`；
- 解析 JSON；
- 处理 CEP 不可用和无效 Host 响应。

`anchorBridge.ts` 暂不删除。它不负责：

- Action 是否可用；
- Action Registry；
- UI Toast；
- 多语言文案；
- Nya Pie 或首页逻辑。

### 4.8 Host JSX

`NYAWORKS.setAnchorPoint()` 继续承担真实 AE 修改：

- 读取当前合成与选中图层；
- 计算图层内容边界；
- 设置锚点；
- 补偿 Position；
- 保留 3D Z 值；
- 使用一个 Undo Group；
- 对不支持的场景返回结构化失败原因。

本阶段只允许为修复自动测试或真实 AE 验收问题进行最小修改，不重新设计已存在的几何算法。

## 5. 首页迁移

首页锚点九宫格的外观、位置、切换动效和 Tooltip 保持不变。

点击映射：

```text
top-left     → layer.anchor.top-left
top          → layer.anchor.top
top-right    → layer.anchor.top-right
left         → layer.anchor.left
center       → layer.anchor.center
right        → layer.anchor.right
bottom-left  → layer.anchor.bottom-left
bottom       → layer.anchor.bottom
bottom-right → layer.anchor.bottom-right
```

`HomePage` 不再导入或调用 `anchorHostBridge`，只调用 `ActionService.run(actionId)`。

失败提示继续使用现有五语言 `anchorFeedback` 文案；显示内容根据：

- `action-unavailable` 及缺失要求；
- `no-selected-layer`
- `locked-layer`
- `unsupported-layer`
- `expression-conflict`
- `host-unavailable`
- `invalid-host-response`
- `host-error`

进行映射。

成功操作保持安静，不新增底部状态栏或阻塞弹窗。

## 6. 全局搜索适配

新增 Registry → Search Adapter，不维护第二份锚点数据。

九个锚点 Action 可以通过以下内容搜索：

- 本地化 Action 标题；
- 本地化说明；
- `anchor`
- `锚点 / 錨點 / アンカー / 앵커`
- 方向名称。

搜索结果执行时调用同一个 `ActionService`。原有“锚点设置”工具入口可以继续作为定位首页空间九宫格的导航结果，但真正执行锚点动作的结果来自 Registry。

适配后的搜索项使用以下稳定约定：

- `id: "action:" + definition.id`
- `kind: "tool"`
- `action: "execute-action"`
- `actionId: definition.id`
- `name` 与说明取当前语言的 Action Definition；
- `aliases` / `searchableText` 由 Action ID、标题、说明和方向生成；
- `requiresHost` 根据 `requirements` 是否包含 `host` 生成。

`GlobalSearchItem` 增加可选 `actionId`，`GlobalSearchAction` 增加 `execute-action`。`GlobalSearchProvider.executeItem()` 遇到该类型时只调用共享的 `ActionService.run(actionId)`，不得直接调用 Anchor Bridge。现有脚本、预设和效果搜索仍保留原有 Host Bridge，不在本阶段强制迁移。

## 7. 数据与错误边界

- UI 只接收 `ActionResult`，不解析原始 Host JSON；
- Executor 不显示 Toast；
- Bridge 不读取翻译资源；
- Context Provider 不修改项目；
- Host JSX 不记录项目路径、素材名称或用户内容；
- 锚点 payload 只能是九个固定枚举值；
- 所有错误必须返回结构化 code；
- 不把原始异常直接显示给普通用户，详细信息只进入开发日志。

## 8. 兼容性

- 目标 AE 2022–2026；
- 核心 Host 逻辑使用稳定属性或 `matchName`；
- 不依赖 AE 中文或英文显示名称；
- ExtendScript 保持 ES3 兼容写法；
- 浏览器预览不得报错，只返回 `hostAvailable: false`；
- 现有 P0 Runtime 行为保持不变；
- 现有锚点直接 Bridge API 在迁移完成前保持兼容。

## 9. 自动测试

### Registry

- 精确注册九个锚点 Action；
- ID、position payload 和排列顺序正确；
- 全部要求 active comp 与 selected layers；
- 全部支持 Pie；
- 重复 ID 仍被拒绝。

### Context Provider

- 活动合成和选择层数量正确解析；
- 无活动合成；
- CEP 不可用；
- 无效 JSON；
- Host 返回失败。

### Host Executor

- `setAnchorPoint` 调用 Anchor Bridge；
- 九个位置均可执行；
- 非法 position 被拒绝；
- 成功数据转换为 ActionResult；
- Host 失败原因保持；
- 未知命令不执行。

### Action Service / Runner

- Context 不满足时不调用 Anchor Bridge；
- Context 满足时执行一次；
- Bridge 异常转换为统一错误；
- 不存在的 Action 返回 unknown-action。

### HomePage

- 九个按钮调用正确 Action ID；
- 不再直接调用 Anchor Bridge；
- 原有切换动画、Tooltip 和布局不变；
- 五语言错误提示仍正确。

### Search

- 九个 Action 从 Registry 生成搜索项；
- 本地化标题和方向可搜索；
- 搜索执行调用 Action Service；
- 不产生重复的锚点 Action 数据源。

## 10. 真实 AE 验收

自动测试完成后生成新的锚点候选测试包，并验证：

1. 2D 固态层：左上、中心、右下；
2. 文字层；
3. 形状层；
4. 普通 3D 图层；
5. 多选 2D / 3D；
6. 父级图层；
7. 旋转与缩放；
8. 锁定图层；
9. Anchor / Position 关键帧；
10. Anchor / Position 表达式；
11. 一次撤销恢复整批图层；
12. 浏览器预览不误报成功。

本阶段不将浏览器、TypeScript 或 Host Bridge 测试视为真实 AE 验收。

## 11. 文件边界

预计新增：

```text
src/actions/definitions/anchorActions.ts
src/actions/service.ts
src/actions/contextProvider.ts
src/actions/ActionServiceProvider.tsx
src/search/actionSearchAdapter.ts
tests/anchorActions.test.ts
tests/actionContextProvider.test.ts
tests/actionService.test.ts
tests/actionSearchAdapter.test.ts
docs/testing/anchor-action-ae-test.md
```

预计修改：

```text
src/actions/registry.ts
src/actions/executors.ts
src/pages/HomePage.tsx
src/search/toolSearchCatalog.ts
src/search/types.ts
src/components/GlobalSearchPanel.tsx
public/host/index.jsx
tests/actionRegistry.test.ts
tests/actionRunner.test.ts
tests/homePageLayout.test.tsx
tests/globalSearchOperations.test.ts
README.md
planning/02-roadmap.md
```

`src/main.tsx` 需要把共享的 `ActionServiceProvider` 放在 `GlobalSearchProvider` 外层。不得让 HomePage 或 GlobalSearchProvider 各自创建 Registry、Context Provider、Runner 或 Executor。

## 12. 成功标准

本阶段只有同时满足以下条件才算完成：

- 九个锚点动作来自统一 Action Registry；
- 首页不再直接调用 Anchor Bridge；
- Action Service 使用真实 AE Context Snapshot；
- Host Executor 通过固定命令映射调用 Anchor Bridge；
- 全局搜索可以发现并执行锚点 Action；
- 浏览器环境安全失败；
- 自动化测试与完整仓库验证通过；
- 生成真实 AE 测试包和测试记录；
- 真实 AE 验收结果单独记录，不以自动化结果代替。
