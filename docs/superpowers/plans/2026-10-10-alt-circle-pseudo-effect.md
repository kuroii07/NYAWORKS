# Alt 圆形伪效果 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `create-shape + Alt/Option` 创建的正圆接入独立简体中文伪效果，提供半径及填充/描边六项持续可调参数，同时保持现有 Action、正圆几何、图层命名和其他形状行为。

**2026-10-10 最终状态（覆盖下方历史实施步骤）：**用户确认“圆角矩形和圆形现在都没问题了”，并明确授权提交推送，本机本轮功能验收完成。圆角矩形保持原始 v7 身份与资产，模板路由已改为显式 `if/else` 并增加 builder 身份检查；圆形 v3 与 v7 统一描边默认值 5、数字拖动/滑杆 0–100、键盘输入 0–1000。AE 25.6x101 交替创建、描边数值边界与表达式绑定通过，全量 130 文件 / 708 项通过。用户总体确认与脚本逐项证据分别记录，不推断未单独提供的测试细项。下方 Task 0–4 保留此前实施过程，其中 v8/v2 与统一 500 的文字是历史候选，**不再是当前交付规格**。后续三角形、星形必须沿用当前公共描边规格。

**Architecture:** 继续使用现有 `UI → Action → Layer Bridge → public/host/index.jsx → AE` 链路，并复用已通过 Windows / 中文 AE 2025 验收的白名单共享 Pseudo Effect Host Helper。圆形使用独立 `.ffx`、模板身份和参数映射；Bridge 为普通圆角矩形和 `Alt` 圆形统一传入 CEP 扩展根目录，Host 在创建图层前预检模板，随后用 AE 原生 Ellipse、Fill、Stroke 与表达式完成业务绑定。

**Tech Stack:** React 18、TypeScript、Vite、Adobe CEP、ExtendScript ES3、After Effects 2025、`.ffx`、Node.js 资产生成脚本、Vitest。

**Spec:** [共享伪效果系统设计](../specs/2026-10-08-pseudo-effect-system-design.md)。

计划最初基线：`main` 提交 `46034cb` 已完成共享 Host Helper，并由用户在 Windows / 中文 AE 2025 中确认圆角矩形创建、参数、样式、关键帧、重命名、Undo、复制和保存重开均正常。当时圆形使用一个原生 `Nya 半径` Slider Control，Bridge 只为 `modifier === "none"` 传 `extensionRoot`；当前圆形伪效果与 Bridge 路径传递已实现。不执行旧的 2026-10-07 未跟踪实验方案。

## Global Constraints

- 当前仅将 `Alt/Option` 圆形的描边范围统一到圆角矩形 v7；普通点击保留 v7 原始身份、资产和几何/样式行为，显式模板路由修复继续保留；`Ctrl` 三角形和 `Shift` 星形继续使用现有原生控件，本轮不开发其伪效果。
- 圆形始终是正圆，只暴露半径，不增加独立宽高、直径、整体透明度、位置、缩放、虚线、渐变或圆角参数。
- 参数固定为六项：`radius`、`fillEnabled`、`fillColor`、`strokeEnabled`、`strokeColor`、`strokeWidth`。
- 半径默认 `250`；滑杆范围 `0–3000`，允许输入范围 `0–5000`，对应最大直径分别为 `6000` 和 `10000`。这两组数值是已确认的首轮实现参数，不代表 AE 原生硬上限；实际数值拖动和滑杆手感仍须在 AE 中验收。
- 填充默认开启且为白色；描边默认关闭、黑色、宽度 `5`；圆形与圆角矩形描边的数字拖动/滑杆范围均为 `0–100`，键盘输入范围均为 `0–1000`。三角形和星形后续必须复用 `scripts/shape-pseudo-effect-contract.mjs` 的公共规则并分别验收，不另定描边上限。
- 当前模板身份为 `shape.circle/v3/zh-CN`；交付文件仍为 `circle-zh-CN.ffx`；matchName 为 `Pseudo/NYA_Circle_v3_zhCN`；marker 为 `__NYA_CIRCLE_V3__`。圆角矩形当前模板身份为 `shape.roundedRectangle/v7/zh-CN`，matchName 为 `Pseudo/NYA_RRect_v7_zhCN`，marker 为 `__NYA_RRECT_V7__`。
- 图层名称继续为 `Nya 圆`；效果显示名为 `Nya 圆形`；表达式不得依赖参数的中文标签。
- 首轮只制作简体中文模板，不宣称其他控件语言、其他 AE 版本、macOS 或跨电脑已经通过。
- 不修改 `PresetEffects.xml`，不建立第二套 Action/Bridge，不让内部模板进入资源页，不迁移或重写既有圆形图层。
- Host 保持 ExtendScript ES3：使用 `var` 和普通函数，不引入现代 JavaScript API。
- 保留现有未跟踪实验文件；实施过程中不得覆盖、删除或加入提交。
- 每个任务按 TDD 先确认 RED，再做最小实现；未经用户明确授权，不自动 commit 或 push。

