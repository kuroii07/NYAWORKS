# 三角形与星形伪效果 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按用户确认的参数为 Ctrl 三角形、多边形和 Shift 星形接入独立伪效果，同时保护已验收的圆角矩形与圆形。

**Architecture:** 沿用现有 UI → Action → Layer Bridge → `public/host/index.jsx` → AE 链路，复用白名单 Pseudo Effect Host Helper。两种新形状分别拥有 schema、FFX 身份和固定参数映射，几何继续由原生 Polystar 属性与表达式驱动；先通过三角形，再接入星形。

**Tech Stack:** TypeScript、CEP、ExtendScript ES3、After Effects 2025、Node.js FFX 生成器、Vitest。

**Spec:** 本文件的“已确认参数”记录 2026-10-10 用户最终调整；共享架构见[伪效果系统设计](../specs/2026-10-08-pseudo-effect-system-design.md)。

**2026-10-10 原生范围校正：** 实现期间在 AE 25.6x101 对照原生 Polystar 与新伪效果后确认，星形和多边形的原生 Points 最小值均为 3。直接设置 2/2.5 会被 AE 拒绝，表达式返回 2/2.5 也会被限制为 3；此前方案将星形下限定为 2 不准确。为保持本计划的原生 Polystar 架构与“控件值等于实际角数”，星形拖动/输入下限更正为 3，默认仍为 5，上限不变。更正计划先推送，再修正实现。已被临时验证加载过的星形 v1 定义不覆盖，最终使用 v2 内部身份，公开文件名不变。原始证据保留在 `work/polygon-pseudo-20261010/points-boundary-result.json`。

## 执行顺序与基线

- 基线提交为 `14b807d`，当前主工作树为 `main`。用户已经确认圆角矩形 v7、圆形 v3 正常。
- 用户要求先把本开发步骤文档提交推送到 GitHub，再正式按路线开发；文档推送确认前不得修改实现。
- 文档推送后，本会话直接执行：先资产和 Bridge，再三角形、星形，最后构建、真实 AE 回归与验收记录。独立的资产/Bridge 工作可分工，Host 和 AE 测试由主会话统一进行。
- 本轮授权先推送计划并开发；功能代码保持本地候选，用户验收后再按后续提交授权处理。
- 先前提前修改的 Bridge 与测试已撤回；旧 v8 实验目录已按用户要求删除，不恢复旧失败候选。

## 已确认参数

### 三角形入口：默认 3 边，可调整为其他多边形

| 顺序 | ID | 效果控件标签 | 类型 | 默认值 | 拖动/滑杆范围 | 输入范围 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `points` | 点（边数） | 整数显示滑杆 | 3 | 3–20 | 3–100 |
| 2 | `rotation` | 旋转 | 原生角度 | 0° | 原生角度交互 | 支持负角度和多圈 |
| 3 | `outerRadius` | 外半径 | 滑杆 | 250 | 0–3000 | 0–5000 |
| 4 | `outerRoundness` | 外圆度 | 百分比 | 0% | 0–100% | 0–100% |

入口仍为 Ctrl，默认图层/效果名称均为 `Nya 三角形`，原生 Polystar Type 为 2（多边形）。改为 4、5 等边数时仍使用此入口和名称，不增加类型切换控件。圆角采用 AE 原生外圆度，0% 为尖角，不重复提供同义“圆角”参数。

### 星形入口

| 顺序 | ID | 效果控件标签 | 类型 | 默认值 | 拖动/滑杆范围 | 输入范围 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `points` | 角数 | 整数显示滑杆 | 5 | 3–20 | 3–100 |
| 2 | `outerRadius` | 外半径 | 滑杆 | 250 | 0–3000 | 0–5000 |
| 3 | `innerRadius` | 内半径 | 滑杆 | 125 | 0–3000 | 0–5000 |
| 4 | `rotation` | 旋转 | 原生角度 | 0° | 原生角度交互 | 支持负角度和多圈 |
| 5 | `outerRoundness` | 外圆角 | 百分比 | 0% | 0–100% | 0–100% |
| 6 | `innerRoundness` | 内圆角 | 百分比 | 0% | 0–100% | 0–100% |

入口仍为 Shift，默认图层/效果名称均为 `Nya 星形`，Polystar Type 为 1。内半径保持独立控制，实际几何使用 `max(0, min(innerRadius, outerRadius))`；不增加比例联动参数。

