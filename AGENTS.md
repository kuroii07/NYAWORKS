# NYAWORKS Project Instructions

本文件定义 **NYAWORKS / 喵创** 项目特有的技术、架构、兼容性和产品规则。

通用沟通方式、开发习惯、权限边界和完成汇报方式遵循用户的全局 `AGENTS.md`。

当前项目进度和开发优先级以当前任务、README 与 `planning/02-roadmap.md` 为准，不在本文件维护阶段性开发顺序。

---

## 🎯 项目定位

NYAWORKS 是面向 **Adobe After Effects** 的 CEP 创作效率工具与 Action Platform。

当前主要技术栈：

- React 18
- TypeScript
- Vite
- Adobe CEP
- ExtendScript / JSX
- After Effects Host API

GitHub：

`https://github.com/kuroii07/NYAWORKS.git`

NYAWORKS 不应逐渐演变成若干互相独立、重复实现的小工具集合。

长期架构方向是让不同 UI 入口尽量共享统一的 Action 与 Host 执行体系。

---

## 🧱 CEP 与技术边界

面板 UI 使用 React 18、TypeScript 和 Vite。

AE 宿主调用统一放在：

- `public/host/`
- 或项目后续明确建立的 `src/host/` / Host Adapter

不要把 AE DOM、`evalScript` 或大量 Host 业务逻辑散落在 React 组件中。

CEP 清单位于：

`public/CSXS/manifest.xml`

生产构建必须保证对应文件正确进入：

`dist/CSXS/manifest.xml`

静态资源应使用 CEP `file://` 环境可以正常加载的相对路径。

前端不要直接启用 Node.js 访问本地系统。需要文件系统或 AE 本地能力时，优先通过项目现有 CEP / ExtendScript Bridge 或明确设计的受控接口完成。

除非任务明确要求，不主动将项目迁移到其他框架，也不要重写现有 CEP 架构。

---

## ⚡ Action Architecture

NYAWORKS 的功能入口应逐步统一到同一套 Action 系统。

目标调用关系：

`UI Entry`
→ `Action ID`
→ `runAction()`
→ `Action Runner`
→ `Action Registry`
→ `Host Executor`
→ `Bridge`
→ `AE Host`

可能调用 Action 的入口包括但不限于：

- 首页工具
- 全局搜索
- Banner 快捷入口
- Command Palette
- 快捷键
- Nya Pie
- 后续其他快速调用入口

如果某个功能可能被多个入口复用，优先注册为统一 Action，而不是在不同 UI 中分别实现。

Action 的配置和持久化应优先保存稳定的：

`actionId`

不要复制 Action 的执行代码或为不同入口维护多套相同业务逻辑。

如果现有模块尚未完全迁移到 Action Registry，不要为了架构形式一次性重构整个项目。应在相关功能开发过程中逐步收敛。

---

## 🌉 Host / Bridge 边界

React / TypeScript 前端主要负责：

- UI
- 用户交互
- Action 调度
- 状态显示
- 必要的 AE Context 预判

真正改变 AE 工程状态的操作应由 Host 层执行。

Bridge 主要负责：

`Frontend ↔ CEP evalScript ↔ ExtendScript`

之间的通信与数据适配。

不要让 Bridge 逐渐成为包含大量业务逻辑的万能模块。

涉及以下操作时，应保持 Host 边界清晰：

- 合成
- 图层
- 属性
- 关键帧
- 效果
- 预设
- 菜单命令
- 项目项
- AE DOM

前端可以通过 Context Snapshot 判断按钮状态和改善 UX，但它不是最终安全依据。

真正执行 Action 前，Host 侧仍应重新验证必要的 AE 状态和执行条件。

---

## 🎬 After Effects 兼容性

主要目标环境：

- After Effects 2022–2026+
- Windows 优先
- 同时考虑 macOS
- 中文 AE
- English AE

不要假设 AE 界面语言一定为英文。

涉及：

- Menu Command
- Effect 名称
- 属性名称
- 本地化文本

时，避免只依赖某一种 AE 语言的字符串。

