# NYAWORKS 开发路线

## M0：项目初始化

- [x] 建立 React + TypeScript + Vite 工程
- [x] 建立 CEP manifest 和 ExtendScript 宿主入口
- [x] 建立验证脚本与 Git 忽略规则
- [x] 整理规划和视觉参考资产
- [x] 建立 Windows CEP 开发模式：固定扩展目录 junction、watch 构建和开发面板刷新

验收：依赖可安装，类型检查、测试和生产构建通过，`dist/CSXS/manifest.xml` 存在。

## M1：主题系统

- [x] 建立五套设计 token
- [x] 默认使用极夜青
- [x] 主题左键按固定顺序循环切换
- [x] 主题右键展开完整选择菜单
- [x] 主题即时切换
- [x] 本地偏好持久化
- [x] 主题键盘操作、焦点状态和 Tooltip

验收：五套主题均可切换，刷新后保持选择，页面不存在亮色模式。

## M2：语言系统

- [x] 简体中文
- [x] 繁体中文
- [x] English
- [x] 日本語
- [x] 한국어
- [x] 语言左键快速切换简体中文与 English
- [x] 右键语言菜单和图标状态
- [x] 语言偏好本地持久化
- [x] 当前可见界面文案资源化与五语言溢出检查

验收：右键菜单顺序固定为简体中文、繁體中文、English、日本語、한국어；左键只在简体中文与 English 之间快速切换，处于繁體中文、日本語、한국어时左键先返回简体中文；右键打开紧凑选择菜单；刷新后保持选择。当前首页和占位页已接入语言资源，未来新增功能页文案仍必须进入 `src/i18n/`，不得在组件中散落硬编码。

## M3：首页

- [x] 品牌区、全局搜索和 Banner 视觉骨架
- [x] 新建/选择切换九宫格视觉骨架
- [x] 锚点/对齐切换九宫格视觉骨架
- [x] 高频快捷工具分组视觉骨架
- [x] `520 × 960` 默认窗口与 `420 × 640` 最小窗口适配
- [x] 大 / 中 / 小三档界面密度与本地持久化基础
- [x] 在完整设置页中接入界面与图标大小设置
- [x] 全局搜索与 Banner 工具工作区浏览器 fixture：搜索浮层、键盘操作、双击执行、右键切换工具 Banner、恢复默认
- [ ] 模式切换、工具按钮与真实 AE 宿主能力

注：切换胶囊的半透明材质仍待最终视觉确认，当前不得视为冻结组件。

## M3.5：设置中心基础

