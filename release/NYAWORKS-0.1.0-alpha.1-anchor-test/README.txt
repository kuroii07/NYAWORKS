NYAWORKS 0.1.0-alpha.1 - 锚点九宫格 AE 测试构建

这是本地 CEP 测试目录，不是正式安装包。

安装：
1. 关闭 After Effects。
2. 将本文件夹复制到 CEP 扩展目录。
3. 开启 CEP 调试模式并重新启动 AE。
4. 在“窗口 / 扩展”中打开 NYAWORKS。

扩展 ID：com.kuroii.nyaworks.panel

当前可测试：
- 选中普通 2D 图层后使用锚点九宫格。
- 选中开启三维开关的普通 3D 图层后使用锚点九宫格。
- 多选图层和 Undo 撤销。

当前不处理：
- 摄像机、灯光；
- Anchor Point / Position 表达式或关键帧；
- 分离维度 Position；
- 复杂父子层级无法完成稳定补偿的场景。

浏览器地址 http://127.0.0.1:5175/ 不能替代 AE 宿主测试。
