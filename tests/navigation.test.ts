import { describe, expect, it } from "vitest";
import { UI_COPY } from "../src/i18n/translations";
import {
  PAGE_IDS,
  RESOURCE_NAVIGATION_ID,
  STARTUP_PAGE_IDS
} from "../src/types/navigation";

describe("top bar navigation", () => {
  it("provides a dedicated settings page target", () => {
    expect(PAGE_IDS).toContain("settings");
  });

  it("places resources immediately after media with a concise Chinese label", () => {
    expect(RESOURCE_NAVIGATION_ID).toBe("resources");
    expect(STARTUP_PAGE_IDS.indexOf("resources")).toBe(
      STARTUP_PAGE_IDS.indexOf("media") + 1
    );
    expect(UI_COPY["zh-CN"].navigation.resources).toBe("资源");
  });
});