### 两者共用的“样式”折叠组

| ID | 标签 | 类型 | 默认值 | 拖动/滑杆范围 | 输入范围 |
| --- | --- | --- | --- | --- | --- |
| `fillEnabled` | 启用填充 | 复选框 | 开启 | 开/关 | 开/关 |
| `fillColor` | 填充颜色 | 颜色 | 白色 `[1,1,1,1]` | 颜色选择器 | 颜色选择器 |
| `strokeEnabled` | 启用描边 | 复选框 | 关闭 | 开/关 | 开/关 |
| `strokeColor` | 描边颜色 | 颜色 | 黑色 `[0,0,0,1]` | 颜色选择器 | 颜色选择器 |
| `strokeWidth` | 描边宽度 | 滑杆 | 5 | 0–100 | 0–1000 |

三角形共 9 项业务参数，星形共 11 项。边数/角数显示精度为 0，几何取整数；其他滑杆沿用精度 2。形状参数是实际形状的局部坐标数值，不随合成尺寸自动改默认值。

## Global Constraints

- 保持已验收圆角矩形 v7 和圆形 v3 的 schema、公开 FFX 字节、几何与样式函数不变；新功能只扩展新模板白名单、明确分支和对应 builder。
- v7 FFX SHA-256 必须为 `D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9`；v3 必须为 `0B3F38341544AC1B13CF0D5E2F87CE734555EC388CE334C7F22BA8DE7E99E02E`。
- 四种形状统一执行 `validateShapeStrokeWidth(schema)`：默认 5、拖动 0–100、输入 0–1000。不得因新形状生成而改写旧模板的默认值或范围。
- 公开文件名不带版本号：`triangle-zh-CN.ffx`、`star-zh-CN.ffx`；身份和 marker 在内部版本化，禁止同一 matchName 对应不同定义。
- 模板路由使用显式 `if/else`；四个修饰键均从 Bridge 传 CEP 扩展根目录。未知模板、错配形状、缺失目录和损坏映射在创建前拒绝。
- 不新增 Action/Bridge，不增加类型、位置、整体透明度、虚线等本轮未确认参数；不迁移旧工程图层，不修改 `PresetEffects.xml`。
- 在同一个原开发扩展交付。真实 AE 测试只创建、清理自己拥有的临时图层，恢复原选择，不关闭、替换或保存用户工程。
- 自动化、AE 脚本读数、用户面板交互和保存重开分别记录；未取得的证据不得写为通过。

## 模板合同与文件边界

| 项目 | 三角形 | 星形 |
| --- | --- | --- |
| templateId | `shape.triangle/v1/zh-CN` | `shape.star/v2/zh-CN` |
| matchName | `Pseudo/NYA_Triangle_v1_zhCN` | `Pseudo/NYA_Star_v2_zhCN` |
| marker | `__NYA_TRIANGLE_V1__` | `__NYA_STAR_V2__` |
| 几何索引 | points=1, rotation=2, outerRadius=3, outerRoundness=4 | points=1, outerRadius=2, innerRadius=3, rotation=4, outerRoundness=5, innerRoundness=6 |
| 样式组 | 5 | 7 |
| 样式索引 | fillEnabled=6, fillColor=7, strokeEnabled=8, strokeColor=9, strokeWidth=10 | fillEnabled=8, fillColor=9, strokeEnabled=10, strokeColor=11, strokeWidth=12 |
| marker 索引 | 11 | 13 |

新建两个 schema；扩展现有生成器、Catalog 与 dist 合同。Bridge 只改形状根路径判定；Host 的新形状业务留在现有形状代码区域。测试分别位于 `tests/pseudoEffectAssets.test.js`、`tests/layerBridge.test.ts`、`tests/layerShapeHost.test.js`。真实 AE 结果归档到 `work/polygon-pseudo-20261010/`，验收文档为 `docs/testing/triangle-star-pseudo-effect-ae-test.md`。

## Review Focus