## Review Focus

1. `Alt` 圆形以前不传 `extensionRoot`：Bridge 必须对两种伪效果形状传路径，CEP 路径不可用时应在调用 AE 前失败。
2. 不能用不同内容覆盖同一 `matchName` 的伪效果定义：圆角矩形 v7 的 SHA-256 必须保持 `D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9`；历史 circle/v2 schema 与哈希记录保留，本次改变圆形范围使用独立 v3 身份和 Catalog。既有图层不自动迁移。
3. 添加 Stroke 会使 AE Shape Contents 的旧索引属性引用失效：完成全部 `addProperty()` 后必须通过 `propertyIndex` 重新获取 Fill 和 Stroke。
4. 圆形效果被重命名、复制或重复探测：表达式、幂等复用、签名校验和多实例歧义行为必须与共享 Helper 契约一致。
5. 自动化范围不能冒充真实 AE：先在常用合成尺寸中观察原生圆形的实际大小和描边效果；生成模板后再分别检查数值拖动、滑杆拖动、端点刻度、键盘输入与越界限制。两组范围、颜色/开关、关键帧、Undo、复制和保存重开都必须在 Windows / 中文 AE 2025 中单独验收，不能仅凭二进制字段正确宣布数值体验通过。
6. 模板选择必须保留显式 `if/else`，不得重新使用未加括号的连续三元表达式；每个形状 builder 在创建属性前检查模板身份。Node 测试之外，需要真实 AE 按“矩形 → 圆形 → 矩形”检查路由、参数类型与表达式。

## 固定参数布局

```text
Nya 圆形
├─ 半径                         radius
└─ 样式                         可折叠分组
   ├─ 启用填充                  fillEnabled
   ├─ 填充颜色                  fillColor
   ├─ 启用描边                  strokeEnabled
   ├─ 描边颜色                  strokeColor
   └─ 描边宽度                  strokeWidth
```

Catalog 的首版实际映射固定为：

```text
radius=1
样式组起始=2
fillEnabled=3
fillColor=4
strokeEnabled=5
strokeColor=6
strokeWidth=7
marker/样式组结束=8
```

## Task 0：首轮参数确认（真实 AE 手感验收留到 Task 5）

- [x] 半径采用 `defaultValue=250`、`sliderMin/Max=0/3000`、`validMin/Max=0/5000` 作为首轮实现参数；滑杆常用范围与直接输入范围分开，不把输入上限当作滑杆刻度或鼠标拖动速度。

## Task 1：圆形资产、可复现生成和 Catalog 合并

**Files:**

- Create: `assets/pseudo-effects/circle/v2/schema.json`（最初的 v1 首轮测试后因范围修订不再交付）
- Move/Modify: `scripts/build-rounded-rectangle-pseudo.mjs` → `scripts/build-shape-pseudo-effects.mjs`
- Modify: `package.json`
- Generate: `public/host/pseudo-effects/circle-zh-CN.ffx`
- Modify: `public/host/pseudo-effects/catalog.json`
- Modify: `scripts/dist-contract.mjs`
- Modify/Test: `tests/pseudoEffectAssets.test.js`

**Interfaces:**

- `npm.cmd run build:pseudo-effects` 读取圆角矩形 v8 与圆形 v2 两份 schema，一次生成两份 `.ffx` 和一个合并 Catalog。
- 圆形 Catalog 条目使用固定身份、marker index `8` 和六项映射；圆角矩形条目及二进制必须保持不变。
- 继续复用已归档 MIT 样例基底和许可证，不引入新的运行时依赖。

