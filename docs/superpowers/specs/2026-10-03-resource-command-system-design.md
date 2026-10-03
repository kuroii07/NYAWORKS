# NYAWORKS 资源命令系统设计

日期：2026-10-03
状态：待用户审阅
范围：资源功能页的统一命令、右键菜单、稳定选中模型与键盘操作

## 1. 背景与现状

NYAWORKS 已经具备资源来源、索引、筛选、收藏及基础执行能力，资源类型包括：

- 脚本（`script`）
- ScriptUI 面板（`panel`）
- 启动脚本（`startup`）
- 预设（`preset`）
- 表达式（`expression`）

当前资源行支持双击执行；资源行自身获得焦点时也可按 `Enter` 执行。Host Bridge 已能执行脚本、尝试打开面板、向选中图层应用预设，并向选中的可表达式属性写入表达式。

但这些能力仍停留在“资源行直接调用 Host”的局部实现，存在以下缺口：

1. 资源页没有稳定的“当前选中资源”，焦点、悬停和选中状态没有清晰区分。
2. 没有资源右键菜单，复制路径、文件定位、刷新来源等已有或预留能力无法从资源页使用。
3. 缺少列表方向键、小键盘方向键、`Home`、`End` 和键盘菜单键支持。
4. 资源页、全局搜索和未来首页快捷方式可能各自复制资源执行判断，长期容易出现行为和反馈不一致。
5. 现有 `CompactActionMenu` 只满足锚点按钮菜单，不具备鼠标坐标定位、菜单分组、快捷键提示和完整菜单键盘导航。

因此，本阶段不只是在资源行上“加一个右键菜单”，而是建立一套可由多个入口复用的资源命令系统。

本设计补充并细化《NYAWORKS 资源系统设计》。若两份文档在资源执行行为上存在差异，以本设计为准；资源来源、扫描和索引规则仍沿用原设计。

## 2. 目标

### 2.1 产品目标

- 让用户通过鼠标、键盘和全局搜索获得一致的资源操作结果。
- 为脚本、面板、启动脚本、预设和表达式提供符合各自语义的主动作及菜单。
- 使专业用户可以连续浏览、选择、执行资源，不必在鼠标与键盘之间反复切换。
- 在执行有前置条件的资源时，提前说明不可用原因，并在执行后给出可核对的数量反馈。
- 为未来“添加到首页”、最近使用和资源预览提供稳定的命令边界，但不在本阶段实现这些功能。

### 2.2 工程目标

建立以下统一调用关系：

```text
资源页右键菜单 ─┐
资源页 Enter/双击 ├→ Resource Command Service → ResourceProvider / Host Bridge
全局搜索 ────────┘                         → Clipboard / OS File Action

未来：首页资源快捷方式 ───────────────────────┘
```

每个入口只负责选择资源和触发命令，不再自行判断资源类型、拼接路径或翻译 Host 错误。

## 3. 非目标

第一阶段不开发：

- 多选、批量执行或批量收藏；
- 将动态资源添加到首页；
- 表达式代码预览、编辑器或语法高亮；
- 最近使用列表或执行历史界面；
- 自定义快捷键编辑器；
- 拖放排序、资源重命名、移动、删除或覆盖原始文件；
- macOS 文件定位与编辑器桥接；
- 云端资源下载、同步或权限管理；
- 在资源页启用或停用 AE 启动脚本；
- 自动信任或静默执行未知来源脚本。

本阶段保持单选模型，避免脚本、预设和表达式被意外批量执行。

## 4. 核心设计原则

### 4.1 一个命令，多种入口

同一资源动作只有一份定义和一条执行链。右键菜单、`Enter`、双击和全局搜索不得分别维护资源类型判断。

### 4.2 选择与执行分离

单击只选中资源，不执行；双击或 `Enter` 才触发主动作。右键点击未选中行时先选中该行，再打开菜单。

### 4.3 前置条件可解释

命令不可用时不隐藏核心动作，而是显示禁用状态和原因，例如“请先在 AE 中选择至少一个图层”。

### 4.4 保留上下文

执行成功或失败后都保留当前选中资源。刷新导致资源仍存在时继续保持选中；资源消失时再按确定性规则选择邻近项。

### 4.5 平台行为优先