如果能够使用稳定 ID、Host API、Match Name、统一兼容层或其他不依赖 UI 语言的方式，应优先采用。

修改 Host 功能时，需要考虑不同 AE 版本以及中文 / 英文环境可能产生的差异。

---

## 🥧 Nya Pie

**Nya Pie 是 NYAWORKS 的快捷调用方式，不是第二套独立工具系统。**

Nya Pie 应消费现有 Action Registry。

槽位、Profile 和快捷调用配置应优先保存：

`actionId`

而不是复制 Action 执行逻辑。

Nya Pie 可以拥有自己的：

- Runtime
- 管理页面
- Profile
- Slot 配置
- 快捷键
- 呼出逻辑
- 动画与交互

但真正执行功能时，应继续进入统一 Action 系统。

开发 Nya Pie 时，不要复制 NYAWORKS 已有工具实现，也不要建立第二套 Tool Registry。

---

## 🎨 UI / Theme

NYAWORKS 对视觉质量要求较高。

功能实现与视觉完成度同样重要。

新增和修改 UI 时优先复用项目已有：

- Design Token
- `--nw-*` CSS Variables
- 公共组件
- 图标体系
- Theme 系统
- 排版与间距规则

不要在组件内部随意硬编码本应由 Design Token 或 Theme 管理的颜色与样式。

### 主题

项目只提供五套暗色主题，不开发白色亮色模式。

默认主题：

**极夜青**

固定顺序：

1. 极夜青
2. 星云紫
3. 熔金琥珀
4. 翡翠深海
5. 樱夜绯粉

不要因为新增页面或组件建立独立于现有 Theme Provider 的主题状态。

### UI 组件

设置页及后续功能页的选择型下拉菜单统一优先复用：

`src/components/SettingSelect.tsx`

不要直接使用会显示 Windows 原生弹层的 `<select>`。

展开浮层应与触发框保持合理对齐，并遵循现有 UI 规范。

如果项目当前使用 Phosphor Icons，应优先延续现有图标体系，不无必要混入风格不同的图标库。

主题入口继续使用项目既定的三圆点 / 轨道式图标，不重新使用已弃用的调色盘图标。

UI、面板、图标、动效和交互的长期参考标准见：

`docs/references/ui-panel-icon-motion-interaction-standard.md`

其中 Adobe Spectrum Web Components 用于官方 UI 语义和状态参考；IconPark 官方图标库是新功能图标的优先来源；React/CEP 项目不得因为参考 SWC 或 UXP 而未经评估迁移架构。第三方动效和组件资源只用于场景与交互参考，不自动成为运行时依赖。

### CEP 面板环境

UI 修改需要考虑：

- CEP 面板实际尺寸
- 窄面板状态
- 高 DPI
- 长文本
- 不同语言产生的宽度变化
- 必要的 Hover / Active / Disabled 等反馈

不要因为开发一个新功能顺便重新设计整个产品视觉语言。

---

## 🌐 Localization

语言规划：

- 简体中文
- 繁体中文
- English
- 日本語
- 한국어

语言入口既定行为：

- 左键快速切换简体中文 / English
- 右键打开完整语言选择
- 繁体中文状态显示 `繁`
- 日本語状态显示 `あ`
- 한국어状态显示 `한`

新增用户可见文本时，应接入现有 i18n / Language 系统，不要在组件中大量硬编码中文或英文。

新增或修改 UI 时注意不同语言下的：

- 文本溢出
- Button / Label 宽度
- 布局稳定性

不要为了完成单一语言需求破坏已有多语言结构。

---

## 🧭 导航与产品约束

左侧主要导航：

- 主页
- AI
- 项目
- 合成
- 图层
- 动画
- 文字
- 图形
- 效果
- 媒体

右上角保留：

- Theme
- Language
- Settings

尚未真正实现的功能必须明确表现为未完成、占位或不可用状态。

不要为了视觉完整度伪造成功状态、真实数据或已经实现的能力。

---

## 🧠 全局状态与 Provider

新增全局功能前，优先检查项目现有的 Provider、Context、Store 和 Settings 系统。

