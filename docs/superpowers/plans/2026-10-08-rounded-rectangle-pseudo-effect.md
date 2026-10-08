# 圆角矩形伪效果试点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只为新建圆角矩形接入一份伪效果控件，按用户参考排列八项参数并提供可折叠的“分离参数”组；保留基础默认外观，在核对四角百分比语义后实现分离模式，并在现有 NYAWORKS 开发扩展中验证。

**Architecture:** 沿用 `create-shape` Action 的普通点击分支，在 Host 内调用共享模板加载助手；其他修饰键形状及摄像机不变。先取得实际 AE 可加载的模板及属性映射，再实现访问和绑定，不用模拟模板替代可行性验证。

**Tech Stack:** 现有 React/TypeScript、ExtendScript、`.ffx`、Vitest、Vite；不增加前端文件系统权限或第三方运行时。

**Spec:** [共享伪效果系统设计](../specs/2026-10-08-pseudo-effect-system-design.md)。

状态：2026-10-08 已有 `v1` 候选模板、Catalog、形状 Host 接入与开发扩展构建，并按用户要求推送现有开发分支供家中测试；所有真实 AE `v1` 加载、折叠、表达式/重排、保存重开及编码可携带性门槛仍未通过。当前 AE 2025 中用户工程不自动修改。此次将原计划 Task 2–4 的可离线实现部分提前做成候选，并不将任何任务标记为宿主验收完成。详见[真实测试记录](../../testing/rounded-rectangle-pseudo-effect-ae-test.md)。

## Global Constraints

- 主要目标 AE 2022–2026；本机发现 AE 2023/2025，其他版本和 macOS 不得据此宣称通过。
- 仅新建圆角矩形；不迁移旧图层、不更新摄像机、不改变圆/三角形/星形。
- 保留宽高 `500 × 500`、总圆角 `50`、分离开关 `0` 的基础默认外观；四角按参考使用百分比显示，截图值均为 `50.00%`，不再把它们写成四个 `50 px` 半径。换算和初始值在语义验证后固定。
- 首个试点固定简体中文控件，与当前形状参数语言一致；不宣称五语言模板完成，不修改现有五语言面板设置。
- 内部模板不进入用户资源列表，不要求修改 `PresetEffects.xml`，不安装或购买制作工具而不说明。
- 同一 `dev-extension/` 测试，不制作独立测试扩展；按用户本轮决定先推送测试候选，真实 AE 验收后才能标记功能完成。
- 只有真实模板加载、表达式采样和工程重开证据才能证明 AE 可用；mock 只验证我们自己的加载/清理逻辑。
- 使用已有 Git 基线保留当前版本，不重排项目目录或另建发布副本。

## Review Focus

1. 新建时原来多选了图层及属性：预设只作用于新圆角矩形；失败后原选层保持不变。
2. 模板文件存在但 matchName、属性编号或类型错误：安全失败，不取猜测索引继续生成。
3. 效果重命名、重排以及复制整个形状层：表达式仍读取该层的正确控件；重复效果出现歧义不得误连。
4. 开关切换、关键帧插值和超大圆角：百分比正确换算后再做路径边界限制，不误当像素值；折叠组不影响开关、参数或形状。
5. 模板添加成功后绑定失败：清理本次新建对象、闭合唯一 Undo Group，不删除旧形状或用户效果。

## 参数布局

布局以[已归档的玄如意效果控件截图及核对记录](../../references/xuanruyi-rounded-rectangle-controls.md)为基准，不增设“尺寸／圆角”两层分组：

```text
Nya 圆角矩形
├─ 宽度
├─ 高度
├─ 圆角值
├─ 分离圆角             复选框
└─ 分离参数             可点击三角展开/收起
   ├─ 左上角            百分比
   ├─ 右上角            百分比
   ├─ 右下角            百分比
   └─ 左下角            百分比
```

分离圆角开关决定四角是否独立控制；分离参数的折叠状态只影响显示，不改变参数、关键帧、开关或路径。不因为开关关闭就隐藏该组，不添加额外按钮；参考的底部网站署名不移植。

截图不能证明百分比的换算基准、存储值或有效范围。先验证四角 `0 / 50 / 100%` 在不同宽高和总体圆角值下的结果，再固定转换规则；禁止把 `50%` 当作 `50 px` 或未经验证就乘总体圆角。非分离模式保留现有路径规则，已有原生控件不迁移。

## Task 1：模板制作与真实加载探针

**Files:**

- Create: `assets/pseudo-effects/rounded-rectangle/v1/schema.json`
- Create: `assets/pseudo-effects/rounded-rectangle/v1/authoring.xml`
- Create: `assets/pseudo-effects/rounded-rectangle/v1/provenance.md`
- Create: `public/host/pseudo-effects/rounded-rectangle-v1-zh-CN.ffx`
- Create: `public/host/pseudo-effects/catalog.json`
- Create: `scripts/ae-tests/pseudo-effect-template-probe.jsx`
- Test: `tests/pseudoEffectAssets.test.js`
- Record: `docs/testing/rounded-rectangle-pseudo-effect-ae-test.md`

