# AE 2025 圆角矩形边界取证

最终状态（2026-10-10）：已定位并修复模板选择分支，AE 25.6x101 内的前后路由与三次创建检查通过。用户随后确认圆角矩形和圆形均正常，授权提交推送。下文保留 v7/v2 路由取证阶段的原始状态和哈希；该阶段两份 FFX 未修改。后续圆形 v3 的统一描边范围与最终用户确认见[圆形验收记录](circle-pseudo-effect-ae-test.md)。

## 已确认的证据

- 最新截图的 `p2=样式/6412/unreadable`、`p1=半径/6417/number/250` 与 `effect=Nya 圆形` 来自 Host 返回的效果实例；它们不是从表达式求值结果提取的。因此当前证据不能仅解释为 `effect(name)` 解析到了另一实例。
- 完整递归读取两份 RIFX：都是单个 `besc`，路径为 `ADBE Effect Parade` → 各自 Pseudo 身份，随后是 `ADBE End of path sentinel`；`sspc/fnam`、`besc/tdsn`、`tdgp/tdsn` 分别使用各自显示名。
- 圆角矩形 `parT` 与 `tdgp` 有 18 个定义/流，圆形有 9 个；定义与值流的所有 `tdmn` 分别属于各自身份，没有在圆角矩形文件里读到圆形身份。生成器分别重新解析 Scribe 源文件，未复用上一轮修改后的树。
- 两文件继承相同的 `head`、`beso`、`pgui` 元数据；尚无证据证明这些字段是 AE 的效果注册键，不应猜测修改。
- 初轮按 Node/V8 语义阅读源码，误以为普通点击一定选择 v7。后续真实日志证明，旧 Host 的连续三元表达式在 ExtendScript 中将普通点击也选成 circle/v2；仅靠 Node 测试不能证明宿主中的分支结果。应用后校验使用同一份已选错的模板合同，所以会通过。
- 源码与 `dev-extension` 的圆角矩形文件均为 `D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9`；圆形均为 `C0BCC6FA28CAEB11B8CC4A8D686C776CEA1ED243F2A71406F86FAAB820EB4E48`。CEP Junction 指向本仓库开发扩展。
- 当前实例校验没有检查参数值类型。故身份检查通过并不能证明参数布局正确；需要记录真实 AE 的 matchName 和 marker，不能由截图推断它们的实际值。

## 初轮诊断与采集方式

诊断版本 `shape-boundary-1` 在正常创建流程记录：实际预设路径、模板 ID、期望身份/标记、Catalog 声明的哈希、应用后校验前实例、校验后实例、写路径表达式前实例，以及路径表达式报错后的实例。每个快照含实际名称、matchName、参数数目、各参数 matchName/名称/值类型/值。记录 Catalog 哈希不等同于在 AE 内计算文件哈希。

失败回滚前写入 `Folder.userData/NYAWORKS/shape-pseudo-trace.json`，失败仍删除本次新建图层，选层恢复规则保持原样。无法写文件时保留内存记录，可通过 `NYAWORKS.getLastShapePseudoTrace()` 读取。该 getter 只读取已保存的快照，不应用预设，不改工程。

在旧工程的测试合成中刷新 NYAWORKS 后普通点击一次即可，不要求新工程。根据记录判断：

1. 实际文件/模板已经错：追查调用、部署或运行代码边界。
2. 校验前身份是圆角矩形，但参数内容已是圆形：追查 AE 实例化/注册边界，不能只改名称。
3. 校验前后正确，表达式前后发生变化：追查引用失效/宿主求值边界。
4. 全部快照正确而表达式仍读取圆形：才有证据进一步调查表达式名称解析。

另有只读 `scripts/ae-tests/read-shape-pseudo-state.jsx` 可扫描当前合成已有伪效果和注册列表，不创建/关闭/保存工程。2026-10-10 通过现有 AE 2025 的 `-r` 发起一次调用，但没有收到报告，不能宣称该探针已在宿主执行成功。不要以此结果认定没有伪效果或认定根因。

## 自动化验证

