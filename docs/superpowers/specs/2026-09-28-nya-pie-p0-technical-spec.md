# Nya Pie P0 Technical Spec

日期：2026-09-28
状态：P0 技术验证规格
平台优先级：Windows / After Effects 2022–2026
范围：只验证 Runtime 调用链，不开发正式 Nya Pie 产品界面

## 1. 目标

P0 只回答一个问题：

> NYAWORKS 能否在真实 After Effects 任意常用面板获得焦点时，通过快捷键取得当前鼠标位置，在鼠标附近显示独立 Nya Pie Runtime，完成方向选择，在快捷键松开时执行同一个 Action Registry 中的测试动作，立即关闭 Runtime，并自然恢复 AE 焦点？

完整成功链路：

```text
AE 任意 Panel Focus
→ Hotkey
→ Cursor Position
→ Floating Runtime
→ Direction Selection
→ KeyUp
→ Action Runner
→ AE Host
→ Close Runtime
→ Return Focus
```

以下结果均不算 P0 成功：

- 只在浏览器中显示了圆形菜单；
- 只在 NYAWORKS Panel 获得焦点时能收到快捷键；
- 只能点击菜单执行，不能完成 Hold / KeyUp 链路；
- Runtime 只能出现在固定位置，不能靠近当前鼠标；
- Runtime 关闭后 AE 焦点异常。

## 2. 当前 NYAWORKS 架构与 Nya Pie 的关系

当前工程结构是：

```text
React / TypeScript / Vite
├─ 首页、设置、资源、全局搜索、Banner
├─ src/host/*Bridge.ts
└─ window.__adobe_cep__.evalScript()
       ↓
public/host/index.jsx
       ↓
After Effects
```

当前 CEP Bundle：

- Bundle：`com.kuroii.nyaworks`
- 主面板：`com.kuroii.nyaworks.panel`
- 主入口：`index.html`
- Host：`public/host/index.jsx`

P0 增加同一 Bundle 内的第二个 Extension：

- Runtime：`com.kuroii.nyaworks.nyapie.p0`
- 类型：`Modeless`
- 入口：`nya-pie-runtime.html`
- Host：继续使用 `public/host/index.jsx`

它不是新仓库，也不复制 AE 工具逻辑。主面板、全局搜索、Banner 和 Runtime 最终都必须调用统一 Action Runner。

## 3. 为什么普通 React `keydown` 不满足需求

浏览器 `keydown` / `keyup` 只对当前 HTML 文档可靠。Adobe CEP 官方文档对快捷键的描述同样以“焦点在 HTML Extension”作为前提。

`registerKeyEventsInterest()` 的作用是：当 Panel 或 Modeless Extension 已经拥有相关键盘事件时，阻止这些事件继续传给宿主。它不是系统级全局快捷键注册器，也没有证明它能在 Composition、Timeline、Project 或 Effect Controls 获得焦点时把事件转发给 Nya Pie。

因此普通 React 事件只能验证：

- Runtime 自身获得焦点后的 KeyDown / KeyUp；
- 方向选择状态；
- Esc 关闭；
- Action Runner 调用；
- 关闭 Extension。

它不能单独证明：

- AE 其他面板焦点下的全局触发；
- Runtime 打开前的鼠标坐标；
- Hold 模式完整按下/松开生命周期；
- 关闭后焦点自然返回 AE。

## 4. Route A：第二 CEP Extension

### 4.1 可验证能力

CEP 官方能力支持：

- 同一 manifest 中声明多个 Extension；
- 使用 `Modeless` 创建独立非模态窗口；
- 使用 `requestOpenExtension(extensionId, "")` 打开或激活另一个 Extension；
- Modeless Extension 使用 `closeExtension()` 关闭；
- Modeless Extension 使用 `resizeContent()` 调整内容尺寸；
- Extension 内监听 DOM Pointer / Keyboard 事件；
- Extension 之间通过 CEP Event 传递 JSON 数据。

### 4.2 公开能力中的缺口

CEP 11 公开 `CSInterface.js` 没有提供：

- 系统级 Global Hotkey；
- AE 任意 Panel 焦点下的 KeyDown / KeyUp 监听；
- Runtime 打开前的全局鼠标坐标；
- 设置 Modeless 窗口绝对屏幕坐标；
- 无焦点键盘 Hook；
- 明确的“关闭并恢复到原 AE Panel”接口。

