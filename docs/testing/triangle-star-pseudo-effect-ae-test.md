# 三角形与星形伪效果：Windows / 中文 AE 2025 候选验收记录

日期：2026-10-10。当前为跨电脑测试候选：三角形 v1、星形 v2 已接入原 NYAWORKS 开发扩展，相关及全量自动化、生产/开发构建、资产同步与真实 AE 数值检查通过。用户在下班前明确授权将功能、模板和文档同步推送 GitHub，回家拉取后继续测试。鼠标交互、视觉、效果手动改名、重置/Undo、保存重开仍待实际验收。

开发依据为[三角形与星形开发步骤](../superpowers/plans/2026-10-10-triangle-star-pseudo-effects.md)。原计划提交 `436be1e3d3160b19cd8173d738e4480d2190fac4` 先推送后开发；原生 Points 范围校正另以 `168e224eefef01c5adb27321f35b1467248bdff7` 推送并核对远端，再修正星形实现。旧圆角矩形 v7 和圆形 v3 的保护基线为 `14b807d`。

## 当前参数与入口

| 入口 | 效果 | 几何参数 | 内部身份 |
| --- | --- | --- | --- |
| Ctrl + 新建形状 | `Nya 三角形` | 点（边数）、旋转、外半径、外圆度；默认 3 边，可调为其他多边形 | `shape.triangle/v1/zh-CN` / `Pseudo/NYA_Triangle_v1_zhCN` |
| Shift + 新建形状 | `Nya 星形` | 角数、外半径、内半径、旋转、外圆角、内圆角；默认 5 角 | `shape.star/v2/zh-CN` / `Pseudo/NYA_Star_v2_zhCN` |

- 两者的点数/角数拖动范围均为 3–20、输入范围为 3–100，几何取整数。AE 原生星形最低为 3；不提供显示 2、实际生成 3 角的控件状态。
- 外半径默认 250，星形内半径默认 125；拖动 0–3000、输入 0–5000。星形实际内半径限制在 0..外半径，保留独立控件。
- 旋转是原生 Angle，默认 0°，支持负值和多圈；圆度默认 0%，范围 0–100%。
- “样式”包含启用填充、填充颜色、启用描边、描边颜色、描边宽度。默认白色填充开启、黑色描边关闭；描边宽度默认 5，拖动 0–100、输入 0–1000，与已验收的圆角矩形/圆形一致。
- 普通点击和 Alt 继续使用圆角矩形 v7、圆形 v3。新 polygon 样式将 Stroke 放在 Fill 上方，完成属性添加后重新取得引用。

本机仍使用原 CEP junction `com.kuroii.nyaworks.panel`，指向本仓库 `dev-extension`。在原扩展右上角刷新后，以新建图层检查新参数；旧图层不自动迁移。

## 家里电脑拉取与继续测试

在家里 NYAWORKS 仓库的 `main` 分支、项目根目录执行：

```powershell
git pull --ff-only origin main
npm.cmd ci
npm.cmd run dev:cep
```

`dev:cep` 会配置原扩展 junction，并持续构建当前源码和 public 资产到本机 `dev-extension`。等待首次构建完成，保持该终端运行，然后关闭并重新打开 AE 中的 NYAWORKS 面板，再按下方清单依次测试普通点击、Alt、Ctrl、Shift。`dist` 和 `dev-extension` 是各电脑本地生成的目录，拉取源码后需要完成这一步构建。

四份公开 FFX、Catalog、新形状 schema 和生成器均随 Git 同步；正常测试可直接使用已提交的 FFX。家里的 AE/系统环境尚未验证，按本记录填写实际结果即可。

## 本地自动化与构建

| 检查 | 命令或证据 | 当前结果 |
| --- | --- | --- |
| 相关测试 | `npm.cmd run test -- tests/layerShapeHost.test.js tests/layerBridge.test.ts tests/pseudoEffectAssets.test.js --exclude '**/.worktrees/**' --maxWorkers=1` | 3 文件 / 131 项通过，退出码 0；Host 72、Bridge 20、Assets 39 |
| 生产构建 | `npm.cmd run build` | TypeScript 与 Vite 完整结束，退出码 0 |
| 开发扩展 | 设置 `NYAWORKS_CEP_DEV=1`、`NYAWORKS_CEP_DEV_OUT_DIR=dev-extension` 后运行 `npm.cmd run build` | 退出码 0，输出到原开发目录 |
| 构建资产 | `npm.cmd run smoke:dist` | 11 项必需资产通过 |
| 保护边界 | `node work/polygon-pseudo-20261010/verify-boundaries.mjs` | 两个旧 builder、两个旧 schema 与基线相同，旧 FFX 哈希一致 |
| 四处同步 | `artifact-hashes-final.json` | Host、Catalog、四份 FFX 共 6 文件，在 public / dist / dev-extension / 已安装 junction 的 24 个路径读取结果一致；junction 指向同一开发目录 |
| 全量套件 | `npm.cmd run test -- --exclude '**/.worktrees/**' --maxWorkers=2` | 130 文件 / 772 项通过，退出码 0；Vitest 报告耗时 560.13 秒，完整命令耗时 562.70 秒 |
| Diff 格式 | `git diff --check` | 本轮收尾检查通过，退出码 0 |

