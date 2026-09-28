# NyaLauncher P1 Design Spec

日期：2026-09-28
状态：待用户审阅
平台：Windows / After Effects 2022–2026
范围：只补齐 Nya Pie Runtime 的原生 Launcher 能力，不开发正式 Pie UI 或 Pie Editor

## 1. 背景与结论

Nya Pie P0 已在真实 After Effects 2025 中确认：

- AE Keyboard Shortcuts 可以为 `NYAWORKS · Nya Pie P0` 分配 `Alt + Space`；
- Composition、Timeline、Project、Effect Controls、NYAWORKS Panel 均可直接呼出 Runtime；
- Runtime 可以识别四方向；
- 松开快捷键可以执行共享 Action Runner 中的 Host 测试动作；
- Runtime 可以自动关闭；
- `Esc` 可以取消；
- 关闭后 AE 可以继续响应键盘输入。

CEP-only 仍缺少最终产品需要的能力：

- Runtime 打开前取得全局鼠标坐标；
- 将 Modeless CEP 窗口定位到鼠标附近；
- 去掉 Windows 标题栏和系统边框；
- 判断 AE 是否为前台应用；
- 量化 Hotkey 到 Runtime 可见之间的延迟；
- 对多显示器和 DPI 坐标进行可靠约束。

因此 P1 引入一个严格受限的 Windows 原生辅助进程 `NyaLauncher`。

## 2. P1 目标

P1 只验证下面的完整链路：

```text
AE 在前台
→ Alt + Space KeyDown
→ NyaLauncher 观察按键但不吞键
→ 记录 GetCursorPos
→ AE 自身快捷键打开 CEP Runtime
→ NyaLauncher 发现 Runtime HWND
→ 去除标题栏并定位到鼠标附近
→ CEP Runtime 继续负责方向选择
→ Shortcut KeyUp
→ CEP Action Runner 执行 Host Action
→ CEP Runtime 关
→ 焦点返回 AE
```

P1 不替换已经验证通过的 AE 快捷键入口。

## 3. 职责边界

### 3.1 NyaLauncher 允许负责

- 低级键盘 Hook，观察固定的 P1 测试组合 `Alt + Space`；
- 判断当前前台窗口是否属于 `AfterFX.exe`；
- 在 KeyDown 时调用 `GetCursorPos`；
- 监听和查找 Nya Pie CEP Runtime 的顶层窗口；
- 移除 Runtime 的标题栏、系统菜单和可调整边框；
- 将 Runtime 定位到鼠标附近；
- 将窗口限制在当前显示器工作区内；
- 记录 KeyDown、窗口发现、定位完成和 KeyUp 时间；
- 保证单实例运行；
- 输出本地诊断日志。

### 3.2 NyaLauncher 禁止负责

- Action Registry；
- Context Engine；
- Action Runner；
- After Effects 工具逻辑；
- ExtendScript；
- Pie 槽位、Profile 或布局配置；
- Pie UI、主题、语言和图标；
- AI、资源、首页或设置功能；
- 本地 HTTP、WebSocket 或开放端口；
- 键盘输入注入；
- DLL 注入或修改 AE 进程内存；
- 管理员权限；
- 开机启动、自动更新或安装器。

## 4. 推荐实现

### 4.1 技术栈

- C#；
- `.NET 10` Windows Desktop；
- `net10.0-windows`；
- WinExe；
- WinForms `ApplicationContext` 提供隐藏消息循环；
- Win32 P/Invoke 提供键盘、窗口、鼠标和显示器能力；
- Release 使用 `win-x64` self-contained single-file 发布。

选择 WinForms 只为了稳定的 Windows 消息循环。P1 不创建设置窗口、托盘菜单或产品 UI。

### 4.2 仓库结构

```text
native/
  NyaLauncher/
    NyaLauncher.sln
    src/
      NyaLauncher/
        NyaLauncher.csproj
        Program.cs
        LauncherApplicationContext.cs
        Interop/
          NativeMethods.cs
          NativeConstants.cs
          NativeStructs.cs
        Input/
          KeyboardHook.cs
          ShortcutStateMachine.cs
        Ae/
          AeForegroundGuard.cs
        Runtime/
          RuntimeWindowDetector.cs
          RuntimeWindowStyler.cs
          RuntimeWindowPositioner.cs
        Diagnostics/
          LaunchTrace.cs
          LauncherLog.cs
    tests/
      NyaLauncher.Tests/
        NyaLauncher.Tests.csproj
        ShortcutStateMachineTests.cs
        WindowPositionerTests.cs
        AeForegroundGuardTests.cs
scripts/
  bootstrap-nya-launcher-sdk.ps1
  build-nya-launcher.ps1
  test-nya-launcher.ps1
```

