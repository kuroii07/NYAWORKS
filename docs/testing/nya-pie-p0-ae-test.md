# Nya Pie P0：真实 After Effects 验收记录

日期：2026-09-28
状态：核心调用链已通过，性能与环境矩阵按用户要求延期验证
测试版本：NYAWORKS `0.1.0-alpha.1` / Nya Pie P0
平台优先级：Windows

## 1. 这份测试验证什么

本测试只验证以下完整调用链：

```text
AE Panel Focus
→ Hotkey
→ Runtime Visible
→ Cursor Position
→ Direction
→ Shortcut KeyUp
→ Host Test Action
→ Runtime Closed
→ AE Focus Restored
```

浏览器页面、自动化测试和构建成功不能替代本记录。

## 2. 安装开发版

在项目工作区运行：

```powershell
npm.cmd install
npm.cmd run setup:cep
npm.cmd run dev:cep
```

CEP 开发目录：

```text
%APPDATA%\Adobe\CEP\extensions\com.kuroii.nyaworks.panel
```

该目录是指向项目 `dev-extension/` 的 junction。

在 After Effects 中确认：

- `窗口 > 扩展` 可打开 `NYAWORKS`；
- `窗口 > 扩展` 可打开 `NYAWORKS · Nya Pie P0`；
- Nya Pie P0 是独立 Modeless 窗口；
- 窗口中只有 A/B/C/D、中心点和诊断文字。

## 3. P0 操作

### 3.1 Runtime 内部链路

1. 在 AE 键盘快捷键编辑器中，为 `NYAWORKS · Nya Pie P0` 分配 `Alt + Space`。
2. 在 AE 任意目标面板按住 `Alt + Space`，确认 Runtime 直接出现。
3. 鼠标移向 A/B/C/D。
4. 检查对应圆形按钮是否高亮。
5. 松开快捷键。
6. 检查测试动作是否返回成功，然后 Runtime 是否关闭。
7. 再次打开，按 `Esc`，检查是否直接关闭且不执行。

### 3.2 AE 快捷键入口

在 AE 的 Keyboard Shortcuts 中查找 `NYAWORKS · Nya Pie P0` 对应菜单命令。

已验证组合：

```text
Alt + Space
```

如果 AE 不允许给该菜单项分配快捷键，记录为 Route A 阻断，不用改成其他未经记录的绕行方式。

如果可以分配：

1. 按住组合键直接打开 Runtime；
2. 不松开组合键，移动鼠标选择方向；
3. 松开组合键；
4. 记录 Runtime 是否收到 KeyUp 并执行；
5. 检查 Runtime 关闭后焦点位置。

## 4. AE 焦点矩阵

每种焦点态单独测试，不用一次连续完成。

| AE 焦点位置 | 快捷键触发 | Runtime 出现 | 鼠标位置正确 | KeyUp 收到 | Action 执行 | 自动关闭 | 焦点恢复 | 打开延迟 ms | 关闭延迟 ms | 备注 |
|---|---|---|---|---|---|---|---|---:|---:|---|
| Composition | 通过 | 通过 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 波动 |  | `Alt + Space` 可直接呼出 |
| Timeline | 通过 | 通过 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 波动 |  | `Alt + Space` 可直接呼出 |
| Project | 通过 | 通过 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 波动 |  | `Alt + Space` 可直接呼出 |
| Effect Controls | 通过 | 通过 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 波动 |  | `Alt + Space` 可直接呼出 |
| NYAWORKS Panel | 通过 | 通过 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 待逐项记录 | 波动 |  | `Alt + Space` 可直接呼出 |

## 5. Windows 环境矩阵

| 场景 | 结果 | 备注 |
|---|---|---|
| 100% DPI | 待测 |  |
| 125% / 150% / 200% 高 DPI | 待测 | 记录系统缩放 |
| 双显示器，同 DPI | 待测 | 记录主副屏 |
| 双显示器，不同 DPI | 待测 | 记录两块屏幕缩放 |
| 鼠标靠近屏幕四边 | 待测 | Runtime 是否越界 |
| 快速连续呼出 10 次 | 待测 | 是否残留窗口或重复执行 |
| Esc Close | 通过 | 不执行 Action，Runtime 直接关闭 |
| AE 最小化 | 待测 | 不应弹出 |
| AE 非前台 | 待测 | 不应误触 |
| 与 AE Shortcut 冲突 | 待测 | 记录冲突命令 |

## 6. 已知能力边界

当前 CEP P0 代码明确不声称具备：

- 系统级 Global Hotkey；
- Runtime 打开前的系统鼠标坐标；
- Modeless 窗口绝对屏幕定位；
- AE 前台进程判断；
- 强制恢复原 AE Panel 焦点。

如果测试确认这些能力缺失，则 Route A / B 不满足完整产品目标，应进入 NyaLauncher 设计阶段。

## 7. 2026-09-28 自动验证结果

已完成：

- `npm.cmd run verify`
- 81 个测试文件通过；
- 307 项测试通过；
- TypeScript 检查通过；
- Vite 双入口生产构建通过；
- `dist/index.html` 与 `dist/nya-pie-runtime.html` 均生成；
- CEP manifest 同时包含主 Panel 与 Nya Pie P0 Modeless Extension；
- dist Smoke 检查通过；
- Playwright 以 `220 × 220` 视口打开 Runtime；
- 指针移动到右侧时正确选择 `right / B`；
- 浏览器 F12 与 Alt+Space KeyUp 均可进入 Action Runner；
- 浏览器无 AE Host 时保持 Runtime 并显示 `Action unavailable: host`；
- Escape 将 Runtime 状态切换为关闭。

