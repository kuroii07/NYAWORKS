export const LAST_SEEN_VERSION_STORAGE_KEY =
  "nyaworks.updates.lastSeenVersion.v1";

interface ReleaseNotesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isReleaseVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/.test(value)
  );
}

export function readLastSeenVersion(
  storage?: ReleaseNotesStorage
): string | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(LAST_SEEN_VERSION_STORAGE_KEY);
    return isReleaseVersion(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastSeenVersion(
  version: string,
  storage?: ReleaseNotesStorage
): void {
  if (!storage || !isReleaseVersion(version)) {
    return;
  }

  try {
    storage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, version);
  } catch {
    // CEP can run with storage disabled. Keep release notes available.
  }
}

export function hasUnreadReleaseNotes(
  currentVersion: string,
  lastSeenVersion: string | null
): boolean {
  return currentVersion !== lastSeenVersion;
}
