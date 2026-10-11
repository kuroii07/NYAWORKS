# 图层与形状本地化验收

日期：2026-10-11。新建对象跟随 **NYAWORKS 面板语言**；AE 界面语言作为兼容环境记录。切换语言或刷新扩展不改已有层、效果和表达式。

## 当前可测试范围

- 普通图层五语言命名已接入。用户反馈“测试了，好像都是正常的”，记录为总体 smoke 反馈；未据此确认 Undo、保存重开等专项测试。
- 简体中文四种形状使用原有已验收模板。四个 Catalog 条目、FFX 字节、matchName、marker、参数索引和默认值保持冻结。
- English 四种形状各有独立参数定义，用户已确认中英切换、四种形状创建及本轮控件显示复测正常；Undo、关键帧、保存重开及 AE 2022–2026+ 逐版本验收仍未完成。
- 繁体中文四种形状使用独立 `zh-TW` 预设，图层、效果及完整参数/分组为繁体；本轮创建与显示 smoke 已获用户实测确认。
- 日文、韩文采用用户明确选择的兼容模式：图层、路径和新建效果实例名称使用所选语言，参数/分组共用已测试的英文 r2 定义；创建成功时显示本地化提示。本轮创建、显示及兼容提示 smoke 已获用户实测确认，完整日文/韩文参数暂未交付。
- 文字名称跟随源文字；解预合成保留原图层名。摄像机控制层名称可本地化，15 个控制参数仍为中文。
- macOS 尚未验收。

English 资产位于 `public/host/pseudo-effects/en/`；源 schema 位于四种形状版本目录的 `en/schema.json`。重建 English：`npm.cmd run build:pseudo-effects -- --locale=en`。此模式合并 Catalog，只写 English FFX，不重新生成中文资产。English 的复选框重置默认值、颜色 ARGB 编码按新的独立定义生成；中文旧定义保持原始字节。

### English 控件混用修订（r2）

用户实测确认四种 English 形状均存在参数中英混用；星形截图中 Points、Rotation、Style、填充/描边等变为中文，Outer/Inner Roundness 和 Enable Fill 保持英文。四份源码和 FFX 定义/stream 标签均为英文，Host 没有将这些参数重命名为中文。常用标签被 AE 本地化是当前解释，尚未取得运行时机制的直接证据。

四种形状的全部业务参数和分组统一采用可见的 `Nya ` 前缀（例如 `Nya Width`、`Nya Radius`、`Nya Points`、`Nya Style`、`Nya Fill Color`），避免与原生名称完全相同。English 候选内部身份改为 `_en_r2`，schema/Catalog 记录 `definitionRevision: 2`，避免复用首次候选已加载的定义。模板 ID、业务 schema 版本、marker、参数顺序、类型、默认值和范围不变；中文资产和已有中英文图层不自动修改。原候选快照位于 `archive/english-parameter-labels-20261011/before-fix-preserved.zip`。

四形状全部标签的二进制检查、重建一致性、中文基线及 Host 创建/旧英文定义拒绝回归通过。独立 AE 命令行探针没有返回可用报告，不能据此确认 r2 实际显示正常。`scripts/ae-tests/english-shape-labels-smoke.jsx` 仅允许空的未保存测试工程；不在用户当前工程运行。r2 仍为候选，需重新打开 NYAWORKS 面板并**新建四种形状**复测；已有图层不会升级。AE 自身的“重置”、秒表及原生属性界面继续跟随 AE 语言。

r2 本轮验证：5 个相关测试文件 202/202；typecheck、生产与开发构建、两套 15 项产物检查通过。中文四个 Catalog 条目/FFX 与 HEAD 一致，public、dist、当前 CEP junction 指向的 dev-extension 中 Host、Catalog、四份英文资产哈希一致。未重复全量测试；未验证实际控件显示、拖动、Undo 和保存重开。保留已有构建体积提示；无 commit/push。

随后用户反馈：“测试了，切换中英没问题创建四个形状层没问题。其他三种语言现在还没法创建。”记录为中英文切换及四形状创建的真实用户 smoke 确认，不扩大为所有参数交互或保存重开验收。

### 繁体与日/韩兼容增量

用户已明确选择“先支持创建，效果参数使用英文，并明确提示”。繁体以 `--locale=zh-TW` 构建四份独立 FFX；英文资产字节不变。日/韩 Catalog 条目通过 `controlLocale: en`、`sourceTemplateId` 显式共享英文定义，不生成伪装为日/韩参数的资产。Host 只对本次新加的效果实例设置 Unicode 名称，已有实例保持原样，表达式引用设置后的实际名称。

成功结果中的 `shape-controls-english` 提示经过 Host → Bridge → Action → 首页/搜索传递，仅成功创建日/韩兼容形状时显示本地化说明；中文、英文、繁体正常创建不显示这个提示。缺 Catalog/文件或兼容元数据错误仍在创建前失败。

