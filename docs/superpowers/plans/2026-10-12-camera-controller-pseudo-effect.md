# Camera Controller Pseudo-Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已有摄像机控制器的 15 项参数接入六组伪效果，按五种面板语言创建，并保护旧摄像机和其他新建图层行为。

**Architecture:** 使用摄像机专属 schema、模板制作源和 Catalog 条目；Host 复用现有形状的白名单预检与隔离加载原则，以摄像机专属绑定表按实际模板属性索引读值。当前业务公式不变；旧实例继续使用原生控件，不做自动迁移。

**Tech Stack:** AE 2022–2026+、ExtendScript、CEP、Node.js、Vitest、FFX/Catalog。

**Spec:** `docs/superpowers/specs/2026-10-12-camera-controller-parameters-review.md`（用户于 2026-10-12 同意继续开发，包括建议范围和原有时间公式）。

## Global Constraints

- 保留 15 项、六组、35mm、位置运行时初始化及默认值 `0/35/1000/2` 等审阅稿数值；移动仍为 `time × speed`。
- 中文旧摄像机、Null、调整层及四种形状的参数、FFX、Catalog 条目和实际行为不迁移、不重写。
- 五语言各自模板身份、名称和 Catalog 白名单；日/韩若当前 FFX GBK 槽位不能无损编码，先验证可行替代方式，不把乱码或静默英文回退当作完成。
- 创建前校验模板，失败后恢复原选层并移除本次摄像机和控制器；一个 Undo Group。
- Mock/构建与 AE 实测分开记录；仅在独立空白测试工程做有副作用的宿主验证。

## Review Focus

- Layer Control 参数的 FFX 序列化、空目标和选层目标需在真实 AE 验证；没有可用模板时不能留半成品。
- 六个折叠组改变属性索引；以实际模板核验身份、数量、类型、默认和表达式访问，不猜索引。
- 摄像机控制器重名、五语言、复制/重命名及多机组并存时，表达式不得错绑其他组。
- 极值、非零合成起点、关键帧和开启/关闭联动不得改变当前公式和旧实例。
- 加载中途故障及 Ctrl 设置菜单不可用时，图层、选择与 Undo 状态应可恢复。

---

### Task 1: Template feasibility and frozen baselines

**Files:** `tests/layerControllerHost.test.js`, `tests/pseudoEffectAssets.test.js`, `docs/testing/camera-controller-ae-test.md`.
**Interfaces:** 读 `public/host/index.jsx` 的现有 `createCameraRig(context, modifier)`，输出 15 项兼容断言与 Layer Control/分组可行性记录。

- [ ] 写旧摄像机创建和四形状 Catalog/FFX 字节保护测试，并运行观察预期新模板契约 RED。
- [ ] 获取可追溯 Layer Control 参数制作源；验证保存/重新加载 FFX 在独立 AE 测试工程中有真实 Layer Control、六组、无目标默认与正确属性索引。若失败，记录证据、修订技术方案，不伪造绿色。
- [ ] 运行相关旧功能基线测试并提交可行性与测试。

### Task 2: Five-locale camera asset contract

**Files:** 新增 `assets/pseudo-effects/camera/` schema/制作源、`scripts/build-camera-pseudo-effects.mjs`、`public/host/pseudo-effects/camera-*.ffx` 与 Catalog 五条摄像机记录；修改 `scripts/dist-contract.mjs`、`tests/pseudoEffectAssets.test.js`。
**Interfaces:** 产出 `camera.rig/v1/<locale>` → `file/matchName/sha256/paramId→propertyIndex`，并显式记录模板定义版本与原生参数类型。

- [ ] 先写 15 项默认值、范围、组序、五语言字符串、哈希、重建一致性与旧资产不变测试，运行确认 RED。
- [ ] 从 Task 1 通过的制作源生成/整理五语言模板和 Catalog；更新构建必备资产，校验重建和冻结基线后运行 GREEN。
- [ ] 提交资产、生成脚本与测试。

### Task 3: Host binding and failure recovery

**Files:** `public/host/index.jsx`, `tests/layerControllerHost.test.js`, `tests/layerCreationHost.test.js`, `docs/testing/camera-controller-ae-test.md`。
**Interfaces:** 摄像机新建先解析并验证 `camera.rig/v1/<locale>`，再创建一组摄像机/控制器，绑定语义 ID；返回现有 Action JSON，不改变前端协议。

- [ ] 写五语言、位置动态初始化、15 项联动/索引、缺模板、错模板、表达式失败、Ctrl 菜单失败清理测试；确认 RED。
- [ ] 实现最小 Host 预检、实例绑定、表达式迁移和回滚；旧图层不迁移，中文旧公式保留；运行 GREEN。
- [ ] 执行跨图层与形状相关回归并提交。

### Task 4: Build, deploy and real AE candidate

**Files:** `docs/testing/camera-controller-ae-test.md` 与必要的构建/安装契约。
**Interfaces:** 构建到隔离输出，候选包与源码及 Catalog/FFX 哈希一致；真实 AE 专项仅在独立测试工程操作。

- [ ] 运行 typecheck、聚焦回归、生产及开发构建、`smoke:dist`、哈希与差异检查；记录确切结果。
- [ ] 在真实 AE 的安全独立工程核验模板实际类型/值、创建、联动、五语言和 Undo/保存重开；未执行的条件明确标待验。
- [ ] 更新验收记录，做整分支审查；提交最终候选。未经用户要求不将未实测项宣称完成。
