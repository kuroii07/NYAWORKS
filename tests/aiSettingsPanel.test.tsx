import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DensityProvider } from "../src/density/DensityProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { SettingsPage } from "../src/pages/SettingsPage";
import { SettingsProvider } from "../src/settings/SettingsProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";

function renderAiSettings(): string {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    return renderToStaticMarkup(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsProvider>
            <DensityProvider>
              <SettingsPage
                onResetComplete={() => undefined}
                initialTab="ai"
              />
            </DensityProvider>
          </SettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    );
  } finally {
    consoleError.mockRestore();
  }
}

describe("AI settings panel", () => {
  it("renders the complete AI connection workspace instead of a placeholder", () => {
    const markup = renderAiSettings();

    expect(markup).toContain("当前默认 AI");
    expect(markup.match(/data-ai-provider="true"/g)).toHaveLength(8);
    expect(markup).toContain('aria-label="新建自定义连接"');
    expect(markup).toContain('aria-label="自定义连接操作"');
    expect(markup).toContain("API Key");
    expect(markup).toContain("接口地址");
    expect(markup).toContain("刷新模型");
    expect(markup).toContain("测试连接");
    expect(markup).toContain("保存配置");
    expect(markup).toContain("功能模型分配");
    expect(markup).toContain("生成偏好");
    expect(markup).toContain("数据与隐私");
    expect(markup).not.toContain("该设置页将在后续阶段实现");
    expect(markup).not.toContain("<select");
  });

  it("renders global and per-feature model routing controls", () => {
    const markup = renderAiSettings();

    expect(markup).toContain('aria-label="全局默认模型"');
    expect(markup).toContain('aria-label="普通对话模型"');
    expect(markup).toContain('aria-label="表达式模型"');
    expect(markup).toContain('aria-label="脚本模型"');
    expect(markup).toContain("跟随全局");
  });

  it("renders explicit secret management and privacy controls", () => {
    const markup = renderAiSettings();

    expect(markup).toContain('aria-label="显示 API Key"');
    expect(markup).toContain('aria-label="清除 API Key"');
    expect(markup).toContain("仅在本次会话中保存");
    expect(markup).toContain("保存对话历史");
    expect(markup).toContain("附带 AE 环境信息");
    expect(markup).toContain("清除全部 AI 数据");
  });
});
