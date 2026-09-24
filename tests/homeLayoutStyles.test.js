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

  it("keeps the layout select content on one row with its caret at the right edge", () => {
    expect(styles).toMatch(
      /\.home-layout-selector-row__controls\s*>\s*button:not\(\.setting-select\)/s
    );
    expect(styles).toMatch(
      /\.setting-select__value\s*\{[^}]*flex:\s*1\s+1\s+auto/s
    );
  });

  it("allows compact action menus to extend beyond home settings cards", () => {
    expect(styles).toMatch(
      /\.home-settings-section\s*\{[^}]*overflow:\s*visible/s
    );
  });

  it("does not size nested group action menu items like square icon buttons", () => {
    expect(styles).not.toMatch(/\.home-group-setting__actions button\s*\{/);
    expect(styles).toMatch(
      /\.home-group-setting__actions\s*>\s*button,\s*\.home-group-setting__actions\s*>\s*\.compact-menu-anchor\s*>\s*button\s*\{/s
    );
  });

  it("renders compact action menus as viewport-bound floating layers", () => {
    expect(styles).toMatch(
      /\.compact-action-menu\s*\{[^}]*position:\s*fixed/s
    );
    expect(styles).toMatch(
      /\.compact-action-menu__anchor-marker\s*\{[^}]*display:\s*none/s
    );
  });
});