- [ ] **Step 1: 写资产 RED 测试**

  在 `tests/pseudoEffectAssets.test.js` 中断言：生产契约同时包含 `rounded-rectangle-zh-CN.ffx` 与 `circle-zh-CN.ffx`；Catalog 同时包含圆角矩形 v8 和圆形 v2；圆形 schema 的六项参数、默认值、滑杆/输入范围、身份和 marker 均精确匹配本计划；旧身份不得绑定到改变后的 FFX 字节，圆角矩形参数索引不变。若后续 AE 验收发现范围需要调整，先记录结果并更新计划，再同步测试与 schema。

- [ ] **Step 2: 运行资产测试确认 RED**

  Run: `npm.cmd run test -- tests/pseudoEffectAssets.test.js`

  Expected: 因缺少圆形 schema、`.ffx`、Catalog 条目或 dist 契约而失败，不得因测试语法错误失败。

- [ ] **Step 3: 建立圆形 schema 并泛化生成脚本**

  新 schema 写入本计划固定的六项参数。将现有单模板脚本改为数据驱动的 `scripts/build-shape-pseudo-effects.mjs`，循环生成圆角矩形与圆形并统一写入 Catalog；新增 `build:pseudo-effects` npm script。生成器必须校验数值范围顺序、参数数量和映射唯一性。

- [ ] **Step 4: 生成资产并确认 GREEN**

  Run: `npm.cmd run build:pseudo-effects`

  Run: `npm.cmd run test -- tests/pseudoEffectAssets.test.js`

  Expected: 圆形 `.ffx` 为有效 RIFX，哈希与 Catalog 一致；圆形 Slider/Checkbox/Color 类型及范围字节正确；圆角矩形身份和索引保持不变，描边上限变更后的哈希及编码范围通过测试。

- [ ] **Step 5: 检查资产差异边界**

  只允许出现新圆形 schema/FFX、生成脚本重命名、合并 Catalog、dist 契约和对应测试变更；不得加入 `assets/pseudo-effects/rounded-rectangle/v6/` 或 2026-10-07 实验文件。

## Task 2：Bridge 为 Alt 圆形传递扩展根目录

**Files:**

- Modify: `src/host/layerBridge.ts`
- Modify/Test: `tests/layerBridge.test.ts`

**Interfaces:**

- `createLayerHostBridge().runLayerAction("create-shape", modifier)` 在 `modifier` 为 `none` 或 `alt` 时调用 `getCepExtensionRoot()` 并把 `extensionRoot` 写入同一编码 payload。
- `ctrl`、`shift` 和其他 Layer Action 继续不携带扩展路径。
- 需要伪效果但 CEP 路径不可用时返回现有 `{ ok: false, reason: "host-error", detail: "pseudo-extension-root-unavailable" }`，不调用 `evalScript`。

- [ ] **Step 1: 写 Alt 路径 RED 测试**

  修改现有 Alt 圆形 Bridge 测试，断言 URL 解码后的 payload 包含 `extensionRoot`；新增 Alt 环境无路径时不调用 AE 的断言，同时保留 `ctrl/shift` 无路径字段测试。

- [ ] **Step 2: 运行 Bridge 测试确认 RED**

  Run: `npm.cmd run test -- tests/layerBridge.test.ts`

  Expected: Alt payload 缺少 `extensionRoot`，或路径不可用时仍调用 AE。

- [ ] **Step 3: 实现统一伪效果形状路径判断**

  将仅针对圆角矩形的布尔判断收敛为“`create-shape` 且 modifier 为 `none/alt`”，不改变 payload 编码、结果解析或其他 Action。

- [ ] **Step 4: 重跑 Bridge 测试确认 GREEN**

  Run: `npm.cmd run test -- tests/layerBridge.test.ts`

  Expected: 普通圆角矩形与 Alt 圆形均携带规范化扩展路径，其他动作无回归。

## Task 3：共享 Host 白名单与 Alt 圆形业务绑定

**Files:**

- Modify: `public/host/index.jsx`
- Modify/Test: `tests/layerShapeHost.test.js`

**Interfaces:**