右键菜单、键盘导航、焦点恢复和文件定位遵循 Windows 桌面软件习惯。菜单不复刻参考产品的视觉和结构，只吸收用户熟悉的交互模型。

## 5. 统一资源命令模型

### 5.1 命令标识

第一阶段定义以下命令：

```text
resource.use
resource.favorite.toggle
resource.path.copy
resource.file.reveal
resource.source.refresh
resource.info.view
resource.file.open-default
```

其中 `resource.use` 是类型化主动作，显示名称和执行逻辑由资源类型决定。

### 5.2 建议类型

```ts
type ResourceCommandId =
  | "resource.use"
  | "resource.favorite.toggle"
  | "resource.path.copy"
  | "resource.file.reveal"
  | "resource.source.refresh"
  | "resource.info.view"
  | "resource.file.open-default";

interface ResourceCommandContext {
  resource: IndexedResource;
  source: ResourceSource;
  absolutePath: string;
  hostStatus: "loading" | "connected" | "unavailable" | "error";
}

interface ResourceCommandAvailability {
  visible: boolean;
  enabled: boolean;
  disabledReason?: ResourceCommandDisabledReason;
}

interface ResourceCommandDefinition {
  id: ResourceCommandId;
  group: "primary" | "organize" | "file" | "source" | "details";
  getLabel(context: ResourceCommandContext): ResourceCommandLabelKey;
  getAvailability(context: ResourceCommandContext): ResourceCommandAvailability;
  run(context: ResourceCommandContext): Promise<ResourceCommandResult>;
}
```

`getAvailability` 只处理前端可以确定的条件，例如 Host 是否连接、路径是否完整、命令是否适用于当前类型。AE 中是否选中图层或属性仍由 Host 在执行时确认，避免为了打开菜单就发起 Host 查询。

### 5.3 命令结果

```ts
type ResourceCommandResult =
  | {
      ok: true;
      commandId: ResourceCommandId;
      resourceId: string;
      affectedItems?: number;
    }
  | {
      ok: false;
      commandId: ResourceCommandId;
      resourceId: string;
      reason: ResourceCommandFailureReason;
      detail?: string;
    };
```

所有入口根据统一结果产生本地化反馈。入口不得直接解析 ExtendScript 返回字符串。

### 5.4 职责边界

- `resourceCommands.ts`：命令定义、类型化标签、可用性和结果归一化。
- `ResourceProvider`：读取资源与来源、收藏状态持久化、刷新来源及调用 Bridge。
- `resourceBridge.ts`：CEP 调用、入参与返回值解析，不负责 UI 文案。
- `public/host/index.jsx`：AE 与文件系统实际操作，不负责界面状态。
- `ResourcesPage`、全局搜索：选择目标、触发命令、显示统一反馈。

## 6. 按资源类型的主动作

| 资源类型 | `resource.use` 显示名称 | 行为 | 成功反馈 |
|---|---|---|---|
| `script` | 执行脚本 | 通过 `$.evalFile` 执行文件 | 已执行“资源名” |
| `panel` | 打开面板 | 优先查找并执行 AE 已注册的面板菜单命令 | 已打开“资源名” |
| `startup` | 立即运行一次 | 在当前 AE 会话中通过 `$.evalFile` 手动执行 | 已运行一次“资源名” |
| `preset` | 应用预设 | 向所有当前选中图层应用 `.ffx` | 已向 N 个图层应用“资源名” |
| `expression` | 应用表达式 | 向所有当前选中的可表达式属性写入内容 | 已向 N 个属性应用“资源名” |

### 6.1 ScriptUI 面板规则

面板主动作不是一般意义的“执行脚本”。Host 先用文件名查找 AE 菜单命令：

1. 找到命令时执行命令并返回成功。
2. 找不到命令时不得自动退化为 `$.evalFile` 后宣称“已打开面板”。
3. 返回 `panel-not-registered`，提示“该面板尚未被 AE 注册，请确认它位于 ScriptUI Panels 目录并重启 AE”。

该规则避免打开浮动窗口、重复注册或无界面返回时造成误判。

### 6.2 Startup 规则

“立即运行一次”只表示在当前会话中手动执行该文件：