编码依据：[Adobe SDK Localization](https://ae-plugins.docsforadobe.dev/intro/localization/) 说明效果参数名使用应用当前区域设置的多字节编码。现有 ANSI/GBK 槽位不能表示韩文；构建器新增往返检查，拒绝问号替换，且在所有资产生成成功后才写成品。不修改 AE 语言、安装 XML、首选项或既有中英文预设。

重建繁体：`npm.cmd run build:pseudo-effects -- --locale=zh-TW`；重建英文和日/韩显式兼容映射：`npm.cmd run build:pseudo-effects -- --locale=en`。新语言仍标为候选，待真实 AE 创建、显示、Undo 等验证。

本轮增量验证：10 个相关文件 302/302；typecheck、生产/开发构建及两套 19 项产物检查通过。英文四份 FFX 与本轮修改前快照逐字节哈希一致；中文四个 Catalog 条目和 FFX 与 HEAD 一致；全部源码/生产/开发 Host、Catalog 和模板哈希一致。保持已有构建体积提示，未重复全量测试或实际 AE 探针，无 commit/push。

### 五语言用户复测确认

2026-10-11 用户最终反馈：“都测试了，没问题，可以更新推送一次github了。”结合此前中英切换及四种形状创建确认，本轮记录为五语言切换、四种形状创建、当前名称/控件显示及日/韩兼容提示的真实 AE 用户 smoke 通过，并获授权提交、推送 GitHub。以上替代前文对应阶段的“待复测”状态，不扩展为 Undo、关键帧、复制、保存重开、跨版本/macOS 或窄面板/高 DPI 专项验收。

## 环境记录

- Windows 精确版本：待填写。
- AE 精确版本与界面语言：待填写，不从前一轮推断。
- NYAWORKS 面板语言：每组记录 `zh-CN / en / zh-TW / ja / ko`。
- 加载方式：现有 CEP junction → 项目 `dev-extension/`；关闭并重新打开面板以重新加载前端和 Host。
- 使用独立的新建测试工程，不覆盖正在编辑的工程。

## 自动化与真实 AE 分开记录

自动化覆盖：旧 payload 默认中文、五语言透传、四种中文资产哈希、English FFX 的实际参数定义/标签/类型/默认值/范围/顺序/marker、英文创建、效果名的引号/反斜杠/非 ASCII 引用、未就绪模板创建前拒绝、表达式失败清理和选择恢复。

DOM 覆盖五语言按钮名称、完整 modifier tooltip 和完整错误提示；沿用现有可换行 Toast。DOM 不测真实像素布局，窄面板和高 DPI 可读性仍需实测。

2026-10-11 自动化结果：相关 12 文件 333/333；排除四个已有未跟踪实验测试后，完整测试 909 通过 / 1 失败（910 项）。唯一失败为既有 `nyaLauncherBuildContract.test.js` 缺少 `outputs/nya-launcher-p1/NyaLauncher.exe`，没有本地化新增失败。typecheck、生产/开发构建及两套 15 项产物检查通过；保留已有构建体积提示。实际加载的开发扩展中 Host、Catalog 和四份 English FFX 哈希与源码一致。独立只读审查未发现阻塞缺陷，中文四条 Catalog 与 FFX 均与 HEAD 一致。无 commit/push。

### 中文回归

- [ ] 四种形状逐一创建：普通点击圆角矩形、Alt 圆、Ctrl 三角形、Shift 星形；层名、效果名、默认图形与此前一致。
- [ ] 中文层、关键帧和表达式在 English 创建前后保持正常；切换面板语言不改已有对象。
- [ ] 调整层尺寸/像素比例/选区时间/插入位置正确，仅选中新层，无附加效果。

### English 候选

- [ ] 圆角矩形：层名/路径名/效果名 `Nya Rounded Rectangle`；Nya Width、Nya Height、Nya Corner Radius、Nya Separate Corners、Nya Corner Controls、Nya Style 及全部样式参数为英文。
- [ ] Alt 圆：`Nya Circle`；Nya Radius、Nya Style 和全部样式参数为英文，半径驱动尺寸正确。
- [ ] Ctrl 三角形：`Nya Triangle`；Nya Points、Nya Rotation、Nya Outer Radius、Nya Outer Roundness 和全部样式参数为英文，Points 默认 3。
- [ ] Shift 星形：`Nya Star`；全部参数/分组显示 Nya 前缀与英文，包括点数、内外半径、旋转、内外圆度和填充/描边，Points 默认 5。
- [ ] 每个几何/样式参数可拖动、键入和添加关键帧；颜色、填充/描边开关、描边宽度默认 5 正常；重置保持 schema 默认值。
- [ ] 同类型连续创建能递增层名；中文与 English 交替创建无模板串用或表达式错误。
- [ ] 单次 Undo 撤销新建，Redo 后正常。
- [ ] 复制图层、保存测试工程并重开，参数、关键帧和表达式正常。
- [ ] 关闭/重新打开扩展后继续创建正常。

### 新语言兼容与失败提示

- [ ] 繁体下逐一创建四种形状，图层/效果名称和所有业务参数/分组为繁体；显示、表达式和默认图形正常。
- [ ] 日文、韩文下逐一创建四种形状，图层/效果/路径名使用所选语言，参数/分组使用英文；每次成功创建显示对应语言的兼容提示。
- [ ] 五语言交替创建无模板串用；切换语言、刷新面板不修改已有图层、效果和表达式。
- [ ] 在独立扩展副本中模拟缺失 English 模板，确认创建前失败；不要删除当前安装资产。
- [ ] 首页与全局搜索的失败提示一致，不显示路径、堆栈或表达式诊断文件名。
- [ ] 420×640 窄面板、高 DPI 下，五语言 tooltip 和换行提示完整可读。

五语言创建与显示 smoke 已通过用户反馈确认；上方包含多个检查条件的专项条目仍待逐项记录。当前日/韩支持本地化对象名称与英文控件兼容模式；后续完整参数翻译、其他 AE 版本和 macOS 需独立验收。
