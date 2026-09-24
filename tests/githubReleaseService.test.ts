import { describe, expect, it, vi } from "vitest";
import { PRODUCT_VERSION } from "../src/about/productInfo";
import {
  createDevelopmentReleaseFetcher,
  fetchLatestRelease
} from "../src/updates/githubReleaseService";
import { compareVersions } from "../src/updates/version";

function createFetcher(
  status: number,
  payload: unknown
): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  })) as unknown as typeof fetch;
}

const validRelease = {
  tag_name: "v0.1.0-alpha.2",
  name: "NYAWORKS 0.1.0-alpha.2",
  body: "New settings workflow.",
  html_url:
    "https://github.com/kuroii07/NYAWORKS/releases/tag/v0.1.0-alpha.2",
  draft: false,
  prerelease: true
};

describe("GitHub latest release service", () => {
  it("returns a validated published release", async () => {
    const fetcher = createFetcher(200, validRelease);

    await expect(fetchLatestRelease(fetcher)).resolves.toEqual({
      tagName: "v0.1.0-alpha.2",
      title: "NYAWORKS 0.1.0-alpha.2",
      body: "New settings workflow.",
      htmlUrl:
        "https://github.com/kuroii07/NYAWORKS/releases/tag/v0.1.0-alpha.2",
      prerelease: true
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.github.com/repos/kuroii07/NYAWORKS/releases/latest",
      {
        headers: { Accept: "application/vnd.github+json" }
      }
    );
  });

  it.each([
    ["draft release", { ...validRelease, draft: true }],
    ["missing tag", { ...validRelease, tag_name: undefined }],
    ["missing URL", { ...validRelease, html_url: undefined }],
    [
      "unsafe URL",
      { ...validRelease, html_url: "javascript:alert(1)" }
    ]
  ])("rejects an invalid %s", async (_label, payload) => {
    await expect(
      fetchLatestRelease(createFetcher(200, payload))
    ).resolves.toBeNull();
  });

  it.each([404, 403])("returns null for HTTP %s", async (status) => {
    await expect(
      fetchLatestRelease(createFetcher(status, {}))
    ).resolves.toBeNull();
  });

  it("returns null when the network request rejects", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    await expect(fetchLatestRelease(fetcher)).resolves.toBeNull();
  });

  it("does not classify the current version as newer", async () => {
    const release = await fetchLatestRelease(
      createFetcher(200, {
        ...validRelease,
        tag_name: PRODUCT_VERSION
      })
    );

    expect(release).not.toBeNull();
    expect(compareVersions(PRODUCT_VERSION, release!.tagName)).toBe(0);
  });

  it("provides deterministic development fixtures for browser acceptance", async () => {
    const newerFetcher = createDevelopmentReleaseFetcher("newer");
    const errorFetcher = createDevelopmentReleaseFetcher("error");

    expect(newerFetcher).toBeTypeOf("function");
    await expect(fetchLatestRelease(newerFetcher)).resolves.toMatchObject({
      tagName: "v9.9.9"
    });
    await expect(fetchLatestRelease(errorFetcher)).resolves.toBeNull();
    expect(createDevelopmentReleaseFetcher(null)).toBeUndefined();
  });
});