新增测试保留“名称为圆形、圆角矩形身份与标记通过、高度却是 NO_VALUE”的模拟实例，确认四个阶段快照和错误表达式在图层删除后仍可读取。这证明诊断能覆盖当前校验缺口，不证明 AE 中的根因。

针对性 4 文件 / 61 项通过。首次未排除 `.worktrees` 的运行包含旧工作树，4 项旧测试失败；排除后当前仓库测试通过。保留所有原有改动和研究文件，没有重置、删除它们或推送。

`npm.cmd run build`（含 TypeScript）、`npm.cmd run smoke:dist`、开发扩展构建及 `git diff --check` 通过。源码、`dist`、`dev-extension` 中 Host SHA-256 一致：`C0AA2B1015A7D8021E1A9E91C0F6BD098CF7181220A5D52FDCF6D9658EA4B7EC`。开发扩展 v7 FFX 哈希仍为上述验收版哈希。没有获得本轮 AE 创建复测结果。

## 真实日志与根因修复

用户复测产生的 `shape-pseudo-trace.json` 明确记录 `modifier: none`，但 `templateId`、`file`、`expectedMatchName` 和 `expectedMarker` 全部属于圆形。四份实例快照也始终是合法的圆形控件，未发生身份伪装或实例中途替换。圆角矩形 builder 随后把圆形第 2 项“样式”当作高度数值使用，因 NO_VALUE 类型导致路径表达式第 2 行报错。

新增 Alt 圆形时引入的 `modifier === "none" ? rectangle : modifier === "alt" ? circle : null`，在当前 AE ExtendScript 中普通点击返回 circle；以同一段生产源码在 AE 25.6x101 执行的只读探针已直接复现。改为显式 `if/else` 后，同一 AE 进程中 none/alt/ctrl/shift 四种输入均正确。两份前后报告保存在 `work/shape-route-20261010/before-routing-ae.txt` 和 `after-routing-ae.txt`。

最小生产改动仅涉及模板选择分支与两个形状 builder 的模板匹配检查。矩形收到合法圆形模板（或反向）时，必须在添加属性前拒绝，避免错误模板内部自洽而继续创建。没有更换 FFX 身份、参数范围或表达式公式。

先增加静态 ExtendScript 兼容性约束及两条形状错配拒绝测试，旧实现出现 3 项预期失败；修改后针对性 4 文件 / 64 项通过。静态约束不能替代 AE 测试，本轮另有真实 AE 前后证据。全量 `npm.cmd run test -- --exclude '**/.worktrees/**'`：130 文件 / 698 项通过；生产/开发构建、`smoke:dist`、`git diff --check` 通过。三处 Host SHA-256 更新为 `76FA53B5D273A8FE060165037AC4914BBDE8A1F8D6CD1E32E9265B1E59F4CAF9`。

## 真实 AE 创建回归

在当前 Windows / 中文 AE 25.6x101 的既有“合成 1”内，读取已安装开发扩展 Host 并调用实际 `NYAWORKS.runLayerAction`，依次测试普通圆角矩形、Alt 圆形、普通圆角矩形。三次均成功新建单层、实际效果 matchName 和 marker 正确；圆角矩形宽高均为数值 500，路径为闭合八顶点；圆形尺寸为 500×500。三个实例的几何和五个样式属性表达式全部无错误。

只删除本次探针创建的临时图层并恢复选择，原有图层数前后均为 1；没有关闭、替换或保存工程。完整结果见 `work/shape-route-20261010/after-host-creation.json`，精简结果见 `verification-summary.json`。这是实际 AE Host 创建与表达式检查，不等同于用户面板点击、视觉外观、滑杆手感、Undo 操作或保存重开验收。Alt 圆形完整验收仍保持待办。

随后通过 AE `-r` 重载本仓库 `dev-extension/host/index.jsx`，再以另一探针直接调用已经加载的 `NYAWORKS.runLayerAction`，不在探针中加载 Host 源码。相同三次创建均通过，主引擎为 `main`，原有图层数仍为 1，清理错误为空；结果为 `work/shape-route-20261010/after-live-host-creation.json`。这样确认修复也已进入当前运行中的 Host。FFX、未提交研究文件和其他用户改动均保留，没有 commit/push。