- [x] 建立常规、首页、AI、资源、关于五个设置分类
- [x] 常规页接入启动恢复、界面密度、界面亮度、首页 Banner、鼠标提示、提示延迟、界面动效和危险操作确认
- [x] 启动页面支持从十个主功能页中自定义选择；记住上次页面开启时优先恢复上次位置
- [x] 设置偏好本地持久化并在损坏数据时安全回退
- [x] 安全重置主题、语言、密度、启动页和常规偏好，不删除用户资源或未来 API Key
- [x] 顶部新功能铃铛、版本已读状态和五语言更新说明
- [x] GitHub Release 自动检查、暂不更新的下次启动提醒和安全外部下载页
- [x] 关于页展示版本、更新、兼容、验证、本地数据与仓库入口
- [x] 关于页增加购买与授权接口骨架、帮助与支持、诊断信息及真实 AE 版本读取接口
- [x] 关于页改为全宽授权模块与独立紧凑更新条，避免半宽卡片拥挤和无意义空白
- [x] 编写飞书使用文档、问题反馈表单与版本更新记录草稿
- [x] 接入飞书使用文档链接
- [x] 创建并接入飞书问题反馈表单链接
- [x] 首页“编辑”直接编辑当前布局；内置布局修改单独持久化为覆盖，不创建自定义副本
- [x] 新建/选择与锚点/对齐九宫格统一双层错峰切换，卡片框和图标同步动效；空间控制图标统一 AE 语义与视觉尺寸
- [x] 侧栏导航 Tooltip 改为图标右侧垂直居中定位，避免落在大尺寸按钮下方
- [x] 建立受保护的“创作通用”内置布局，默认显示 5 个工具组，每组固定 8 个工具位（7 个工具 + 1 个添加入口）
- [x] 自定义布局支持新建、复制、重命名、删除和当前布局切换
- [x] 自定义工具组支持新建、复制、重命名、修改图标、排序、显隐和删除
- [x] 组内 8 个工具位支持添加、替换、移除、自动前移、组内排序和跨组移动
- [x] 工具与工具组使用 Pointer Events 丝滑拖拽，支持浮层、占位、目标反馈、满组拒绝、边缘自动滚动与 Esc 取消
- [x] 首页布局设置同步到实际首页，首页标题同步当前布局名称，九宫格支持默认模式与上次模式记忆
- [x] 首页编辑态支持工具拖拽排序/跨组移动、“＋”添加，以及右键替换或移除
- [x] 迁移旧版误生成的“创作通用 N”副本回内置布局，并保留其现有工具排列
- [x] 单个首页布局支持 JSON 导入、导出和恢复默认，且不包含主题、语言与 API Key
- [x] 修复首页布局下拉框的文字与箭头排版，并为布局、工具组、工具位操作菜单接入视口边界自适应浮层
- [x] AI 设置页完成连接与生成偏好管理
- [x] 资源设置与本地资源库：当前 AE 内置来源、自定义来源、缓存索引、搜索与筛选浏览
- [x] 五语言设置文案与默认窗口排版
- [x] 精简“界面与图标”“新功能提示”文案并同步五种语言
- [x] 统一大 / 中 / 小设置分类框圆角，完成主题色界面亮度自绘滑杆

验收：右上角设置按钮直接进入设置页；顶部仅显示五个等尺寸分类图标并通过 Tooltip 识别；常规设置即时生效并刷新后保留；主题与语言原有交互保持不变。常规设置页已于 2026-09-24 确认，后续仅在明确提出优化时调整。

更新策略：第一阶段只检查 GitHub Releases 并打开外部下载页；用户选择“暂不更新”后，本次会话关闭提示，下次启动继续提醒。扩展内自动下载与安装保留为后续阶段。全局搜索与 Banner 已完成代码级和 fixture 测试；真实 AE CEP 宿主仍需单独验收。

## M4：功能页与 AE 宿主功能

按功能页逐项规划、实现、测试和提交。未开始的页面保持明确占位状态。

当前优先级已调整为“核心工具优先、Nya Pie 暂停在技术底座”。详细依据、统一 Action 架构、四套九宫格顺序及恢复 Nya Pie 的门槛见 [`05-core-tools-priority-roadmap.md`](05-core-tools-priority-roadmap.md)。

- [x] 资源库第一阶段：当前 AE 默认目录发现边界、自定义目录索引、离线缓存和本地浏览器界面
- [ ] 在真实 AE CEP 宿主中验收目录发现、扫描和文件夹选择
- [x] 固定 CEP 开发目录并支持前端 watch 构建与面板内刷新
- [ ] 资源动作：脚本执行、预设应用、表达式写入与受信任脚本管理
- [ ] 本地临时渲染预览与云端资源目录
- [x] 锚点九宫格第一版：通过 CEP Host 调整当前选中普通 2D/3D 图层的九点锚点，并用 Position 补偿保持画面位置
- [x] 锚点 Action 架构迁移：首页与全局搜索统一使用 Registry → Context Provider → Action Service/Runner → Host Executor → Bridge → Host JSX
- [x] 锚点全局搜索：九个 Action 由 Registry 生成五语言搜索项并通过共享 Action Service 执行
- [ ] 锚点真实 AE 验收：2D、普通 3D、父级、旋转/缩放、关键帧、表达式和锁定图层场景
- [x] 对齐九宫格 Action 架构迁移：首页与全局搜索统一使用 Registry → Context Provider → Action Service/Runner → Host Executor → Bridge → Host JSX
- [x] 对齐智能目标：单选默认合成，多选默认选区；多选按住 Alt/Option 或 Shift 强制合成，三个文字段落动作不受目标模式影响
- [x] 对齐全局搜索：六个图层对齐与三个段落对齐 Action 由 Registry 生成五语言搜索项，并通过共享 Action Service 执行
- [x] 对齐 3D 投影：根据 `threeDLayer` 自动分流；3D 图层按当前相机投影边界反算 Position X/Y 并保持 Z，支持普通 3D 与带 3D 父级图层
- [ ] 对齐九宫格真实 AE 验收：2D/3D、父级、旋转/缩放、锁定、关键帧、表达式与文字框场景