窗口几何在 manifest 中只是首选尺寸。公开 API 提供尺寸调整，不提供绝对位置移动。因此“在鼠标附近显示”不能仅凭 manifest 或 `resizeContent()` 解决。

### 4.3 Route A 原型策略

P0 Runtime 使用四方向最小界面：

```text
       A

   D   ●   B

       C
```

行为：

- Runtime 打开后记录打开时间；
- PointerMove 根据中心点、Dead Zone 和角度选择 A/B/C/D；
- Runtime 有焦点时，指定测试键的 KeyUp 执行当前方向 Action；
- Esc 关闭且不执行；
- 执行完成后调用 `closeExtension()`；
- 浏览器 fixture 中以状态文本代替关闭，便于自动测试；
- AE 中执行 Host 测试动作，返回 AE 版本、项目名、活动合成名和动作 ID。

Route A 的目的不是提前宣称可用，而是精确测出第二 Extension 在真实 AE 中能走到链路的哪一步。

## 5. Route B：CEP + 现有 Runtime 能力

如果 AE 可以通过自己的 Keyboard Shortcuts 为“打开 Nya Pie P0”菜单命令分配快捷键，则继续测试：

1. 快捷键能否在不同 AE Panel 焦点下打开 Modeless Runtime；
2. 打开动作是否发生在 KeyDown 或完整按键结束后；
3. Runtime 是否能收到这次快捷键的 KeyUp；
4. Runtime 是否抢焦点；
5. AE 是否保留可恢复的原焦点；
6. Runtime 是否有任何可用的屏幕位置或鼠标位置线索。

这个路线可能解决“调用 Extension”，但没有公开证据表明它能解决 Hold 生命周期、打开前鼠标坐标和窗口绝对定位。只有真实 AE 测试结果可以决定。

还可验证 CEP 自定义事件，但事件只负责 Extension 之间通信，不负责产生全局热键或全局鼠标坐标。

## 6. Route C：NyaLauncher Native Helper

只有 Route A / B 无法完成完整链路时才进入 Route C。本轮不开发 Native Helper。

Windows 第一阶段建议 C#，职责严格限制为：

- 注册 Global Hotkey；
- 必要时使用低级 Keyboard Hook 追踪 KeyDown / KeyUp；
- 调用 `GetCursorPos`；
- 判断 After Effects 是否为前台应用；
- 向 Nya Pie Runtime 发送 Open / Move / Release / Cancel 信号。

禁止 Native Helper 承担：

- Action Registry；
- AE Tool Logic；
- Profile；
- Pie UI；
- NYAWORKS 设置或资源管理。

Native Helper 与 Runtime 之间的通信协议在 Route C 获批后再设计，P0 不提前引入 WebSocket、Named Pipe 或本地端口。

## 7. Action Registry 渐进式架构

### 7.1 数据类型

```ts
interface NyaActionDefinition {
  id: string;
  title: LocalizedActionText;
  description?: LocalizedActionText;
  icon: string;
  category: ActionCategory;
  requirements: readonly ActionRequirement[];
  supportsPie: boolean;
  execute: ActionExecutionDescriptor;
  undoPolicy: "none" | "host-undo-group";
}

interface ActionAvailability {
  enabled: boolean;
  reason?: string;
}

interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    detail?: string;
  };
}
```

职责拆分：

- `Action Registry`：只保存静态 Definition；
- `Context Engine`：根据 Context Snapshot 输出 Availability；
- `Action Runner`：解析 Definition，选择 executor，返回 ActionResult；
- `Host Executor`：通过现有 CEP Bridge 调用 ExtendScript；
- `Internal Executor`：执行不修改 AE 的内部命令。

### 7.2 渐进迁移

第一阶段不删除：

- `src/search/toolSearchCatalog.ts`
- `HOME_TOOL_CATALOG`
- 首页和 Banner 当前入口
- 现有 Anchor / Alignment / Resource Bridge

先提供 Adapter：

```text
Existing Catalog / Bridge
        ↓ Adapter
Action Definition / Executor
        ↓
runAction(actionId, context)
```

后续迁移顺序：

1. P0 测试 Action；
2. 锚点、对齐；
3. 全局搜索现有脚本、预设和效果；
4. 首页普通工具；
5. Banner；
6. Nya Pie 正式槽位。

任何功能在迁移期间仍只有一个 Host 实现，Adapter 只做映射。

