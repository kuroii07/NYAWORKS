import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AiConnectionDialog,
  validateCustomConnectionName
} from "../src/pages/AiConnectionDialog";
import type { AiConnectionDraft } from "../src/aiSettings/types";

const draft: AiConnectionDraft = {
  id: "custom:new",
  kind: "custom",
  providerId: "openai-compatible",
  displayName: "Studio Relay",
  enabled: true,
  baseUrl: "https://example.com/v1",
  apiKeyRef: null,
  selectedModel: "custom-model",
  discoveredModels: ["custom-model"],
  modelsFetchedAt: null
};

const labels = {
  createTitle: "新建自定义连接",
  editTitle: "编辑自定义连接",
  connectionName: "连接名称",
  connectionNamePlaceholder: "例如：公司接口",
  protocol: "接口协议",
  protocolValue: "OpenAI Compatible",
  apiKey: "API Key",
  apiKeyPlaceholder: "输入 API Key",
  baseUrl: "接口地址",
  baseUrlPlaceholder: "https://example.com/v1",
  model: "模型",
  modelPlaceholder: "输入模型名称",
  refreshModels: "刷新模型",
  testConnection: "测试连接",
  createAndSave: "创建并保存",
  save: "保存",
  cancel: "取消",
  nameRequired: "请输入连接名称",
  nameDuplicate: "连接名称已存在",
  invalidUrl: "请输入有效地址",
  showSecret: "显示密钥",
  hideSecret: "隐藏密钥"
};

describe("AiConnectionDialog", () => {
  it("validates required and duplicate connection names", () => {
    expect(validateCustomConnectionName("  ", ["Existing"], labels)).toBe(
      "请输入连接名称"
    );
    expect(
      validateCustomConnectionName(" existing ", ["Existing"], labels)
    ).toBe("连接名称已存在");
    expect(validateCustomConnectionName("Studio Relay", ["Existing"], labels))
      .toBeNull();
  });

  it("renders project-styled fields with separate test and save actions", () => {
    const markup = renderToStaticMarkup(
      <AiConnectionDialog
        mode="create"
        draft={draft}
        secret=""
        existingNames={["Existing"]}
        labels={labels}
        requestState="idle"
        feedback={null}
        onDraftChange={vi.fn()}
        onSecretChange={vi.fn()}
        onRefreshModels={vi.fn()}
        onTestConnection={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("新建自定义连接");
    expect(markup).toContain("OpenAI Compatible");
    expect(markup).toContain("测试连接");
    expect(markup).toContain("创建并保存");
    expect(markup).toContain('aria-label="刷新模型"');
    expect(markup).not.toContain("<select");
  });

  it("renders duplicate-name validation inline", () => {
    const markup = renderToStaticMarkup(
      <AiConnectionDialog
        mode="create"
        draft={{ ...draft, displayName: "Existing" }}
        secret=""
        existingNames={["Existing"]}
        labels={labels}
        requestState="idle"
        feedback={null}
        onDraftChange={vi.fn()}
        onSecretChange={vi.fn()}
        onRefreshModels={vi.fn()}
        onTestConnection={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("连接名称已存在");
  });
});
