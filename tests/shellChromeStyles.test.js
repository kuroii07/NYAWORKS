import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("compact application chrome styles", () => {
  it("uses smaller medium-density topbar controls and icon-only sidebar geometry", () => {
    expect(styles).toMatch(
      /\[data-density="medium"\] \.icon-button\s*\{[^}]*width:\s*34px;[^}]*height:\s*34px;/s
    );
    expect(styles).toMatch(
      /\[data-density="medium"\] \.icon-button svg\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;/s
    );
    expect(styles).toMatch(
      /\[data-density="medium"\]\s*\{[^}]*--nw-sidebar-width:\s*48px;/s
    );
    expect(styles).toMatch(
      /\[data-density="medium"\] \.nav-item\s*\{[^}]*min-height:\s*44px;/s
    );
  });
});