- 不移动、复制或修改启动脚本文件；
- 不更改 AE 下次启动时是否自动加载；
- 菜单和成功反馈必须出现“运行一次”语义，避免用户误解为启用启动项。

### 6.3 预设规则

- 没有选中图层时返回 `no-selected-layer`。
- 在一个 Undo Group 中向所有选中图层应用。
- 成功结果必须包含 `affectedItems`，值为实际处理的图层数。
- 任一应用异常时整体返回失败，并确保关闭 Undo Group。

### 6.4 表达式规则

- 支持现有 `.jsx`、`.txt`、`.json` 表达式资源格式。
- `.json` 读取 `expression`，兼容现有 `code` 字段。
- 空内容返回 `empty-expression`。
- 没有选中可写表达式的属性时返回 `no-selected-property`。
- 在一个 Undo Group 中写入所有可表达式属性。
- 成功结果必须包含 `affectedItems`，值为实际写入的属性数。

## 7. 资源选择与焦点状态机

### 7.1 状态

资源页维护：

```ts
interface ResourceSelectionState {
  selectedResourceId: string | null;
  focusedResourceId: string | null;
}
```

- `selectedResourceId`：用户当前操作目标，负责持续高亮和菜单目标。
- `focusedResourceId`：键盘焦点所在行，用于无障碍和方向键移动。
- 悬停由 CSS 指针状态表达，不写入 React 业务状态。

单选阶段通常保持选择与焦点一致，但类型仍分开，以支持右键打开菜单、关闭菜单恢复焦点等场景。

### 7.2 状态转换

| 输入 | 选择变化 | 焦点变化 | 是否执行 |
|---|---|---|---|
| 左键单击行 | 选择该行 | 聚焦该行 | 否 |
| 双击行 | 选择该行 | 聚焦该行 | 是，主动作一次 |
| 右键未选中行 | 选择该行 | 打开菜单后焦点进菜单 | 否 |
| 右键已选中行 | 保持 | 打开菜单后焦点进菜单 | 否 |
| 方向键 | 选择目标行 | 聚焦目标行 | 否 |
| `Enter` / `NumpadEnter` | 保持 | 保持 | 是，主动作一次 |
| `Esc`（菜单关闭） | 保持 | 恢复至触发行 | 否 |

双击事件不能额外触发单击执行，因为单击只负责选择；因此双击只执行一次。

### 7.3 列表变化后的选择

当搜索、来源、文件夹或类型筛选改变：

1. 当前选中资源仍在结果内：保留选择。
2. 当前选中资源不在结果内：清空选择，不自动执行任何项目。
3. 用户随后按方向键：从第一项（向下）或最后一项（向上）建立选择。

当刷新来源后：

1. 资源 ID 仍存在：保留选择。
2. 资源已消失：优先选择原可见索引位置的新项目；没有项目则清空。

### 7.4 视觉状态

三个状态必须可以分别识别：

- 悬停：轻微表面色变化，不使用持续高亮边框。
- 选中：使用品牌强调色的弱背景和明确边框或内描边。
- 键盘焦点：在选中样式之外显示可见焦点环，不得只靠颜色变化。

执行中只锁定当前资源的主动作，不能让整页失去滚动和浏览能力；同一资源不得并发重复执行。

## 8. 键盘映射

当焦点位于资源列表或资源行时：

| 按键 | 行为 |
|---|---|
| `ArrowDown` | 选择并聚焦下一条；末项不循环 |
| `ArrowUp` | 选择并聚焦上一条；首项不循环 |
| `Numpad2` | 与 `ArrowDown` 相同 |
| `Numpad8` | 与 `ArrowUp` 相同 |
| `Enter` | 执行当前选中资源的主动作 |
| `NumpadEnter` | 与 `Enter` 相同 |
| `Home` | 选择并聚焦第一条 |
| `End` | 选择并聚焦最后一条 |
| `Shift+F10` | 在选中行附近打开右键菜单 |
| 键盘 Menu 键 | 与 `Shift+F10` 相同 |
| `Escape` | 关闭菜单；无菜单时不清除资源选择 |
| `Ctrl+F` | 聚焦并全选资源搜索框内容 |