SDK 安装到被 Git 忽略的本地工作目录，不修改系统 PATH，不要求安装 Visual Studio。

## 5. 输入与状态机

### 5.1 P1 快捷键

P1 固定观察：

```text
Alt + Space
```

Launcher 使用 `WH_KEYBOARD_LL` 观察事件，但回调必须继续调用 `CallNextHookEx`，不得吞掉按键。

原因：

- AE 已经可以用该快捷键打开 CEP Runtime；
- 如果 Launcher 使用 `RegisterHotKey` 独占组合键，AE 将无法收到并执行扩展菜单命令；
- P1 暂时不引入输入模拟或 IPC 来替代 AE 快捷键入口。

### 5.2 状态

```text
Idle
→ Armed
→ WaitingForRuntime
→ RuntimePositioned
→ Released
→ Idle
```

- `Idle`：等待快捷键；
- `Armed`：确认 AE 在前台并捕获鼠标坐标；
- `WaitingForRuntime`：等待 CEP Runtime 顶层窗口出现；
- `RuntimePositioned`：窗口已去边框并定位；
- `Released`：记录 KeyUp，不执行 Action；
- 超时、AE 失焦或 Esc 后回到 `Idle`。

重复 KeyDown 不得重复启动定位任务。

## 6. AE 前台判断

判断顺序：

1. `GetForegroundWindow()`；
2. `GetWindowThreadProcessId()`；
3. 获取进程；
4. 进程名必须为 `AfterFX`；
5. 进程必须仍在运行。

当 AE 不是前台程序时：

- 不捕获本次鼠标位置；
- 不搜索或修改任何窗口；
- 只记录被忽略的诊断事件。

P1 不依赖 AE 中文或英文界面标题。

## 7. Runtime 窗口发现

### 7.1 识别条件

候选窗口必须同时满足：

- 是可见顶层窗口；
- 标题精确匹配 P1 Runtime 标记；
- 进程属于 AE 启动的 CEP Runtime 进程；
- 出现在本次 KeyDown 后的限定时间窗口内。

P1 Runtime 使用唯一标题：

```text
NYAWORKS_NYA_PIE_RUNTIME_P1
```

标题只用于原生窗口识别。标题栏被移除后用户不可见。

### 7.2 发现方式

主路径：

- `SetWinEventHook(EVENT_OBJECT_SHOW)` 监听顶层窗口显示；
- 命中后立即校验并处理。

兜底路径：

- KeyDown 后在限定时间内使用 `EnumWindows` 查找；
- 仅处理第一次满足全部条件的窗口；
- 默认超时 1500ms；
- 不无限轮询。

## 8. 无边框处理

使用 `GetWindowLongPtr` / `SetWindowLongPtr` 修改窗口样式：

- 移除 `WS_CAPTION`；
- 移除 `WS_THICKFRAME`；
- 移除 `WS_MINIMIZEBOX`；
- 移除 `WS_MAXIMIZEBOX`；
- 移除 `WS_SYSMENU`；
- 增加 `WS_EX_TOOLWINDOW`；
- 保留 CEP Runtime 的内容和事件处理。

样式修改后调用 `SetWindowPos` 并包含 `SWP_FRAMECHANGED`。

P1 不创建新的原生 Pie 界面，也不嵌入 WebView。

## 9. 窗口定位

### 9.1 目标位置

默认 Runtime 内容尺寸继续使用：

```text
220 × 220
```

目标为：

- 鼠标位置对应 Runtime 中心点；
- 窗口不得超出当前显示器工作区；
- 靠近边缘时只做必要的 X/Y 偏移；
- 不改变 Runtime 内部方向计算使用的客户区中心。

### 9.2 坐标与 DPI

- Launcher 启动时设置 Per-Monitor V2 DPI Awareness；
- `GetCursorPos` 使用屏幕坐标；
- `MonitorFromPoint` 确定目标显示器；
- `GetMonitorInfo` 获取工作区；
- 定位算法为纯函数，必须有单元测试；
- P1 人工验收覆盖 100%、125%、150%、200% 缩放及混合 DPI 双屏。

## 10. 焦点与 Z-Order

定位时使用 `SetWindowPos`：

- 允许 Runtime 保持在 AE 上方；
- Launcher 自身不得激活；
- 不主动调用 `SetForegroundWindow` 抢焦点；
- 不激活 Launcher 的隐藏消息窗口；
- Runtime 关闭后仍由现有 CEP 行为恢复 AE 焦点。

需要分别验证：

- `SWP_NOACTIVATE` 是否影响 Runtime 收到 KeyUp；
- `HWND_TOPMOST` 是否在 Runtime 关闭后残留；
- AE 切到后台时 Runtime 是否应立即关闭或保持不出现。

## 11. 诊断日志

日志目录：

```text
%LOCALAPPDATA%\NYAWORKS\logs\nya-launcher-p1.log
```

