import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BrightnessControl } from "../src/components/BrightnessControl";

describe("BrightnessControl", () => {
  it("exposes a normalized progress value for the custom themed track", () => {
    const markup = renderToStaticMarkup(
      <BrightnessControl
        value={98}
        min={90}
        max={110}
        ariaLabel="界面亮度"
        onChange={vi.fn()}
      />
    );

    expect(markup).toContain("--brightness-progress:40%");
  });
});
