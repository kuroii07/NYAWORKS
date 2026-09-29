NYAWORKS 0.1.0-alpha.1 - 锚点 Action 架构 AE 候选测试包

生成日期：2026-09-29

这是本地 CEP 测试目录，不是正式安装包或 GitHub Release。

安装：
1. 关闭 After Effects。
2. 将本文件夹复制到 CEP 扩展目录。
3. 开启 CEP 调试模式并重新启动 AE。
4. 在“窗口 / 扩展”中打开 NYAWORKS。

扩展 ID：com.kuroii.nyaworks.panel

本次重点：
- 首页九宫格通过共享 Action Service 执行锚点动作。
- Ctrl/Command + K 可按五语言名称和方向搜索九个锚点 Action。
- 每次执行前读取当前活动合成和选中图层数量。
- Host JSX 仍会二次检查，并通过一个 Undo Group 修改图层。

请按仓库 docs/testing/anchor-action-ae-test.md 记录真实 AE 验收结果。

自动化、浏览器预览、TypeScript 构建和 dist 冒烟通过，不代表真实 AE 宿主验收通过。
