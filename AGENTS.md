# NYAWORKS 项目约束

## 项目定位

- 路径：`D:\AIGC\codex\Projects\AE脚本扩展开发\NYAWORKS`
- 类型：Adobe After Effects CEP 扩展
- 产品名：`NYAWORKS / 喵创`
- 当前阶段：M0 工程初始化与主题系统
- GitHub：`https://github.com/kuroii07/NYAWORKS.git`

## 技术边界

- 面板 UI 使用 React 18、TypeScript、Vite。
- AE 宿主调用统一放在 `public/host/` 或后续 `src/host/` 适配层，禁止散落在 React 组件中。
- CEP 清单位于 `public/CSXS/manifest.xml`，生产构建必须复制到 `dist/CSXS/manifest.xml`。
- 所有资源使用相对路径，确保 CEP 的 `file://` 环境可加载。
- 不在前端启用 Node.js 直连；需要本地能力时通过受控 CEP/ExtendScript 桥接。

## 产品约束

- 只提供五套暗色主题，不做白色亮色模式。
- 默认主题为“极夜青”。
- 主题顺序固定：极夜青、星云紫、熔金琥珀、翡翠深海、樱夜绯粉。
- 语言规划：简体中文、繁体中文、English、日本語、한국어。
- 语言按钮左键只切换简体中文与 English；右键选择全部语言。繁体、日语、韩语状态分别显示 `繁`、`あ`、`한`。
- 右上角保留主题、语言、设置入口。
- 设置页及后续功能页的选择型下拉菜单统一复用 `src/components/SettingSelect.tsx`，禁止直接使用会显示 Windows 原生弹层的 `<select>`；展开浮层必须与触发框同宽并保持左右边界对齐。
- 左侧导航页：主页、AI、项目、合成、图层、动画、文字、图形、效果、媒体。
- 未开始的功能必须明确显示占位状态，禁止伪造为已完成。
- 调色盘图标禁用；主题入口使用三圆点/轨道式图标。

## 开发顺序

1. 主题系统。
2. 语言系统。
3. 首页。
4. 各功能页与 AE 宿主功能。

每次只完成一个可验证增量。完成后更新 README 和 `planning/02-roadmap.md`，验证通过后再询问是否提交并推送 GitHub。

## 验证要求

- `npm.cmd run typecheck`
- `npm.cmd run test`
- `npm.cmd run build`
- `npm.cmd run verify`
- 浏览器视觉检查只能证明 UI 渲染，不等同于 AE 宿主验收。
- CEP/AE 功能完成后必须单独记录 AE 版本、安装路径和宿主实测结果。