**Interfaces:**

- Input: 八个参数的语义 ID、上述已核对布局及经过验证的单位/初始值；一个不可动画的内部类型标记。四角语义 ID 明确区分百分比与旧版像素半径。
- Output: 单一模板 `shape.roundedRectangle/v1/zh-CN`、实际 matchName、经 AE 读取核对的 `paramId → propertyIndex/type` 映射和 SHA-256。
- 制作资产可采用符合授权条件的外部制作器，但不把制作器打包为 NYAWORKS 依赖。实际工具、版本及输入文件必须记入 provenance；没有合格导出物，本任务不通过，Task 2 不开始。

- [x] 取得用户的玄如意效果控件参考原图，归档并核对参数顺序、分离参数分组及展开/收起需求。
- [ ] 核验分离模式的四角百分比基准、存储值和允许范围；用 `0 / 50 / 100%`、宽高变化和总体圆角变化形成独立样本，确定新模板初始值及换算规则后再固定制作源。
- [ ] 写资产合约测试：缺少真实 `.ffx`、哈希不符、参数遗漏、未知模板及不完整映射时均失败。默认值用手写字面量校验，不复用生成器计算期望。
- [ ] 运行 `npm.cmd run test -- tests/pseudoEffectAssets.test.js`，确认因缺少目标资产而失败，而不是因测试语法或路径错误失败。
- [ ] 写可审查参数规格及制作源，固定模板身份；正式保存后重新加载，不能采用制作器临时 Apply 的随机标识。
- [ ] 准备只在空测试工程运行的探针：遇到已有项目项就拒绝，不关闭/覆盖当前工程；创建自己的临时合成及形状层，加载并输出属性结构和默认值。
- [ ] 在可用的 AE 2023/2025 中核验可折叠分组、八个参数、内部标记、可动画属性及一次加载的效果数量；单独验证展开/收起不改变分离开关和几何结果。记录具体版本和执行结果，未测版本保留待验证。
- [ ] 填入真实映射与哈希；测试报告须证明加载后只有预期效果，无变换/素材/额外业务表达式。
- [ ] 重跑资产合约测试。通过后才能实现运行时；源码/XML 存在或 RIFX 文件头正确都不能单独视为本任务完成。

**制作路线的已知前置项：**

仓库尚无模板。常见 CEP 扩展目录中未找到明确的 Pseudo Effect Maker 安装声明；这不是对整台电脑的完全安装审计。