实现时优先判断 `event.key`，并用 `event.code` 补充识别 `Numpad2`、`Numpad8`、`NumpadEnter`。文本输入框、选择器和菜单内部拥有自己的按键语义，资源列表处理器不得截获其中的方向键和 `Home` / `End`。

列表使用 roving `tabIndex`：只有当前选中行或首个可用行是 `tabIndex=0`，其余行为 `-1`。`Tab` 用于离开列表，不逐条遍历全部资源。

## 9. 右键菜单

### 9.1 打开方式

- 鼠标右键：以指针 `clientX/clientY` 为首选锚点。
- `Shift+F10` 或 Menu 键：以选中行可视矩形的左下方为锚点。
- 菜单用 Portal 渲染到 `document.body`，避免被列表滚动容器裁切。
- 菜单必须限制在可视区域内，距边缘至少 8px；右侧或下方空间不足时自动向左或向上展开。
- 页面滚动、窗口尺寸变化或过滤结果变化时关闭菜单，避免菜单与目标错位。

### 9.2 菜单结构

```text
[主动作：随资源类型变化]                  Enter
────────────────────────────────────────
收藏 / 取消收藏
────────────────────────────────────────
复制完整路径
在资源管理器中显示
用默认编辑器打开        （仅可编辑文本资源）
────────────────────────────────────────
更新当前来源
────────────────────────────────────────
查看资源信息
```

规则：

- `script`、`startup`、`expression` 的可编辑文本格式显示“用默认编辑器打开”。
- `.jsxbin` 不显示编辑器命令；`preset`、`panel` 第一阶段不显示该命令。
- “收藏 / 取消收藏”根据当前状态动态变化。
- 分隔线只在相邻可见分组都存在项目时出现。
- 暂不加入删除、移动、重命名和批量操作。

### 9.3 菜单键盘行为

- 打开后自动聚焦第一个可用菜单项。
- `ArrowDown` / `ArrowUp` 在可用菜单项间循环。
- `Home` / `End` 跳到首个 / 最后一个可用菜单项。
- `Enter` 或 `Space` 执行当前菜单项。
- `Escape` 关闭菜单并把焦点恢复到触发行。
- `Tab` 关闭菜单并按页面正常顺序移动焦点，不把焦点困在菜单内。
- 禁用项可被读屏读取，但不进入 roving focus。
- 点击菜单外区域关闭菜单并保留资源选择。

### 9.4 组件策略

新增 `ResourceContextMenu`，并抽取或升级通用菜单基础能力。不得把坐标定位、键盘 roving focus 和焦点恢复逻辑直接堆进 `ResourcesPage.tsx`。

现有 `CompactActionMenu` 的视觉 token 可以复用，但资源菜单需要支持：

- 坐标或元素两种锚点；
- 分组与分隔线；
- 快捷键标签；
- 禁用原因；
- 完整键盘导航；
- 打开自动聚焦与关闭焦点恢复。

如果升级 `CompactActionMenu` 会让其 API 同时承担两套不相容语义，应抽取新的 `ActionMenu` 基础组件，再由 `CompactActionMenu` 和 `ResourceContextMenu` 分别封装。

## 10. 命令矩阵

| 命令 | Script | Panel | Startup | Preset | Expression |
|---|---:|---:|---:|---:|---:|
| 类型化主动作 | 执行 | 打开 | 运行一次 | 应用 | 应用 |
| 收藏 / 取消收藏 | 是 | 是 | 是 | 是 | 是 |
| 复制完整路径 | 是 | 是 | 是 | 是 | 是 |
| 在资源管理器中显示 | 是 | 是 | 是 | 是 | 是 |
| 用默认编辑器打开 | `.jsx/.js` | 否 | `.jsx/.js` | 否 | `.jsx/.txt/.json` |
| 更新当前来源 | 是 | 是 | 是 | 是 | 是 |
| 查看资源信息 | 是 | 是 | 是 | 是 | 是 |

## 11. 文件与系统动作

### 11.1 完整路径

绝对路径统一由来源根目录与资源 `relativePath` 通过一个纯函数生成：

- 先规范路径分隔符；
- 去除来源末尾和相对路径开头的重复分隔符；
- 不允许 `..` 逃逸来源根目录；
- 命令执行前再次确认资源所属来源存在。

