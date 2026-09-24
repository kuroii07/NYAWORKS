import { describe, expect, it } from "vitest";
import {
  FEISHU_DOCUMENTATION_URL,
  FEISHU_FEEDBACK_URL,
  GITHUB_RELEASES_URL,
  GITHUB_REPOSITORY_URL,
  isSafeExternalUrl,
  openExternalUrl
} from "../src/about/productInfo";

describe("about page external links", () => {
  it("provides the official NYAWORKS repository over HTTPS", () => {
    expect(GITHUB_REPOSITORY_URL).toBe(
      "https://github.com/kuroii07/NYAWORKS"
    );
    expect(isSafeExternalUrl(GITHUB_REPOSITORY_URL)).toBe(true);
    expect(GITHUB_RELEASES_URL).toBe(
      "https://github.com/kuroii07/NYAWORKS/releases"
    );
    expect(isSafeExternalUrl(GITHUB_RELEASES_URL)).toBe(true);
  });

  it("uses the configured Feishu documentation and feedback URLs", () => {
    expect(FEISHU_DOCUMENTATION_URL).toBe(
      "https://my.feishu.cn/wiki/FeezwKTyViNhNgkqBwQc11dlnXg"
    );
    expect(FEISHU_FEEDBACK_URL).toBe(
      "https://my.feishu.cn/wiki/GHwlwFP34iePl0knqj0cZBDZnVf?table=tbly1bSNZDhA4pje&view=vewZV2r5Lz"
    );
    expect(isSafeExternalUrl(FEISHU_DOCUMENTATION_URL)).toBe(true);
    expect(isSafeExternalUrl(FEISHU_FEEDBACK_URL)).toBe(true);
  });

  it("rejects non-HTTPS and script URLs", () => {
    expect(isSafeExternalUrl("http://github.com/kuroii07/NYAWORKS")).toBe(
      false
    );
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });

  it("uses the CEP system browser bridge when available", () => {
    const opened: string[] = [];

    const didOpen = openExternalUrl(GITHUB_REPOSITORY_URL, {
      cep: {
        util: {
          openURLInDefaultBrowser: (url) => opened.push(url)
        }
      },
      open: () => {
        throw new Error("browser fallback should not run");
      }
    });

    expect(didOpen).toBe(true);
    expect(opened).toEqual([GITHUB_REPOSITORY_URL]);
  });

  it("does not open an unsafe URL", () => {
    let called = false;

    const didOpen = openExternalUrl("javascript:alert(1)", {
      open: () => {
        called = true;
        return null;
      }
    });

    expect(didOpen).toBe(false);
    expect(called).toBe(false);
  });
});
