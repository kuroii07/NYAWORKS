import type { ReleaseInfo } from "./types";
import { normalizeVersionTag } from "./version";

export const GITHUB_LATEST_RELEASE_API_URL =
  "https://api.github.com/repos/kuroii07/NYAWORKS/releases/latest";

export function createDevelopmentReleaseFetcher(
  fixture: string | null
): typeof fetch | undefined {
  if (!fixture || !["newer", "current", "error"].includes(fixture)) {
    return undefined;
  }

  if (fixture === "error") {
    return (async () => {
      throw new Error("Development update fixture request failed.");
    }) as typeof fetch;
  }

  const tagName = fixture === "newer" ? "v9.9.9" : "0.1.0-alpha.1";

  return (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: tagName,
        name:
          fixture === "newer"
            ? "NYAWORKS Development Update"
            : "NYAWORKS Current Version",
        body:
          fixture === "newer"
            ? "Development fixture: a newer release is available."
            : "Development fixture: the installed version is current.",
        html_url: `https://github.com/kuroii07/NYAWORKS/releases/tag/${tagName}`,
        draft: false,
        prerelease: fixture !== "newer"
      })
    }) as Response) as typeof fetch;
}

function isSafeReleaseUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.startsWith("/kuroii07/NYAWORKS/releases/")
    );
  } catch {
    return false;
  }
}

export async function fetchLatestRelease(
  fetcher?: typeof fetch
): Promise<ReleaseInfo | null> {
  const activeFetcher =
    fetcher ??
    (typeof fetch === "function"
      ? ((input, init) => fetch(input, init))
      : null);

  if (!activeFetcher) {
    return null;
  }

  try {
    const response = await activeFetcher(GITHUB_LATEST_RELEASE_API_URL, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();

    if (!payload || typeof payload !== "object") {
      return null;
    }

    const release = payload as Record<string, unknown>;

    if (
      release.draft !== false ||
      typeof release.tag_name !== "string" ||
      !normalizeVersionTag(release.tag_name) ||
      typeof release.name !== "string" ||
      release.name.trim().length === 0 ||
      typeof release.body !== "string" ||
      !isSafeReleaseUrl(release.html_url) ||
      typeof release.prerelease !== "boolean"
    ) {
      return null;
    }

    return {
      tagName: release.tag_name,
      title: release.name,
      body: release.body,
      htmlUrl: release.html_url,
      prerelease: release.prerelease
    };
  } catch {
    return null;
  }
}