资源页、全局搜索和 Host Bridge 都不得各自拼接一套路径。

### 11.2 复制路径

- CEP 环境优先使用可用的剪贴板能力。
- 浏览器开发环境可使用 `navigator.clipboard.writeText`。
- 复制成功显示“已复制完整路径”；失败显示明确错误，不静默吞掉。
- 复制路径不需要 AE Host 连接。

### 11.3 在资源管理器中显示

Windows 使用文件选择语义，而不是只打开来源目录：

```text
explorer.exe /select,"<absolute-file-path>"
```

路径必须作为单一参数正确引用，不得把用户路径拼成可执行任意命令的字符串。文件不存在时返回 `invalid-resource`，并建议更新当前来源。

### 11.4 用默认编辑器打开

调用 Windows 对该文件类型的默认打开行为，不写死记事本或其他编辑器。该动作只对命令矩阵中允许的文本资源出现。

第一阶段不承诺在面板内编辑或保存资源文件。

### 11.5 查看资源信息

打开只读信息弹层，至少展示：

- 名称
- 类型
- 来源名称
- 完整路径
- 最后修改时间
- 收藏状态

信息弹层不提供重命名、修改类型或编辑路径能力。

## 12. 安全与可信来源

### 12.1 路径安全

- 所有文件动作必须确认目标路径位于对应来源根目录内。
- Host 端重新验证文件存在、扩展名与资源类型匹配。
- 不接受由 UI 直接传入任意可执行命令。

### 12.2 脚本执行安全

资源系统原设计中的“外部脚本首次运行确认”和“可信脚本”管理仍是目标能力。第一阶段命令接口必须预留：

```text
untrusted-source
confirmation-required
```

如果可信来源机制尚未落地，本阶段不得用伪确认对话框宣称已经具备完整安全管理；相关实现应在实施计划中明确为独立工作项或后续阶段。AE 内置来源与用户手动添加来源的信任规则不得在 UI 层硬编码。

### 12.3 破坏性边界

第一阶段所有菜单动作都不删除、覆盖、移动或重写资源原文件。应用表达式和预设属于 AE 项目修改，必须纳入 Undo Group。

## 13. 错误、禁用态与反馈

### 13.1 失败原因

统一结果至少覆盖：

```text
host-unavailable
invalid-resource
source-missing
no-selected-layer
no-selected-property
empty-expression
panel-not-registered
unsupported-file-type
clipboard-failed
system-open-failed
confirmation-required
untrusted-source
host-error
```

### 13.2 禁用原因

菜单禁用项通过可访问描述提供原因。常见示例：

- “AE Host 当前不可用”
- “资源文件已不存在，请更新来源”
- “该文件类型不支持默认编辑器动作”

图层和属性选择属于可能随时变化的 AE 状态，主动作通常保持可点击，由 Host 返回精确原因；不为了菜单展示而缓存易过期的宿主选择状态。

### 13.3 反馈规则

- 成功 Toast 必须包含动作和资源名。
- 预设与表达式成功时必须显示实际目标数量。
- 失败 Toast 使用用户可理解的本地化原因；Host `detail` 只在适合时作为补充，不直接暴露堆栈。
- 收藏、复制路径等轻量命令不显示阻塞式弹窗。
- 执行失败后保留选择、焦点和筛选条件。
- 刷新来源属于异步操作，执行中菜单关闭，但资源行选择保留。

## 14. 国际化与无障碍

### 14.1 国际化

所有新增标签、禁用原因、成功与失败反馈必须覆盖项目现有五种语言：

- 简体中文
- 繁体中文
- 英文
- 日文
- 韩文

现有 `copyPath`、`revealSource`、`refreshSource` 文案可复用，但要统一“文件”与“来源”的语义。英文菜单文案采用短句，快捷键放在独立列，避免撑宽菜单。

### 14.2 语义

- 资源列表使用 `role="listbox"`，资源行使用 `role="option"` 与 `aria-selected`；不再把整行模拟为普通 `role="button"`。
- 菜单使用 `role="menu"`、菜单项使用 `role="menuitem"`。
- 菜单禁用项使用 `aria-disabled="true"`，不能只依赖原生 `disabled` 导致原因无法被读取。
- 执行中资源使用 `aria-busy="true"`。
- Toast 或状态区域使用项目现有可访问播报机制。