每次调用记录：

- Launcher 版本；
- AE PID；
- 前台窗口 HWND；
- KeyDown 时间；
- 鼠标屏幕坐标；
- 目标显示器工作区；
- Runtime HWND；
- Runtime 发现耗时；
- 样式修改结果；
- 定位耗时；
- KeyUp 时间；
- 超时或 Win32 错误码。

日志不得记录项目路径、用户内容、Action 数据或 API Key。

## 12. 容错与降级

- Launcher 未运行：保留当前 CEP Modeless P0 行为；
- AE 不在前台：忽略；
- Runtime 未找到：1500ms 后回到 `Idle`；
- Runtime 样式修改失败：不继续修改其他窗口；
- Runtime 定位失败：保留原窗口位置；
- Hook 安装失败：写日志后退出；
- Launcher 已运行：第二实例立即退出；
- 任意异常不得导致 AE 退出或卡死。

## 13. 自动测试

不调用真实 Win32 的纯逻辑测试：

- 快捷键状态机；
- 重复 KeyDown；
- KeyUp 清理；
- AE 前台判断结果映射；
- Runtime 发现超时；
- 窗口中心定位；
- 四边和四角 Clamp；
- 不同工作区原点；
- 负坐标副屏；
- 混合 DPI 输入数据；
- 日志字段脱敏。

Windows 集成测试：

- Hook 安装/卸载；
- 创建测试窗口并去除边框；
- 测试窗口定位；
- 单实例 Mutex；
- Release 自包含构建。

自动测试不能替代真实 AE 宿主验收。

## 14. P1 真实 AE 验收

分别在以下焦点场景测试：

- Composition；
- Timeline；
- Project；
- Effect Controls；
- NYAWORKS Panel。

每项验证：

1. `Alt + Space` 可以继续由 AE 打开 CEP Runtime；
2. Launcher 不吞键；
3. Runtime 出现在按键瞬间的鼠标附近；
4. 标题栏和系统边框不可见；
5. A/B/C/D 方向正确；
6. 松开快捷键执行 Action；
7. Runtime 关闭；
8. AE 焦点恢复；
9. 日志包含完整时间点；
10. Launcher 退出后自动降级为原 CEP Runtime。

环境矩阵：

- 单显示器 100%；
- 125%、150%、200%；
- 双显示器同 DPI；
- 双显示器混合 DPI；
- 负坐标副屏；
- 鼠标靠近四边和四角；
- 连续呼出 10 次；
- AE 最小化；
- AE 非前台；
- Launcher 重启；
- Runtime 发现超时。

## 15. P1 成功标准

P1 只有同时满足以下条件才通过：

- 五种 AE Panel Focus 下均保持现有调用链；
- Runtime 中心与捕获鼠标位置一致，边缘场景按工作区 Clamp；
- 用户看不到 Windows 标题栏；
- Launcher 不吞键、不执行 Action、不承载 UI；
- 松开快捷键仍由 CEP Runtime 执行共享 Action Runner；
- Launcher 不抢 AE 焦点；
- AE 非前台时不处理；
- 连续调用无残留窗口和重复状态；
- 日志可区分 AE 打开延迟与 Launcher 定位延迟。

## 16. 明确不做

P1 不开发：

- 正式 Nya Pie 视觉；
- Pie Editor；
- Profile；
- Context Aware Pie；
- Command Palette；
- 设置页；
- 快捷键自定义；
- macOS Launcher；
- 安装器；
- 自动更新；
- 商业授权；
- Native Action Registry；
- Native AE 工具逻辑。

## 17. 风险与后续决策

### 风险 A：CEP 窗口首次显示时出现标题栏闪烁

先使用 WinEvent Hook 尽早修改。如果仍有明显闪烁，记录为 P1 失败，不用动画掩盖。

### 风险 B：CEP Runtime HWND 无法稳定识别

先使用唯一标题、进程和时间窗口联合校验。若仍不可靠，再单独设计最小 IPC；P1 不提前加入本地服务。

### 风险 C：去边框后 KeyUp 或焦点行为变化

保留原始样式用于诊断，逐项比较样式修改前后行为。不得通过让 Launcher 执行 Action 绕过 CEP。

### 风险 D：AE 快捷键依赖

P1 继续依赖 AE 已分配的 `Alt + Space`。等 P1 证明窗口能力后，再决定是否需要 Launcher 自主管理可配置全局快捷键。

## 18. 实施前置条件

- 当前机器缺少 .NET SDK；
- 使用仓库本地 bootstrap 安装 .NET 10 SDK；
- SDK、NuGet 缓存和构建产物必须位于 Git 忽略目录；
- 不修改系统 PATH；
- 不安装 Visual Studio；
- 不要求管理员权限。
