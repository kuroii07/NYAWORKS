import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DensityProvider } from "../src/density/DensityProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { HomeSettingsPanel } from "../src/pages/HomeSettingsPanel";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";

describe("HomeSettingsPanel", () => {
  it("renders the compact layout selector instead of count controls", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsProvider>
            <DensityProvider>
              <HomeSettingsPanel initialEditing />
            </DensityProvider>
          </SettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    );

    expect(markup).toContain('aria-label="当前布局"');
    expect(markup).toContain('aria-label="新建布局"');
    expect(markup).toContain('aria-label="布局操作"');
    expect(markup).toContain("<strong>内置布局</strong>");
    expect(markup).not.toContain('role="dialog"');
    expect(markup).not.toContain("固定工具数量");
    expect(markup).not.toContain("自定义快捷位");
    expect(markup).toContain("首页工具组");
    expect(markup).toContain("合成与项目");
    expect(markup).toContain("九宫格默认状态");
    expect(markup).toContain("记住上次模式");
    expect(markup).toContain("新建 / 选择");
    expect(markup).toContain("锚点 / 对齐");
    expect(markup.match(/data-count="2"/g)).toHaveLength(2);
    expect(markup).toContain("导入布局");
    expect(markup).toContain("导出布局");
    expect(markup).toContain("恢复默认");
    expect(markup).not.toContain("功能页将在后续阶段实现");
  });

  it("renders five groups and seven slots for the expanded group", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsProvider>
            <DensityProvider>
              <HomeSettingsPanel initialEditing />
            </DensityProvider>
          </SettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    );

    expect(markup.match(/data-home-layout-group="true"/g)).toHaveLength(5);
    expect(markup.match(/data-home-layout-slot="true"/g)).toHaveLength(7);
  });
});