## Nya Pie P0：Runtime 技术验证

- [x] 编写 Nya Pie P0 Technical Spec
- [x] 建立渐进式 Action Registry、Context Engine 与 Action Runner
- [x] 建立四方向 Runtime 状态机与 Host 测试 Action
- [x] 在同一 CEP Bundle 中声明第二个 Modeless Extension
- [x] 建立多入口 Vite 构建与 dist Smoke 合约
- [x] 建立真实 AE 五面板焦点与 Windows 环境测试记录
- [x] 真实 AE：Composition / Timeline / Project / Effect Controls / NYAWORKS Panel 均可通过 AE 快捷键直接呼出
- [x] 真实 AE：`Alt + Space` KeyUp、Host Action、Runtime 关闭与 AE 焦点返回
- [ ] 真实 AE：全局鼠标位置、鼠标附近显示、无边框窗口定位
- [ ] Windows：100% / 高 DPI、双显示器、屏幕边缘、快速连续呼出、AE 非前台
- [x] 根据实测决定进入 NyaLauncher 设计：CEP 保留 Runtime UI 与 Action，C# 仅补 Launcher 能力

验收：只有 AE 任意目标 Panel Focus 下能够完成 Hotkey → Cursor → Runtime → Direction → KeyUp → Host Action → Close → Focus Restore，才判定 P0 成功。浏览器和自动化结果不能替代真实 AE 验收。

## NyaLauncher P1：Windows Runtime 辅助进程

- [x] 建立仓库本地 .NET 10 工具链、WinForms 消息循环工程和单文件发布脚本
- [x] 建立 `Alt + Space` 透传 Hook、重复 KeyDown 状态保护和 KeyUp 记录
- [x] 建立 AE 前台进程判断、鼠标屏幕坐标和进程树校验
- [x] 建立唯一 CEP Runtime 标题、窗口发现、无边框样式和 220 × 220 显示器定位
- [x] 建立 WinEvent + 25ms 轮询兜底、1500ms 超时、单实例和本地脱敏日志
- [x] 完成纯逻辑测试、真实 Windows 测试窗口集成和 self-contained `win-x64` 构建
- [ ] 在 Composition / Timeline / Project / Effect Controls / NYAWORKS Panel 中完成真实 AE 验收
- [ ] 完成 100%–200% DPI、双显示器、混合 DPI、负坐标副屏和屏幕边缘验收
- [ ] 完成连续呼出、AE 最小化、AE 非前台、焦点恢复、标题栏闪烁和延迟验收

边界：NyaLauncher 仅补 Windows Runtime 能力，不包含 Action Registry、Action Runner、AE 工具逻辑、Pie UI、Profile、设置、输入模拟、本地网络服务或 DLL 注入。完整步骤见 `docs/testing/nya-launcher-p1-ae-test.md`。

后续策略：在 NYAWORKS 至少形成 20–30 个稳定可执行 Action，并完成锚点、对齐、新建、选择四套九宫格的真实 AE 验收前，不继续开发正式 Nya Pie UI、Pie Editor、多 Profile 或 Context Aware Pie。
