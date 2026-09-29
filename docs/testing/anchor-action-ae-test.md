# 锚点 Action 架构 AE 验收说明

日期：2026-09-29

## 候选包

`release/NYAWORKS-0.1.0-alpha.1-anchor-action-test/`

这是本地候选测试包，不是正式安装包或 GitHub Release。旧版直连 Bridge 测试包
`release/NYAWORKS-0.1.0-alpha.1-anchor-test/` 保留不覆盖。

## 安装

1. 关闭 After Effects。
2. 将整个 `NYAWORKS-0.1.0-alpha.1-anchor-action-test` 文件夹复制到 CEP 扩展目录。
3. 在 Windows 注册表中启用 CEP 调试模式后重新打开 AE。
4. 在“窗口 / 扩展”中打开 `NYAWORKS`。

扩展 ID：`com.kuroii.nyaworks.panel`

## 本次验证目标

- 首页九宫格与全局搜索使用同一个 Action Service。
- 每次 Action 执行前读取当前活动合成与选中图层数量。
- Context 只做前置可用性判断，Host JSX 继续二次检查。
- 九个锚点位置均由固定 Action ID 和固定 Host 命令执行。
- 成功保持静默，失败使用当前语言的已有锚点提示。
- 每批修改使用一个 AE Undo Group。

## AE 验收步骤

1. 未打开合成时点击首页锚点按钮，确认显示失败提示且项目不被修改。
2. 打开合成但不选图层，确认提示先选择图层且不会创建撤销记录。
3. 2D 固态层：验证左上、中心、右下。
4. 文字层与形状层：确认按内容边界计算。
5. 普通 3D 图层：确认 X/Y 锚点生效，Z Anchor 与 Z Position 保持。
6. 多选 2D/3D 图层：确认一次操作批量执行。
7. 父级、旋转和缩放图层：确认视觉位置不跳动。
8. 锁定图层、摄像机/灯光、关键帧和表达式场景：确认显示对应失败提示。
9. 使用 Ctrl/Cmd+Z：确认一次撤销恢复整批图层。
10. 使用 `Ctrl/⌘ + K` 搜索“锚点 左上”及当前界面语言对应词，确认执行结果与首页一致。
11. 浏览器预览中执行首页或搜索锚点 Action，确认只显示未连接提示，不误报成功。

## 结果记录

- AE 版本：
- 操作系统：
- 安装路径：
- 首页九宫格：
- 全局搜索：
- 2D / 3D / 多选：
- 父级 / 旋转 / 缩放：
- 锁定 / 不支持图层：
- 关键帧 / 表达式：
- Undo：
- 结论：

自动化测试、浏览器预览、TypeScript 构建和 dist 冒烟检查不能替代以上真实 AE 宿主验收。
