# NyaLauncher P1 Windows / AE 验收记录

日期：2026-09-28
状态：Windows P1 候选版；自动化验证完成，真实 AE 宿主验收待执行
范围：只验证 Nya Pie Runtime 的快捷键观察、鼠标坐标、窗口识别、去边框、定位和诊断链路

## 1. 候选文件

运行构建：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-nya-launcher.ps1
```

输出：

```text
outputs/nya-launcher-p1/NyaLauncher.exe
```

该目录被 Git 忽略，换电脑后需要重新运行构建脚本。P1 没有安装器、托盘图标、设置窗口或自动启动。

## 2. 已自动验证

### C# 单元测试

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-nya-launcher.ps1
```

覆盖：

- `Alt + Space` 状态机和重复 KeyDown；
- AE 前台进程判断；
- 鼠标中心定位、四边/四角 Clamp、负坐标副屏；
- CEP Runtime 标题、进程树和唯一候选校验；
- 窗口样式修改及 `SWP_NOACTIVATE`；
- Keyboard Hook 安装、透传和卸载；
- WinEvent + 25ms 轮询兜底；
- 1500ms 超时；
- 单实例；
- JSONL 诊断日志和敏感字段边界；
- ApplicationContext 编排不包含 Action 执行。

### Windows 测试窗口集成

自动测试会创建本进程拥有的临时 WinForms 窗口，并验证：

- 标题栏、粗边框、系统菜单、最小化和最大化样式被移除；
- `WS_EX_TOOLWINDOW` 被加入；
- 窗口移动到计算后的 220 × 220 位置；
- 只允许修改测试窗口自身的 HWND；
- 测试结束后关闭测试窗口。

这项测试不启动 After Effects，也不能替代真实 CEP Runtime 验收。

### CEP / 构建检查

- Runtime 启动时请求唯一标题 `NYAWORKS_NYA_PIE_RUNTIME_P1`；
- 浏览器环境没有 CEP API 时安全返回；
- 主面板和 Nya Pie Runtime 两个 CEP 入口继续参与构建与 smoke；
- Native 源码不包含 WebView2、本地网络服务、输入模拟或 Action Registry。

## 3. 真实 AE 测试准备

1. 按现有开发模式安装或更新 NYAWORKS CEP：

   ```powershell
   npm.cmd run setup:cep
   npm.cmd run build
   ```

2. 在 AE Keyboard Shortcuts 中确认 `NYAWORKS · Nya Pie P0` 为 `Alt + Space`。
3. 启动：

   ```powershell
   .\outputs\nya-launcher-p1\NyaLauncher.exe
   ```

4. 打开 NYAWORKS 主面板。P1 Launcher 本身不会显示窗口或托盘图标。
5. 日志位置：

   ```text
   %LOCALAPPDATA%\NYAWORKS\logs\nya-launcher-p1.log
   ```

## 4. 五个 AE Focus 场景

依次让以下面板获得焦点：

- Composition
- Timeline
- Project
- Effect Controls
- NYAWORKS Panel

每项执行：

1. 把鼠标放在面板内一个容易识别的位置；
2. 按住 `Alt + Space`；
3. 确认 Runtime 出现在鼠标附近且无 Windows 标题栏；
4. 移动鼠标到 A / B / C / D；
5. 松开快捷键；
6. 确认 Host 测试 Action 执行；
7. 确认 Runtime 关闭；
8. 确认键盘焦点自然回到 AE。

记录：

| Focus | 可呼出 | 鼠标附近 | 无边框 | KeyUp | Action | 关闭 | 焦点恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Composition | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |
| Timeline | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |
| Project | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |
| Effect Controls | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |
| NYAWORKS Panel | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 | 待测 |

## 5. Windows 环境矩阵

以下项目必须人工测试，当前不能由浏览器或普通单元测试替代：

- 100%、125%、150%、200% DPI；
- 双显示器同 DPI；
- 双显示器混合 DPI；
- 左侧或上方负坐标副屏；
- 鼠标靠近四边和四角；
- 快速连续呼出 10 次；
- `Esc` 关闭；
- AE 最小化时不触发；
- AE 不在前台时不触发；
- Launcher 退出后退回原 CEP Runtime 行为；
- Runtime 首次出现是否有标题栏闪烁；
- 呼出和定位延迟是否稳定。

## 6. 当前已知限制

- Windows P1 only，尚未设计 macOS Launcher；
- 仍依赖 AE 为菜单命令分配 `Alt + Space`；
- Launcher 只观察按键，不吞键，也不模拟输入；
- Launcher 必须手动启动；
- 没有安装器、自动更新、托盘控制或快捷键设置；
- 还没有真实 AE 中的 DPI、双屏、焦点和闪烁结论；
- 若 Runtime 唯一标题在真实 CEP 中无法稳定映射到目标 HWND，P1 将记录失败并重新评估最小 IPC，不会把 Pie UI 或 Action 逻辑迁入 Native。

## 7. 通过标准

只有五个 AE Focus 场景均完成：

```text
Alt + Space
→ 捕获鼠标
→ Runtime 无边框显示在鼠标附近
→ 方向选择
→ KeyUp
→ CEP Action Runner 执行
→ Runtime 关闭
→ AE 焦点恢复
```

并通过 Windows 环境矩阵后，NyaLauncher P1 才能判定通过。