### 14.3 可见性与目标尺寸

- 焦点环在深浅主题下都必须清晰可见。
- 文本与背景满足 WCAG AA 对比度。
- 菜单项高度不得小于当前项目紧凑控件基线；图标不能替代文字标签。
- 快捷键提示是辅助信息，不得成为唯一操作说明。

## 15. 与全局搜索和现有 Host Bridge 的关系

### 15.1 全局搜索

当前全局搜索自行将资源类型映射到 `run-script`、`apply-preset` 和 `open-expression`。实施后改为：

```text
GlobalSearchItem.resourceId
→ Resource Command Service.run("resource.use", resourceId)
→ 统一结果与反馈
```

全局搜索不再拼接来源路径，也不再维护资源类型分支。

### 15.2 ResourceProvider

Provider 对外增加按资源 ID 构建命令上下文和运行命令的能力，或由独立 Service 使用 Provider 暴露的最小操作集合。Provider 不保存右键菜单开关、坐标或焦点等页面局部状态。

### 15.3 Host Bridge

沿用现有 Host 方法时，需要补齐：

- 预设成功返回实际图层数量；
- 表达式的 `updatedProperties` 归一为 `affectedItems`；
- 面板找不到菜单命令时返回 `panel-not-registered`，不自动回退执行；
- 新增定位具体文件和使用系统默认程序打开文件的安全 Bridge；
- 各 Bridge 结果映射到统一失败原因。

## 16. 第一阶段与第二阶段

### 16.1 第一阶段

本规格进入实施计划的范围：

1. 稳定的单选与焦点模型。
2. 鼠标与键盘右键菜单。
3. 方向键、小键盘、`Enter`、`Home`、`End`、`Ctrl+F`。
4. 五种资源的类型化主动作。
5. 收藏、复制路径、定位文件、默认编辑器、刷新来源和资源信息。
6. 统一命令结果、错误映射与数量反馈。
7. 全局搜索接入统一资源主命令。
8. 自动化测试和真实 AE 验收文档。

### 16.2 第二阶段

另行设计与确认：

- 添加到首页；
- 表达式代码预览与编辑；
- 最近使用；
- 多选和批量操作；
- 用户自定义快捷键；
- 更完整的可信来源与首次执行管理界面。

“添加到首页”不能在第一阶段顺手加入。当前首页布局只接受固定 `ToolId`，动态资源需要新的快捷项 schema、持久化迁移、失效资源占位和编辑规则，必须单独设计。

## 17. 数据与文件边界

### 17.1 持久化数据

第一阶段不改变资源设置 schema：

- 当前选择、焦点和菜单状态不持久化。
- 收藏继续使用现有 `IndexedResource.favorite`。
- 命令定义不写入用户设置。
- 执行成功继续更新现有 `lastUsedAt` 时，应由唯一执行入口负责，避免重复写入。

### 17.2 预计新增文件

```text
src/resources/resourceCommands.ts
src/resources/resourceSelection.ts
src/components/ResourceContextMenu.tsx
tests/resourceCommands.test.ts
tests/resourceSelection.test.ts
tests/resourceContextMenu.test.tsx
docs/testing/resource-command-ae-test.md
```

### 17.3 预计修改文件

```text
src/pages/ResourcesPage.tsx
src/resources/ResourceProvider.tsx
src/resources/types.ts
src/host/resourceBridge.ts
public/host/index.jsx
src/components/CompactActionMenu.tsx（或抽取新的通用菜单基础）
src/search/GlobalSearchProvider.tsx
src/i18n/types.ts
src/i18n/translations.ts
tests/resourcePage.test.tsx
tests/resourceBridge.test.ts
tests/resourceHostActions.test.js
tests/globalSearchProvider.test.tsx
README.md
planning/02-roadmap.md
```

最终实施计划可根据测试驱动拆分调整文件，但不得把页面局部 UI 状态下沉到 Provider，也不得让 Host 层持有 React 交互状态。

## 18. 自动化测试

### 18.1 纯逻辑测试

- 绝对路径规范化与来源根目录约束。
- 五种资源的主动作标签与命令映射。
- 命令可见性和禁用原因。
- 选择下一项、上一项、首项、末项和筛选后失效规则。
- 资源刷新后保留或迁移选择的规则。
- Host 结果到统一命令结果的映射。