已有系统能够扩展时，应优先扩展现有系统。

特别注意避免重新创建平行的：

- Theme 状态
- Language 状态
- Settings 状态
- Action 来源
- 全局配置来源

同一个全局概念原则上应只有一个可信数据源。

---

## 🎞️ Preset / Creative Tools

涉及动画预设、效果预设和创作资产时，应结合实际 AE 创作流程设计。

长期方向包括：

- GIF / MP4 轻量预览
- 快速应用预设
- 拖拽应用
- Asset / Preset 管理

预设系统应尽量保持：

`资产数据 / 展示 / 预览`

与

`真正的 AE Host 应用逻辑`

职责分离。

不要为了实现 UI 预览绕过现有 Action / Host 架构。

---

## 🛡️ AE 操作安全

真正修改 AE 工程时，应优先采用可预测、可验证的行为。

能够通过非破坏方式实现时，不主动选择破坏性方案。

以下类型的 Action 应尤其注意执行范围：

- 删除
- 替换
- 覆盖
- 批量修改
- 批量应用效果
- 批量修改关键帧
- 项目结构修改

不要只依赖前端按钮的 Disabled 状态保证安全。

Host 层执行前仍应验证必要条件。

---

## 🧪 项目验证

项目已有验证命令：

```bash
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run verify
```

根据本次修改范围运行相关检查。

### Frontend 修改

至少关注：

- TypeScript
- Build
- UI 状态
- 主题与语言兼容

### Action 修改

重点检查：

`Registry → Runner → Executor`

调用链是否正确。

### Host / AE 修改

重点检查：

`Frontend → Bridge → JSX → AE Host`

整个调用链。

浏览器中的 UI 正常只能证明前端渲染和部分逻辑正常：

**Frontend / Browser Validation ≠ Real AE Host Validation**

涉及 CEP 或 AE Host 行为时，应明确区分：

- Frontend / Mock 已验证
- CEP Bridge 已验证
- Real AE Host 已验证

如果当前环境无法运行真实 AE，不要把前端验证描述成 AE 功能已经完整验收。

真实 AE 验证记录应按实际需要包含：

- AE 版本
- 操作系统
- CEP 安装 / 加载情况
- 中文或英文 AE 环境
- 实际测试结果

---

## 📚 文档与 Roadmap

阶段性开发顺序不写死在本文件中。

当前开发计划以：

- 当前任务
- README
- `planning/02-roadmap.md`

为准。

当以下内容发生实际变化时，再按需要同步相关文档：

- 用户使用方式
- 功能状态
- 架构
- API / 接口
- 配置方式
- 项目 Roadmap

纯 UI 微调、内部重构或不影响使用方式的小修改，不要求机械更新 README。

---

## 🚧 Architecture Guardrails

除非当前任务明确要求改变架构，否则不要：

- 绕过 Action Registry 建立新的平行执行体系
- 为不同 UI 入口复制同一个工具的执行逻辑
- 在 React 组件中堆积 AE Host 业务代码
- 把大量业务逻辑塞进 Bridge
- 建立第二套 Theme / Language / Settings 系统
- 依赖单一 AE 界面语言字符串实现核心功能
- 为局部需求重构整个 Host 架构
- 因开发 Nya Pie 而复制 NYAWORKS 的工具系统

如果现有代码与本文件描述不一致：

1. 先检查是否属于历史代码
2. 检查是否处于正在迁移的架构
3. 检查项目文档和当前任务
4. 再决定是延续现状还是逐步迁移

不要为了让代码“看起来符合 AGENTS.md”而进行无必要的大规模重构。

---

## 📌 项目规则原则

本文件负责定义 **NYAWORKS 长期稳定的项目规则**。

不要在这里持续堆积：

- 临时任务
- 当前 Sprint
- 一次性 Bug
- 某轮开发计划
- 已完成事项
- 详细产品 Roadmap

这些内容应进入对应的任务、README、Planning 或其他项目文档。

当长期架构或稳定产品规则发生变化时，再更新本文件。