1. 普通点击、Alt、Ctrl、Shift 连续交替时仍分别使用自己的模板；合法但属于其他形状的模板必须在添加属性前拒绝（Task 3/4/5）。
2. Angle、百分比、整数显示以及颜色不能只按 schema 推断；真实 FFX 字节、AE 读数和原生属性类型都要核对，特别是黑色的通道顺序（Task 1/5）。
3. 边数/角数、半径、内外圆度在端点、分数和关键帧采样时保持正确；内半径大于外半径时几何应限制而非报错（Task 3/4/5）。
4. AE `addProperty` 会使索引组旧引用失效；全部添加 Fill/Stroke 后重新按索引取属性，并覆盖原生 `Roundness`/`Roundess` 名称差异（Task 3/4）。
5. 模板缺失、参数错误或表达式失败时，只移除本次创建图层，恢复原选择并保留有用诊断；不能破坏已有形状（Task 3/4/5）。

## Task 1：新模板资产与格式验证

**Files:** Create `assets/pseudo-effects/triangle/v1/schema.json`、`assets/pseudo-effects/star/v2/schema.json`；Modify `scripts/build-shape-pseudo-effects.mjs`、`scripts/dist-contract.mjs`、`tests/pseudoEffectAssets.test.js`；Generate 两个 FFX 和合并 Catalog。校正前的星形 v1 临时 schema 不保留为候选。

**Interfaces:** `npm.cmd run build:pseudo-effects` 生成四个独立模板；`layoutParameters(schema, layout)` 支持 rectangle/circle/triangle/star，未知 layout 明确拒绝。Angle 使用原生角度类型，points 使用 precision=0，旧字段默认精度保持 2。

- [ ] **Step 1:** 补资产 RED 测试：断言上表中的身份、标签、参数顺序、默认值、范围、固定索引；新两个 FFX 必须在 dist 合同中，circle/v3 加入不可改写哈希保护。
- [ ] **Step 2:** 运行 `npm.cmd run test -- tests/pseudoEffectAssets.test.js --exclude '**/.worktrees/**' --maxWorkers=1`，确认因新模板缺失而失败。
- [ ] **Step 3:** 在隔离身份下确认 Angle 和颜色格式。已有 Angle 原型在 AE 25.6x101 对照原生控件通过 0、45.5、-90、±720、36000 及线性关键帧采样；该证据只验证格式，不能代替最终模板验收。颜色需实际读回白/黑 RGBA；若需调整编码，仅用于新模板，保留 v7/v3 字节。
- [ ] **Step 4:** 按固定合同新增 schema，最小扩展生成器的多几何参数布局、Angle 和数字精度；每个模板独立解析基底，不复用可变生成树。执行 `npm.cmd run build:pseudo-effects`。
- [ ] **Step 5:** 重跑该测试文件，全部通过；核对定义与流中的范围、颜色、Angle、精度，检查旧两份 FFX 哈希精确相同。

## Task 2：Bridge 的四形状路径合同

**Files:** Modify `src/host/layerBridge.ts`、`tests/layerBridge.test.ts`。

**Interfaces:** `createLayerHostBridge().runLayerAction(action, modifier)` 签名不变；`create-shape` 的四种合法 modifier 都传 `extensionRoot`，其他 Action 继续原行为。

- [ ] **Step 1:** 写 Ctrl/Shift 路径传递及缺路径拒绝测试，保留 none/alt；补其他 Action 不需要形状目录的回归。
- [ ] **Step 2:** 运行 `npm.cmd run test -- tests/layerBridge.test.ts --exclude '**/.worktrees/**' --maxWorkers=1`，观察预期失败。
- [ ] **Step 3:** 仅扩展 `pseudoShape` 判定，不修改结果解析、调用协议或其他 Action。
- [ ] **Step 4:** 重跑并全部通过。

## Task 3：先接入可调边数的三角形

**Files:** Modify `public/host/index.jsx`、`tests/layerShapeHost.test.js`。

**Interfaces:** 扩展 `getPseudoEffectTemplateContract(templateId)` 的 triangle 白名单；`createShapeLayer(context, modifier, extensionRoot)` 明确将 ctrl 路由到 triangle；polygon builder 使用 context/template，原矩形和圆形 builder 不改。

