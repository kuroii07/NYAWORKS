# CEP 开发模式

NYAWORKS 提供一个固定扩展目录的 Windows 开发模式。首次配置后，源码会持续构建到项目内的 `dev-extension/`，CEP 扩展目录通过 junction 指向它，因此不需要每次手动复制新目录。

## 首次配置

在项目根目录执行：

```powershell
npm run setup:cep
```

默认会建立：

```text
%APPDATA%\Adobe\CEP\extensions\com.kuroii.nyaworks.panel
  -> <项目>\dev-extension
```

如果目标路径已经是真实文件夹，脚本会拒绝覆盖；先手动移动或备份该文件夹，再重新执行配置。也可以通过 `NYAWORKS_CEP_EXTENSIONS_DIR` 指定其他 CEP 扩展根目录，通过 `NYAWORKS_CEP_DEV_OUT_DIR` 指定其他开发输出目录。

## 日常开发

执行：

```powershell
pnpm run dev:cep
```

该命令会先确认 junction，再启动 `vite build --watch`。修改 React、CSS、翻译或其他前端源码后，Vite 会自动更新 `dev-extension/`；在 AE 面板中点击开发构建专用的刷新按钮即可加载最新前端代码，不需要重启 AE。

开发脚本会优先使用 pnpm；如果本机只有 npm，也可以执行 `npm run dev:cep`。

Host JSX 的修改同样会被复制到开发输出，但为了让宿主重新读取脚本，建议关闭并重新打开 NYAWORKS 面板。修改 `CSXS/manifest.xml`、扩展 ID 或 CEP 权限时，仍需要重启 AE。

## 与浏览器预览的区别

- `npm run dev` 和 `http://127.0.0.1:5175/` 只适合验证浏览器 UI。
- `pnpm run dev:cep` 使用真实 CEP 扩展目录，适合在 AE 中验证 Host 调用和面板行为。
- 浏览器测试、构建测试通过，不等于真实 AE 版本、图层状态和宿主权限已经验收。

## 停止与正式构建

在运行 `dev:cep` 的终端按 `Ctrl+C` 停止 watch。正式构建仍使用：

```powershell
npm run build
```

正式构建输出到 `dist/`，不会显示开发刷新按钮，也不会把 `dev-extension/` 纳入 Git。