### 18.2 组件测试

- 单击只选择，双击执行一次。
- `ArrowUp/ArrowDown` 与 `Numpad8/Numpad2` 移动选择。
- `Enter/NumpadEnter` 执行当前项。
- `Home/End` 跳转。
- `Ctrl+F` 聚焦并全选搜索框。
- 右键未选中行先选择再开菜单。
- `Shift+F10` 和 Menu 键打开菜单。
- 菜单坐标受视口约束，滚动或尺寸变化后关闭。
- 菜单 roving focus、跳过禁用项、执行、关闭和焦点恢复。
- 筛选变化清除不可见选择但不执行资源。
- 执行失败后保留选择。
- 五语言关键文案存在，英文长文案不破坏菜单布局。

### 18.3 Bridge 与 Host 测试

- 脚本和启动脚本执行正确文件。
- 已注册 Panel 执行 AE 菜单命令。
- 未注册 Panel 返回 `panel-not-registered` 且不调用 `$.evalFile`。
- 预设返回选中图层数量并正确关闭 Undo Group。
- 表达式返回写入属性数量。
- 文件定位使用 `/select,` 并正确处理空格、中文和引号边界。
- 默认编辑器动作拒绝不允许的扩展名。
- 路径逃逸和不存在的文件被拒绝。

## 19. 真实 AE 验收清单

在 CEP 浏览器测试通过后，必须由用户在实际 After Effects 中验证：

### 19.1 通用交互

- 单击任意资源只选中，不执行。
- 双击和 `Enter` 各只执行一次。
- 主键盘和小键盘导航均正确，列表滚动能跟随当前选择。
- `Shift+F10`、Menu 键和鼠标右键打开的是同一套菜单。
- 菜单靠近面板四个边缘时不溢出、不被裁切。
- 关闭菜单后焦点回到原资源行。
- 搜索和筛选后选择状态符合本规格。

### 19.2 类型动作

- 普通脚本成功执行。
- 已注册 ScriptUI Panel 能被打开；未注册面板给出重启提示且不误报成功。
- Startup 只立即运行一次，不修改启动配置。
- 无选中图层时预设提示正确；多图层应用后数量正确，并可一次撤销。
- 无可表达式属性时提示正确；多个属性应用后数量正确，并可一次撤销。

### 19.3 文件动作

- 复制路径得到真实完整路径。
- “在资源管理器中显示”打开文件夹并选中具体文件。
- 中文、空格和深层目录路径均正常。
- 文本资源由 Windows 默认关联程序打开，不写死记事本。
- 文件被外部删除后返回明确错误，并可刷新来源恢复正确索引。

### 19.4 视觉与语言

- 悬停、选中、焦点三个状态在深浅主题下都可区分。
- 菜单在五种语言下不截断关键动作，不遮挡快捷键。
- 520px 目标面板宽度下可正常使用。
- 高 DPI 缩放下菜单坐标和焦点环正常。

验收结论记录在 `docs/testing/resource-command-ae-test.md`，包括 AE 版本、Windows 缩放比例、通过项、失败项和截图或错误文本。

## 20. 成功标准

本阶段只有同时满足以下条件才算完成：

1. 五种资源都通过同一 `resource.use` 命令进入 Host，不再由资源页和全局搜索分别判断。
2. 鼠标、主键盘和小键盘可完整完成选择、执行、打开菜单和关闭菜单。
3. 右键菜单包含已定义的类型化动作和文件动作，位置稳定且不被裁切。
4. 预设与表达式反馈实际目标数量；面板不会在未注册时误报成功。
5. 失败不会丢失当前资源选择和筛选上下文。
6. 新增文案完成五语言覆盖，交互满足基本键盘与读屏语义。
7. 自动化测试、类型检查、构建和分发 smoke test 全部通过。
8. 用户在真实 AE 中完成验收清单并确认结果。

## 21. 待确认事项

本文档已将本轮讨论中的选择固化为确定规格，没有遗留未决占位项。用户确认本文档后，下一步仅编写详细实施计划，不直接进入编码；实施计划再次确认后才开始修改产品代码。