[BatchFrame 文档](https://batchframe.com/support/manuals/pseudo-effect-maker/)提供 XML/JSON 制作与 `.ffx` 保存路线。[AfterEffects-FFX-Builder](https://github.com/GuyMicciche/AfterEffects-FFX-Builder)是另一候选，但其仓库声明 GPL-3.0；本次只读调查还发现随机 matchName 后缀、Latin-1 标签编码和分组实现需要核验。因此尚未选用、安装、复制或执行该生成器，不能直接把它或其未经验证的输出带入产品。若模板取得需要付费工具、新授权或改用另一条架构路线，先说明并取得用户决定。

## Task 2：最小共享 Host 加载助手

**Files:**

- Create: `public/host/pseudo-effects/runtime.jsxinc`
- Modify: `public/host/index.jsx`（加载入口，不重构其他 Host 模块）
- Test: `tests/pseudoEffectHost.test.js`
- Test: `tests/hostScriptCompatibility.test.js`

**Interfaces:**

- `runtime.jsxinc` 以 IIFE 返回助手对象，由 Host 使用已捕获的 `hostScriptFile.parent` 定位并惰性加载；不写第二套全局 Action 接口。
- `preflight(templateId)`：只接受 Catalog 的模板 ID，返回已校验的模板描述或抛出带稳定 `code` 的错误，不修改工程。
- `ensureControls(layer, templateId)`：只对本次业务创建的目标调用，返回 `{ effect, parameters, created }`；`parameters` 以语义 ID 索引真实属性。
- `buildReader(binding)`：产生只在目标图层效果范围内识别类型标记并读取固定映射的表达式片段；不靠可改的效果显示名定位。
- 失败由已有业务 Action 转成现有失败协议，不增加前端第二套运行系统。

- [ ] 写 RED 测试：路径越界/未知 ID/缺文件不调用 AE；加载时只有目标层选中且无干扰属性选择；多选和时间恢复正确。
- [ ] 写 RED 测试：签名/类型错误、效果数量异常拒绝；幂等调用不追加或重置；同层同类多个效果返回歧义。
- [ ] 运行 `npm.cmd run test -- tests/pseudoEffectHost.test.js`，确认失败来自缺少相应行为。
- [ ] 实现路径约束、预检、选层隔离、模板加载和加载后的引用重取；AE API 是唯一必要的测试替身，真实 Helper 本身不能被 mock 掉。
- [ ] 实现标记读取及映射访问；效果改名/移动后仍按实际实例读取，未知或多个候选不能直接取第一项。
- [ ] 重跑 Host 测试与脚本兼容检查；用真实探针验证表达式能访问标记和参数，否则停在 Task 2，不以 mock 覆盖问题。

## Task 3：接入圆角矩形与已验证的百分比换算

**Files:**

- Modify: `public/host/index.jsx`（`createRoundedRectangleShape`、普通形状分支及其失败清理）
- Modify: `tests/layerShapeHost.test.js`
- Modify: `tests/layerCreationHost.test.js`（只补充相关回归）

**Interfaces:**

- 普通 `create-shape` 在创建图层前调用模板预检；`alt / ctrl / shift` 继续原来的原生控件路径。
- 圆角矩形绑定读取八个语义参数；非分离模式保留当前 `createPath()` 基础外观，分离模式先按 Task 1 的验证结果把百分比换成实际半径，再进入路径计算。
- 唯一外层 Undo Group 仍归 `runLayerAction()` 管理；错误清理只针对本次创建且身份已记录的对象。
- 试点缺模板或映射错误时明确失败，不静默生成八个原生控件冒充伪效果测试成功。旧工程不参与此次路径。

- [ ] 写 RED 测试：普通点击产生一份伪效果及同样的闭合路径；其他三种形状继续其原控件；不访问或修改已有圆角矩形控件。
- [ ] 写 RED 测试：分离关闭时，默认 `500 × 500 / 50` 的八个路径点、切线与原行为一致；分离开启时，用 Task 1 的独立参考样本验证百分比换算、各角对应关系及几何边界限制。
- [ ] 写 RED 测试：读入不同时间的参数样本产生对应路径，不在重复加载时重置已有关键帧/表达式参数。
- [ ] 写 RED 测试：加载或绑定中途失败后无残留新层，旧选层及旧效果保留；Undo Group 开闭次数为一。
- [ ] 运行 `npm.cmd run test -- tests/layerShapeHost.test.js tests/layerCreationHost.test.js`，观察预期失败。
- [ ] 用 Task 2 助手替换圆角矩形的控件创建/读取，增加已核验的四角百分比转换，不修改其他形状或摄像机算法；根据失败记录实现精确清理。
- [ ] 重跑上述测试及 `tests/layerControllerHost.test.js`，确认摄像机和控制器行为未变化。

## Task 4：正式开发扩展构建与验收

**Files:**

- Modify: `scripts/dist-contract.mjs`（加入内部模板、映射及助手的资产合约）
- Test: `tests/pseudoEffectAssets.test.js`（生产/开发构建的必要文件）
- Modify: `docs/testing/rounded-rectangle-pseudo-effect-ae-test.md`
- Modify: `README.md`、`planning/02-roadmap.md`（实际状态，不把全部伪效果系统标为完成）

- [ ] 先补充构建缺少内部资产时失败的合约测试，再补必要文件清单，运行测试验证红绿过程。
- [ ] 运行完整 `npm.cmd run verify`，记录类型检查、全量测试、构建与 smoke 的实际结果；任何既存失败也列出。
- [ ] 使用现有构建配置更新 `dev-extension/`，核对 `.ffx`、Catalog、Host 助手与源码版本一致；不创建额外测试扩展。
- [ ] 在空测试工程通过 NYAWORKS 普通点击创建圆角矩形，对照归档图验收参数布局、“分离参数”独立展开/收起、四角百分比及功能开关；再验收关键帧、表达式、撤销/重做、多选隔离及原形状修饰键。
- [ ] 验收效果改名/重排、整层复制、保存/重开、关闭面板后的调参与渲染；失败或未执行的项目逐项保留。
- [ ] 用户正常工程只做用户亲自确认的测试，不批量改写或自动迁移。没有干净跨电脑证据前，不标记可携带性通过。
- [ ] 用唯一开发扩展完成家中 AE 验收并记录实际结果；此次提前推送仅用于取得测试候选，正式验收状态不随推送改变。

## 本次执行选择

建议 Native：由当前会话顺序实施，先跨过模板可行性门槛，再接入加载器与圆角矩形；本试点依赖紧密，不需要把尚未验证的模板格式交给多个实现者并行猜测。

用户已批准顺序执行；本轮只推进可行性实验和探针，未改变产品代码或构建产物。只在本拥有的独立测试工程中创建/移除实验对象；当前工程切换后停止宿主写入，不再次索取“是否开始”的流程批准。