构建存在大于 500 kB 的 bundle 提示，退出码仍为 0。本轮没有为此扩大代码拆分范围。

相关测试覆盖固定参数索引、四路目录传递、形状与模板错配、旧星形身份拒绝、边界表达式、属性引用失效、缺资产/缺参数/表达式失败清理。星形下限修正先取得 `actual=2 / expected=3` 的失败，再修改实现得到通过；模拟测试不能代替下方原生 AE 读数。最终全量命令于 20:03:17.904–20:12:40.608（UTC+08:00）完整退出，没有沿用此前中止的星形 v1 运行结果。

## 真实 AE 脚本验证

环境：Windows 10 专业版 `10.0.19045`，中文 AE `25.6x101`，工程表达式引擎 `extendscript`；当前“合成 1”为 1920×1080、30 秒。通过 AfterFX `-r` 重载原 `dev-extension/host/index.jsx`，再执行 `work/polygon-pseudo-20261010/live-host-regression.jsx`。这验证了真实 Host 调用；面板按钮的鼠标操作仍按下方清单验收。

最终运行时间为 **2026-10-10 20:03:51–20:03:55（UTC+08:00）**。结果 `candidate=triangle-v1-star-v2`、`ok=true`，**547 次断言、96 条数值/动画样本**；6 次创建按下列顺序全部使用正确模板，几何和样式表达式均启用且无错误：

`普通点击 v7 → Alt 圆形 v3 → Ctrl 三角形 v1 → Shift 星形 v2 → 普通点击 v7 → Alt 圆形 v3`

| 场景 | 实际检查 | 结果 |
| --- | --- | --- |
| 两个新模板 | 唯一效果、matchName、marker、标签顺序、默认值、属性类型及可动画能力；三角形原生 Type=2，星形 Type=1 | 通过 |
| 点数/角数 | 控件 min=3/max=100，输入 2/101 被拒绝；3、4、5.6、20、100 的实际几何分别取 3、4、6、20、100；高/低表达式回到 100/3 | 通过 |
| 外半径 | 0、250、3000、5000 的控件和原生属性一致；越界直接输入被拒绝 | 通过 |
| 旋转 | 原生 Angle 类型、无输入上下限；-720、-90、0、45.5、720、36000 的几何读数一致 | 通过 |
| 外圆度/内圆角 | 0、50、100 与原生属性一致，控件范围 0–100 | 通过 |
| 星形内半径 | 内 350 / 外 250 得到实际内 250；内 0、内外同为 5000、外 0 时限制内半径 | 通过 |
| 样式 | 白色填充开启、黑色描边关闭；开关和颜色修改正确传到 Fill/Stroke；Stroke 位于 Fill 上方 | 通过 |
| 描边统一 | 新旧四种形状均采样 0、5、100、500、1000；实际 Stroke Width 等于控件；-1/1001 被拒绝 | 通过 |
| 动画 | 旋转、点数取整、外半径、外圆度、描边、颜色的线性中点；填充开关 Hold；星形内半径和内圆角 | 通过 |
| 图层改名/复制 | 图层改名后继续调点数；复制层修改为 9，原层仍为 7，表达式无错 | 通过；不包含效果 UI 手动改名 |
| 旧形状回归 | 新功能前后分别创建矩形/圆形；矩形封闭 8 顶点、宽高默认 500，圆形直径 `[500,500]`，样式表达式正常 | 通过 |
| 目录缺失 | 四种 modifier 使用不存在的扩展目录，均在创建前返回 `pseudo-catalog-missing`，不增加图层 | 通过 |
| 工程恢复 | 只清理本次创建的图层与复制层；原图层顺序、选择、属性选择及工程文件路径保持 | 通过，清理错误为 0 |

本次原图层 ID 前后均为 `[19,18,15,14,13]`，原选择前后均为 `[18]`。未保存、关闭或替换用户工程。

## 手动验收清单