浏览器截图：

```text
output/playwright/nya-pie-p0-browser.png
```

这些结果只证明前端、状态机、Action Runner、构建和 CEP 包结构成立，不能证明真实 AE 热键、鼠标位置、窗口定位或焦点恢复。

## 8. 当前技术判断

根据 Adobe CEP 11 公开能力，CEP-only 目前不能覆盖完整产品目标：

- `requestOpenExtension()` 能打开第二 Extension；
- `registerKeyEventsInterest()` 只处理 Extension 自身获得的键盘事件；
- 公开 API 没有系统级 Global Hotkey；
- 公开 API 没有 Runtime 打开前的全局鼠标位置；
- 公开 API 没有 Modeless 窗口绝对屏幕定位；
- 公开 API 没有可靠恢复原 AE Panel 焦点的接口。

真实 AE 测试仍有价值，因为它可以确认 AE 菜单快捷键能否补足“打开 Runtime”，以及 Runtime 是否偶然收到本次 KeyUp。但即使快捷键入口成立，“鼠标附近定位”仍缺少公开 CEP 能力。

当前建议：

```text
先完成本文件的真实 AE Route A / B 测试。
若上述公开能力缺口在实测中仍存在，则进入 NyaLauncher Route C。
```

### 2026-09-28 首次真实 AE 反馈

- 第二 Modeless Extension 会在 AE“窗口 > 扩展”中显示为单独入口，并带独立 Windows 标题栏；
- 它不是最终 Nya Pie 产品形态，而是 Route A 的技术探针；
- 当前结果证明 CEP Modeless 默认呈现方式不符合“无边框、鼠标附近瞬时浮层”的最终体验；
- 首次测试发现方向命中不稳定。原因是 Runtime 在 CEP 应用最终窗口尺寸之前只记录了一次 `window.innerWidth / innerHeight` 中心，后续窗口尺寸变化会让鼠标坐标和中心坐标不在同一个几何状态；
- 已改为每次 PointerMove 使用当前 Runtime `getBoundingClientRect()` 实时计算中心，避免启动尺寸、DPI 和标题栏布局导致的 A/B/C/D 错算。
- 修复后 A/B/C/D 四个方向均可正常高亮；
- 首次 F12 松开测试未关闭 Runtime。检查发现界面约定使用单独 `F12`，但 CEP Key Interest 实际注册成了 `Ctrl + Alt + Shift + F12`；
- 已改为注册 Windows `VK_F12 / keyCode 123`，并让前端同时兼容 `event.key`、`event.code` 和旧 CEP Chromium 的 `event.keyCode`；
- 真实 AE 复测确认：先按住单独 `F12`，再从 `窗口 > 扩展 > NYAWORKS · Nya Pie P0` 手动打开 Runtime；移动到 A/B/C/D 后松开 `F12`，测试 Action 成功执行并自动关闭 Runtime；
- AE 快捷键编辑器可以搜索到 `NYAWORKS · Nya Pie P0` 扩展菜单命令；用户已成功分配 `Alt + Space`；
- 真实 AE 确认：在 AE 中直接按下 `Alt + Space` 可以呼出 Runtime，不需要再从“窗口 > 扩展”手动打开；
- P0 Runtime 已改为监听 `Alt + Space` 的 Space/Alt KeyUp，同时保留 F12 兼容；
- 真实 AE 复测确认：`Alt + Space` 直接呼出、鼠标方向选择、松开快捷键执行测试 Action、Runtime 自动关闭均正常；
- Composition、Timeline、Project、Effect Controls、NYAWORKS Panel 五种焦点下均可用 `Alt + Space` 直接呼出 Runtime；
- 呼出延迟存在明显波动：有时顺畅，有时会短暂卡顿。尚未量化，也尚未确认延迟发生在 AE/CEP Modeless 窗口创建阶段还是 Runtime 页面加载阶段；
- 用户当前暂无时间继续性能与环境矩阵测试；快速连续呼出、冷启动延迟、DPI、双显示器和屏幕边缘测试延期，不作为后续代码开发的阻断项，但发布前必须补测；
- 真实 AE 复测确认：`Esc` 可以直接关闭 Runtime，且不需要执行测试 Action；
- Runtime 关闭后，键盘输入可以继续由 AE 响应，当前测试场景的焦点自然返回已通过；
- 当前测试场景已完整通过 `Hotkey Open → Direction → KeyUp → Action Runner → AE Host → Runtime Close → AE Focus`；
- Composition、Timeline、Project、Effect Controls、NYAWORKS Panel 五种焦点均已确认可以直接呼出。各面板完整链路的逐项记录、呼出延迟、DPI 和多显示器环境矩阵按用户要求延期验证。

## 9. 结论模板

### CEP-only 足够

只有五种焦点场景与环境矩阵核心项都完成完整链路后填写：

```text
Route A/B 通过。CEP-only 可以继续进入 Nya Pie P1。
```

### CEP-only 不足

只要关键链路缺少任一项，填写：

```text
Route A/B 未通过。
缺失能力：
- ...

复现步骤：
1. ...
2. ...

建议进入 Route C，只让 NyaLauncher 补齐 Hotkey、KeyUp、Cursor、Foreground 和 Window Position。
```
