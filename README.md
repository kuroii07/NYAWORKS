<p align="center">
  <img src="public/assets/brand/nyaworks-cat-final.svg" width="88" alt="NYAWORKS logo">
</p>

<h1 align="center">NYAWORKS / 喵创</h1>

<p align="center">为 Adobe After Effects 打造的高频创作工具合集。</p>

> 当前版本：`0.1.0-alpha.1` · 开发预览；本 README 不提供面向普通用户的正式安装入口。

## 现在可以做什么

NYAWORKS 是一个 CEP 面板：首页和全局搜索共享工具执行链，资源库可调用本地 AE 脚本、预设与表达式。面板提供五套主题、五种语言，以及可编辑的首页布局。Nya Pie 仍处于技术验证阶段，不是已发布的功能。

| 功能 | 当前范围 | 验证状态 |
| --- | --- | --- |
| 锚点九宫格 | 单选、多选分别调整各图层锚点并补偿画面位置。 | 基础场景有真实 AE 测试反馈；带关键帧/表达式的目标属性不做高级改写。[检查表](docs/testing/anchor-action-ae-test.md) |
| 对齐九宫格 | 单选默认对齐合成，多选默认对齐联合选区；多选 Alt/Option 或 Shift 强制合成。支持 2D/3D 路径与三个文字段落动作。 | 用户已测试常用 2D/3D、父子级及段落场景；完整逐项记录仍待补。[检查表](docs/testing/alignment-action-ae-test.md) |
| 新建图层九宫格 | 文字、纯色、形状、调整层、空对象、摄像机控制器、灯光、预合成、解预合成九个 Action。 | 代码及自动化已覆盖，文字等部分场景经过 AE 测试；九项完整宿主验收尚未结束。[检查表](docs/testing/layer-creation-grid-ae-test.md) |
| 圆角矩形伪效果 | 普通点击新建圆角矩形使用 `rounded-rectangle-zh-CN.ffx`；总圆角与四角均为 0–100。 | 用户在 Windows AE 2025 测试了新建和圆角操作；改名后的文件、关键帧、保存重开及其他 AE/系统版本仍待复验。[记录](docs/testing/rounded-rectangle-pseudo-effect-ae-test.md) |
| 本地资源库 | 浏览当前 AE 内置来源及自定义目录；双击执行脚本、预设、表达式，支持筛选、收藏和最近使用。 | 相关目录扫描与执行路径有真实 AE 测试反馈，完整矩阵见[检查表](docs/testing/resource-command-ae-test.md)。 |

详细的首页、搜索、设置、资源命令和实验能力见[当前功能清单](docs/current-feature-inventory.md)。选择九宫格的宿主功能、云端资源目录、AI 平台正式联网以及正式 Nya Pie UI 均未完成，不应视为可用功能。

## 开发者快速开始

在 Windows 和项目根目录执行：

```powershell
npm ci
npm run setup:cep
npm run dev:cep
```

`setup:cep` 会将 `%APPDATA%\Adobe\CEP\extensions\com.kuroii.nyaworks.panel` 链接到本项目的 `dev-extension/`；如该位置已有真实文件夹，脚本会拒绝覆盖。`dev:cep` 持续构建开发扩展。前端改动可在 AE 面板内刷新；Host JSX 改动建议关闭并重开面板，manifest 或 CEP 权限改动需要重启 AE。完整步骤与浏览器预览区别见[CEP 开发模式](docs/testing/cep-development-mode.md)。

本地验证与生产构建：

```powershell
npm run verify
```

`verify` 会执行类型检查、自动化测试、生产构建与 `dist` 冒烟检查；这些结果不等于真实 AE 宿主验收。`dist/` 是构建产物，不是当前公开的正式安装包。日常功能只在同一个 NYAWORKS 开发扩展内测试，不为每项功能单独打包。

## 兼容与发布边界

当前有 Windows AE 2025 的局部宿主验证；其他 AE 版本、macOS、不同语言环境及复杂工程仍需按功能分别验证。CEP manifest 的宿主版本范围不代表所有版本都已经通过测试。重要工程请先使用副本测试，尤其是伪效果、预合成与解预合成。已创建的旧图层不会因扩展更新而自动迁移。

## 文档导航

- [当前功能与验证边界](docs/current-feature-inventory.md)：比首页更细的模块清单及状态。
- [核心工具优先路线](planning/05-core-tools-priority-roadmap.md)与[开发路线](planning/02-roadmap.md)：下一步工作及待验收项目。
- [伪效果系统设计](docs/superpowers/specs/2026-10-08-pseudo-effect-system-design.md)：模板身份、生成、加载和兼容规则。
- [CEP 开发模式](docs/testing/cep-development-mode.md)：开发链接、刷新和构建。

项目源码位于 `src/`（React 面板）与 `public/host/`（AE ExtendScript）；`public/CSXS/` 为扩展清单，`tests/` 为自动化测试，`docs/` 为设计和 AE 验收记录。`release/` 的已有目录仅作为历史阶段快照，不代表当前正式发布。