以下各项仍待实际操作，不能由 547 次脚本断言推断通过。

| 项目 | 操作与预期 | 状态 |
| --- | --- | --- |
| 面板入口 | 刷新原 NYAWORKS 扩展，按普通/Alt/Ctrl/Shift/普通/Alt 连续新建；每次只有正确的一层、一个效果，默认几何与控件文字正确 | 待验收 |
| 拖动与直接输入 | 边数数字/滑杆到 20，输入 100；半径滑杆到 3000，输入 5000；描边滑杆到 100，输入 1000；输入大值后再次拖动，观察实际交互 | 待验收 |
| 外观与样式 | 调整多边形边数、内外半径、圆度及旋转；开启描边后改变半径和圆度，确认填充/描边视觉与预期一致 | 待验收 |
| 效果手动改名 | 在效果控件 UI 中改效果名称，继续调参和播放动画，观察表达式是否随 AE 的手动重命名机制更新 | 待验收 |
| 重置与 Undo | 修改几何、开关和颜色后使用效果重置；确认约定默认值；撤销新建或参数变化，确认可恢复且无无关图层变化 | 待验收 |
| 保存重开 | 保存专用测试工程后重开，关闭面板时控件、关键帧、复制层仍可用 | 待验收 |

直接通过脚本 `.name = ...` 改效果名不作为手动 UI 重命名的替代：隔离对照发现，在当前表达式引擎中，原生 Slider 和伪效果的名称引用都会保留旧名。只改探针自己拥有的表达式后，两者均可正常求值。本轮不对用户工程执行全局表达式修复，UI 效果改名继续保留独立验收项。

未验证其他 AE 版本、macOS、其他控件语言、跨电脑和干净 AE 会话；不将本机脚本结果扩展为完整环境兼容或正式发布结论。

## 产物与证据

公开文件名不包含版本号，内部身份独立版本化。三角形共 9 项业务参数，星形共 11 项；分组与 marker 不计入业务参数数量。失败的星形 v1 临时 schema 已删除，当前生成器、Catalog 和 Host 仅使用星形 v2。

| 文件 | SHA-256 |
| --- | --- |
| `public/host/index.jsx` | `E2003A524E1C93674ADD2125AF04DC026E56685D314EA3C7E90957C463B72558` |
| `public/host/pseudo-effects/catalog.json` | `5521F966782F8A04CBE26D2AC37A6B8A135AA316DDA87C4C1F0C31E17CE931AC` |
| `rounded-rectangle-zh-CN.ffx`（v7，未变） | `D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9` |
| `circle-zh-CN.ffx`（v3，未变） | `0B3F38341544AC1B13CF0D5E2F87CE734555EC388CE334C7F22BA8DE7E99E02E` |
| `triangle-zh-CN.ffx`（v1） | `4F616CDF3BCA836F2887FE3866975658D7D0F9F06A2D57F1A5B85B90CEBC0476` |
| `star-zh-CN.ffx`（v2） | `3EFC6C9BB80A6319DA5FC5EE4CEBC53FE838B68228332C0265E61AA187E18C7E` |

以下原始证据保留在公司电脑的 `work/polygon-pseudo-20261010/`，该目录不进入 Git；本文件中的参数、结果、哈希与手动清单随仓库同步，家里构建和使用不依赖这些原始记录：

- `star-v2-related-green.log`、`assets-star-v2-red.log`、`assets-star-v2-green.log`、`star-v2-points-host-red.log`、`star-v2-identity-host-red.log`：修订的 RED/GREEN。
- `production-build-final.log`、`development-build-final.log`、`dist-smoke-final.log`、`protected-boundaries.json`、`artifact-hashes-final.json`：构建、保护边界与同步。
- `live-host-final-launch.json`、`live-host-regression.jsx`、`live-host-regression-result.json`：最终实际 AE 运行。
- `points-boundary-result.json`、`points-audit.md`、`rename-behavior-result.json`：原生下限和直接脚本改名对照。
- `default-audit.md`、`definition-defaults-fixed-result.json`、`final-schema-probe-result.json`：新模板的 Angle、颜色及复选框默认值格式取证；旧 v7/v3 编码分支保持。
- `review-report.md`：初版和 v2 修订的独立审查，未发现未解决的实现问题。
- `ae-final-audit.md`：最终 AE 报告、样本覆盖、恢复状态和部署路径的独立复核。
- `full-tests-final.log`、`full-tests-final-status.json`：最终全量 130 文件 / 772 项通过的原始输出、时间与退出码。此前星形 v1 的中止全量日志及失败探针保留为历史，不计入最终通过结果。
