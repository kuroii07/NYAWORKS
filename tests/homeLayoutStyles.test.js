import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../src/styles.css", import.meta.url),
  "utf8"
);

describe("home layout responsive styles", () => {
  it("keeps long layout and group names inside the narrow panel", () => {
    expect(styles).toMatch(
      /\.shortcut-heading h2\s*\{[^}]*min-width:\s*0/s
    );
    expect(styles).toMatch(
      /\.shortcut-heading h2\s*\{[^}]*text-overflow:\s*ellipsis/s
    );
    expect(styles).toMatch(
      /\.home-group-setting > span\s*\{[^}]*min-width:\s*0/s
    );
    expect(styles).toMatch(
      /\.home-group-setting > span\s*\{[^}]*text-overflow:\s*ellipsis/s
    );
  });
});
