import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_AI_SETTINGS } from "../src/aiSettings/providerCatalog";
import {
  applyAiSettingsUpdate,
  cloneDefaultAiSettings,
  SettingsProvider,
  useSettings
} from "../src/settings/SettingsProvider";

function AiSettingsProbe() {
  const { aiSettings } = useSettings();

  return (
    <output
      data-connections={aiSettings.connections.length}
      data-default={aiSettings.globalDefault?.connectionId ?? "none"}
    />
  );
}

describe("SettingsProvider AI settings", () => {
  it("provides the safe default AI configuration", () => {
    const markup = renderToStaticMarkup(
      <SettingsProvider>
        <AiSettingsProbe />
      </SettingsProvider>
    );

    expect(markup).toContain('data-connections="8"');
    expect(markup).toContain('data-default="none"');
  });

  it("applies nested AI settings updates without accepting raw secret fields", () => {
    const updated = applyAiSettingsUpdate(DEFAULT_AI_SETTINGS, (current) => ({
      ...current,
      generation: {
        ...current.generation,
        streaming: false
      },
      apiKey: "must-not-survive"
    }));

    expect(updated.generation.streaming).toBe(false);
    expect(JSON.stringify(updated)).not.toContain("must-not-survive");
    expect(JSON.stringify(updated)).not.toContain('"apiKey":');
  });

  it("returns a fresh default value when resetting AI settings", () => {
    const first = cloneDefaultAiSettings();
    const second = cloneDefaultAiSettings();

    expect(first).toEqual(DEFAULT_AI_SETTINGS);
    expect(first).not.toBe(DEFAULT_AI_SETTINGS);
    expect(first.connections).not.toBe(second.connections);
  });
});