## 8. P0 文件边界

新增：

```text
src/actions/
  types.ts
  registry.ts
  context.ts
  runner.ts
  executors.ts

src/nyaPie/p0/
  direction.ts
  runtimeController.ts
  cepLauncher.ts
  NyaPieP0Runtime.tsx
  main.tsx
  styles.css

nya-pie-runtime.html
tests/
  actionRegistry.test.ts
  actionRunner.test.ts
  nyaPieDirection.test.ts
  nyaPieRuntimeController.test.ts
  nyaPieCepLauncher.test.ts
  nyaPieManifest.test.ts
docs/testing/
  nya-pie-p0-ae-test.md
```

修改：

- `public/CSXS/manifest.xml`
- `public/host/index.jsx`
- `vite.config.ts`
- `scripts/smoke-dist.mjs`
- `README.md`
- `planning/02-roadmap.md`

不修改现有主题、语言、设置、首页布局或功能页视觉。

## 9. P0 验证顺序

### 自动验证

1. Direction 数学：Dead Zone、四象限、边界；
2. Runtime 状态机：Show、Move、KeyUp Execute、Esc Cancel、重复触发；
3. Action Registry：定义唯一、可查询、`supportsPie` 过滤；
4. Context Engine：需求满足与禁用原因；
5. Action Runner：未知 Action、不可用 Action、Host 成功、Host 失败；
6. Manifest：两个 Extension 属于同一 Bundle，Runtime 为 Modeless；
7. Vite：同时产出 `index.html` 与 `nya-pie-runtime.html`；
8. Smoke：主面板、Runtime、manifest、host 和品牌资源完整。

### 真实 AE 验证

依次测试焦点：

1. Composition；
2. Timeline；
3. Project；
4. Effect Controls；
5. NYAWORKS Panel。

每项记录：

- 快捷键是否触发；
- Runtime 是否出现；
- 鼠标坐标是否正确；
- KeyUp 是否收到；
- 测试 Action 是否执行；
- Runtime 是否关闭；
- 执行后焦点位置；
- 打开和关闭延迟。

环境矩阵：

- Windows 100% DPI；
- Windows 高 DPI；
- 双显示器；
- 屏幕边缘；
- 快速连续呼出；
- Esc；
- AE 最小化；
- AE 非前台；
- AE 快捷键冲突。

## 10. 成功标准

只有所有核心焦点场景都达到下面链路才判定 P0 成功：

```text
Hotkey
→ Correct Cursor Position
→ Runtime Near Cursor
→ Direction Selection
→ KeyUp
→ Host Test Action
→ Close
→ AE Focus Restored
```

延迟记录使用实测值，不在规格中预设虚假通过阈值。人工测试时同时记录：

- 从按键到 Runtime 可见；
- 从 KeyUp 到 ActionResult；
- 从 ActionResult 到 Runtime 消失。

如果不同机器差异明显，再依据数据确定发布阈值。

## 11. 失败判定与备用路线

### Route A / B 足够

只有当真实 AE 五种焦点场景、鼠标位置、KeyUp、焦点恢复和显示位置全部通过，才采用 CEP-only。

### Route A / B 部分可用

如果只能完成“打开 Modeless Extension”，但缺少任一能力：

- 全局 KeyDown / KeyUp；
- 打开前鼠标坐标；
- 窗口定位；
- AE 前台判断；
- 焦点恢复；

则 CEP-only 不满足 Nya Pie 产品目标。

### 进入 Route C

将失败证据写入测试记录，明确缺失 API 和复现步骤，然后单独设计 NyaLauncher。Native Helper 只补 Launcher 能力，Action Registry、Runtime UI 和 AE Tool Logic 继续留在 NYAWORKS。

## 12. 官方参考

- Adobe CEP 11 HTML Extension Cookbook：Extension Types、Modeless、键盘事件兴趣注册。
- Adobe CEP 11 `CSInterface.js`：`requestOpenExtension()`、`closeExtension()`、`resizeContent()`、`registerKeyEventsInterest()`。
- Adobe CEP Extension Manifest 7.0 Schema：多 Extension、`Modeless`、Geometry 和 Lifecycle。

这些资料证明可创建第二 Modeless Extension，但没有公开提供全局热键、全局鼠标位置或绝对窗口定位能力。最终结论必须以真实 After Effects 测试为准。