- [ ] **Step 1:** 扩充 mock 的新 FFX 及参数读取能力；写三角形默认值、唯一效果、实际效果名绑定、固定合同、边数 3/4/20/100、分数取整、半径、负角/多圈旋转、外圆度、Fill/Stroke 绑定测试。与圆/矩形错配的模板在添加属性前拒绝。
- [ ] **Step 2:** 运行 `npm.cmd run test -- tests/layerShapeHost.test.js --exclude '**/.worktrees/**' --maxWorkers=1`，确认新增场景失败。
- [ ] **Step 3:** 三角形改用 Type=2 与 `max(3, min(100, round(points)))`，其余几何按合同索引绑定；取 `applyPseudoEffectTemplate()` 返回的实例名称构造表达式。保留原生外圆度属性名的兼容查找。
- [ ] **Step 4:** 增加只供新 polygon 业务使用的样式绑定：真实 Stroke 位于 Fill 上方；完成全部添加后重新取得 Fill/Stroke 及属性。覆盖引用失效、缺参数、缺预设、表达式错误和只清理新层的测试。星形在此步骤仍保留旧入口，直到 Task 4 完成替换。
- [ ] **Step 5:** 重跑该测试文件全部通过；矩形/圆形断言不能删减或降低，旧 FFX 哈希仍相同。

## Task 4：接入星形并完成四路由

**Files:** Modify `public/host/index.jsx`、`tests/layerShapeHost.test.js`。

**Interfaces:** 增加 star 白名单与 shift 显式路由，复用 Task 3 的 polygon 样式机制；为星形提供六个几何参数，删除已被完整替代的旧散装控件创建路径。

- [ ] **Step 1:** 写星形独立合同和默认值测试；角数 3/5/20/100 与取整、2 被拒绝或在表达式中限制为 3，内半径大于外半径、内外圆角、旋转、样式、两种 roundness 拼写和错误模板拒绝必须覆盖。
- [ ] **Step 2:** 运行同一 Host 测试命令并观察新增场景失败。
- [ ] **Step 3:** 用 Type=1 和 `max(3, min(100, round(points)))`；外半径非负，内半径限制到 0..外半径，内外圆角限制到 0..100。将 Shift 接入已存在的预检/应用/清理链路。
- [ ] **Step 4:** 增加 none → alt → ctrl → shift → none → alt 连续创建测试，核对每次实际模板；四个 builder/路由的错配防线与错误恢复均通过。
- [ ] **Step 5:** 运行三个相关测试文件并全部通过，审查本轮 diff 没有改写 v7/v3 的业务函数、规格或 FFX。

## Task 5：构建、同一扩展同步与真实 AE 回归

**Files:** Create `docs/testing/triangle-star-pseudo-effect-ae-test.md`；Update 本计划、`docs/current-feature-inventory.md`、`planning/02-roadmap.md`；真实探针与报告放本轮 work 目录。

- [ ] **Step 1:** 运行 `npm.cmd run build`（含 TypeScript）、`npm.cmd run smoke:dist`，均通过；按现有 `NYAWORKS_CEP_DEV=1` / `NYAWORKS_CEP_DEV_OUT_DIR=dev-extension` 构建原开发扩展。
- [ ] **Step 2:** 核对源码、dist、dev-extension、当前 CEP junction 的 Host、Catalog、四份 FFX 哈希一致；v7/v3 与基线严格相同。
- [ ] **Step 3:** 在 AE 25.6x101 重载原开发 Host，按 none → alt → ctrl → shift → none → alt 创建。先逐个新形状检查名称、唯一效果、类型、标签、默认值和全部表达式，再核对旧形状仍正常。
- [ ] **Step 4:** 对新形状采样点数端点/越界、半径 0/250/3000/5000、圆度 0/50/100、旋转 -90/720、描边 0/5/100/500/1000；星形另测内半径超过外半径。核对实际矢量属性、颜色/开关、关键帧采样与改名/复制；仅清理自己创建的对象，原有图层 ID 和选择保持一致。
- [ ] **Step 5:** 运行 `npm.cmd run test -- --exclude '**/.worktrees/**' --maxWorkers=2`，等待完整退出并记录实际文件/测试数量；超时或中止不能算通过。随后 `git diff --check`。
- [ ] **Step 6:** 将脚本结果、用户交互待验收项、原生 AE 版本和产物哈希写入测试记录。鼠标拖动、视觉、Undo、保存重开由实际操作记录确认，不能由 Node 或 Host 数值报告代替。

## 完成标准

按本文确认的参数实现两种新形状；资产、Bridge、Host、构建、同扩展同步及实际 AE 数值检查通过，旧两种形状回归通过。本轮不越过三角形/星形去开发摄像机或选择九宫格；功能候选交付后等待用户真实使用确认，不提前标记完整环境兼容或发布完成。