- `getPseudoEffectTemplateContract(templateId)` 当前同时允许圆角矩形 v8 和圆形 v2，返回各自固定 file、matchName、marker 和 parameterIds。
- `createEllipseShape(layer, contents, context, template)` 应用已预检圆形模板，创建 AE 原生 Ellipse、Fill、Stroke，并把 Size 表达式绑定到半径，把样式绑定到参数 3–7。
- `createShapeLayer()` 在添加图层前为 `none` 预检圆角矩形、为 `alt` 预检圆形；`ctrl/shift` 不加载模板。
- 可抽取一个仅负责 Shape Fill/Stroke 创建、索引重取与样式表达式安装的小助手供圆角矩形和圆形复用；不得把几何算法移入通用 Pseudo Effect Loader。

- [ ] **Step 1: 扩展 Host mock 与模板合约 RED 测试**

  让测试 File mock 接受两份 `.ffx`，让 `applyPreset()` 根据文件生成对应签名和参数结构。新增圆形模板白名单、Catalog 映射、错误 marker/参数索引和未知 ID 拒绝测试。

- [ ] **Step 2: 写 Alt 圆形创建 RED 测试**

  断言 Alt 创建一个 `Nya 圆` 图层和一份 `Pseudo/NYA_Circle_v2_zhCN` 效果，不再创建旧 `ADBE Slider Control`；Ellipse Size 使用半径参数生成 `[r*2,r*2]`；Fill/Stroke 的开关、颜色和宽度分别绑定索引 3–7。

- [ ] **Step 3: 写失败与回归 RED 测试**

  覆盖圆形模板缺失时创建图层前失败、加载/签名失败时只移除本次新层并恢复选择、Shape Contents 索引引用失效后重新获取、圆角矩形 v8 除描边范围外保持 v7 行为、`ctrl/shift` 仍使用原生控件。

- [ ] **Step 4: 运行 Host 测试确认 RED**

  Run: `npm.cmd run test -- tests/layerShapeHost.test.js`

  Expected: 圆形模板尚未进入白名单，Alt 仍生成旧 Slider Control，样式运算符或表达式尚不存在。

- [ ] **Step 5: 实现白名单和圆形绑定**

  以 ES3 语法扩展现有共享 Helper 契约；预检后调用 `applyPseudoEffectTemplate()`。圆形几何继续使用原生 `ADBE Vector Shape - Ellipse`，Size 表达式固定为半径的两倍；添加 Fill/Stroke 后按 `propertyIndex` 重新获取，再安装样式表达式并检查 `expressionError`。

- [ ] **Step 6: 重跑 Host 与 Bridge 测试确认 GREEN**

  Run: `npm.cmd run test -- tests/layerShapeHost.test.js tests/layerBridge.test.ts tests/pseudoEffectAssets.test.js`

  Expected: 三个文件全部通过；圆角矩形、三角形和星形无行为回归。

## Task 4：构建、开发扩展同步与自动化验收

**Files:**

- Verify/Generated: `dist/host/index.jsx`
- Verify/Generated: `dist/host/pseudo-effects/catalog.json`
- Verify/Generated: `dist/host/pseudo-effects/circle-zh-CN.ffx`
- Verify/Generated: `dev-extension/host/**`

- [ ] **Step 1: 运行最窄相关验证**

  Run: `npm.cmd run test -- tests/pseudoEffectAssets.test.js tests/layerShapeHost.test.js tests/layerBridge.test.ts`

  Expected: 全部通过。

- [ ] **Step 2: 运行类型检查、构建和 smoke**

  Run: `npm.cmd run typecheck`

  Run: `npm.cmd run build`

  Run: `npm.cmd run smoke:dist`

  Expected: 全部通过；Vite 大 chunk 警告可以记录，但不是本轮失败。

- [ ] **Step 3: 运行全量测试并区分基线**

  Run: `npm.cmd run test -- --maxWorkers=2`

  Expected baseline: 现有仓库可能仍有 3 项无关失败——缺少被忽略的 `outputs/nya-launcher-p1/NyaLauncher.exe`，以及两项未跟踪旧实验测试引用废弃 v1 路径。若失败集合增加，必须先修复本轮回归。

- [ ] **Step 4: 同步并核对开发扩展**

  使用现有 `dev:cep`/watch 流程，不创建第二份测试扩展。比较 `public/`、`dist/`、`dev-extension/` 和 `%APPDATA%\Adobe\CEP\extensions\com.kuroii.nyaworks.panel` 中 Host、Catalog、圆角矩形 FFX、圆形 FFX 的 SHA-256；四处对应文件必须一致。

