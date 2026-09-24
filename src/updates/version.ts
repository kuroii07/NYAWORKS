export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: readonly string[];
}

export function normalizeVersionTag(tag: string): ParsedVersion | null {
  const match =
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*))?$/.exec(
      tag.trim()
    );

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? []
  };
}

function comparePrereleaseIdentifier(left: string, right: string): -1 | 0 | 1 {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null;

  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }

  if (leftNumber !== null) {
    return -1;
  }

  if (rightNumber !== null) {
    return 1;
  }

  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const leftVersion = normalizeVersionTag(left);
  const rightVersion = normalizeVersionTag(right);

  if (!leftVersion || !rightVersion) {
    return 0;
  }

  for (const key of ["major", "minor", "patch"] as const) {
    if (leftVersion[key] !== rightVersion[key]) {
      return leftVersion[key] < rightVersion[key] ? -1 : 1;
    }
  }

  if (
    leftVersion.prerelease.length === 0 ||
    rightVersion.prerelease.length === 0
  ) {
    if (leftVersion.prerelease.length === rightVersion.prerelease.length) {
      return 0;
    }

    return leftVersion.prerelease.length === 0 ? 1 : -1;
  }

  const identifierCount = Math.max(
    leftVersion.prerelease.length,
    rightVersion.prerelease.length
  );

  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = leftVersion.prerelease[index];
    const rightIdentifier = rightVersion.prerelease[index];

    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return leftIdentifier === undefined ? -1 : 1;
    }

    const comparison = comparePrereleaseIdentifier(
      leftIdentifier,
      rightIdentifier
    );

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}