## Task 5：Windows / 中文 AE 2025 真实验收与状态收尾

**Files:**

- Create/Update: `docs/testing/circle-pseudo-effect-ae-test.md`
- Modify: `docs/current-feature-inventory.md`
- Modify: `planning/02-roadmap.md`

- [ ] **Step 1: 刷新同一个 NYAWORKS 开发扩展并创建全新圆形**

  在测试工程中对新建形状按钮按住 Alt，确认只创建一个 `Nya 圆` 图层、效果控件显示 `Nya 圆形`，且 Contents 中存在 Ellipse、Fill、Stroke。不得用旧圆形实例替代新模板验收。

- [ ] **Step 2: 验收参数和几何**

  在 `1920×1080` 和 `3840×2160` 测试合成中对照原生 Ellipse，观察半径 `250/500/960/1920/2203/3000/5000` 的可见效果。检查默认半径 `250`；分别实测下划线数值轻拖、滑杆拖动、右侧刻度和直接输入，轻拖不得跳大数，滑杆范围为 `0–3000`，直接输入 `3000`、`5000` 可用而 `5001` 被限制，并检查输入超过滑杆上限后再拖动的行为。改变半径时 X/Y 尺寸始终相同，不得变成椭圆；记录 AE 版本、合成尺寸、截图和结论。若真实 AE 验收发现范围需要调整，先记录并更新计划与 schema。

- [ ] **Step 3: 验收样式、动画和失败边界**

  检查填充开关/颜色、描边开关/颜色/宽度；观察描边宽度 `0/5/20/100/500/1000` 的可见效果。圆形 v3 与圆角矩形 v7 的数值拖动和滑杆刻度均为 `0–100`、直接输入范围均为 `0–1000`，`1001` 被限制，默认 `5` 仍便于微调。AE 脚本已确认 0/5/100/500/1000 的绑定和越界拒绝，鼠标交互与可见效果仍须单独检查。再检查半径与样式关键帧、效果重命名、一次 Undo、复制图层，并回归三角形、星形原行为。未经真实 AE 鼠标操作验收不得宣称数值手感已通过。

- [ ] **Step 4: 验收保存重开**

  保存工程、关闭并重新打开，确认圆形仍可调参和渲染；关闭 NYAWORKS 面板后效果仍工作。其他 AE 版本、macOS、跨电脑和其他控件语言未测试时继续标记为待验收。

- [x] **Step 5: 更新文档并形成提交候选**

  记录 AE 完整版本、操作系统、语言、通过项和未测项；Roadmap 只在用户真实确认后勾选 Alt 圆形。重新核对 Git 状态，只纳入本计划拥有的文件。未经用户明确要求不 commit/push；得到授权后建议提交信息：`feat: add circle pseudo effect controls`。

## 完成标准与下一步

本轮资产、Bridge/Host、构建同步及 130 文件 / 708 项测试已通过，用户在 Windows / 中文 AE 2025 中最终确认圆角矩形与圆形均正常，并授权提交推送。据此完成本轮功能收尾；下方和 Task 5 中未逐项填写的详细操作不另行声明为逐项实测通过。后续下一种形状为 `Ctrl` 三角形：独立模板、独立几何参数规格，继续复用同一个共享 Host Helper，不直接复制圆形业务表达式。

三角形、星形的描边宽度必须沿用公共规格：默认 5、数字拖动/滑杆 0–100、输入 0–1000；这是用户已明确的统一要求。它们的几何参数和后续摄像机参数仍须分别依据实际 AE 工作场景确定默认值、数值拖动范围、滑杆刻度和输入上限。每种参数都要区分“技术上允许输入”与“日常拖动是否可控”，并在真实 AE 中完成边界和手感验收。

## 执行方式

建议 Native：资产、Bridge、Host 和 AE 验收按顺序依赖，当前主会话顺序执行更容易保护已通过的圆角矩形链路。用户明天从本计划继续时，先读取本文件、项目 `AGENTS.md`、当前 Git 状态和最新提交，再使用 `superpowers:executing-plans` 与 `superpowers:test-driven-development` 逐任务推进，不需要重新讨论已固定的六项参数。
