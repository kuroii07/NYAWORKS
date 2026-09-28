import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { describe, expect, it } from "vitest";

const fromRoot = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFileSync(fromRoot(path), "utf8");

function collectSourceFiles(directory) {
  return readdirSync(fromRoot(directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = `${directory}/${entry.name}`;
      return entry.isDirectory()
        ? collectSourceFiles(relativePath)
        : entry.name.endsWith(".cs")
          ? [relativePath]
          : [];
    }
  );
}

describe("NyaLauncher P1 candidate contract", () => {
  it("contains the native solution, scripts, executable, and AE test record", () => {
    const requiredPaths = [
      "native/NyaLauncher/NyaLauncher.slnx",
      "scripts/bootstrap-nya-launcher-sdk.ps1",
      "scripts/test-nya-launcher.ps1",
      "scripts/build-nya-launcher.ps1",
      "outputs/nya-launcher-p1/NyaLauncher.exe",
      "docs/testing/nya-launcher-p1-ae-test.md"
    ];

    for (const path of requiredPaths) {
      expect(existsSync(fromRoot(path)), path).toBe(true);
    }

    expect(
      statSync(fromRoot("outputs/nya-launcher-p1/NyaLauncher.exe")).size
    ).toBeGreaterThan(0);
  });

  it("uses the exact runtime title marker in the CEP runtime", () => {
    const launcher = read("src/nyaPie/p0/cepLauncher.ts");
    const runtime = read("src/nyaPie/p0/NyaPieP0Runtime.tsx");

    expect(launcher).toContain(
      'NYA_PIE_P1_RUNTIME_TITLE = "NYAWORKS_NYA_PIE_RUNTIME_P1"'
    );
    expect(runtime).toContain("setWindowTitle(NYA_PIE_P1_RUNTIME_TITLE)");
  });

  it("keeps prohibited product responsibilities out of native source", () => {
    const nativeSource = collectSourceFiles(
      "native/NyaLauncher/src/NyaLauncher"
    )
      .map(read)
      .join("\n");

    expect(nativeSource).not.toMatch(
      /HttpListener|WebSocket|SendInput|mouse_event|ActionRegistry|ActionRunner/
    );
  });

  it("keeps dist smoke coverage on both CEP entries without bundling native", () => {
    const smoke = read("scripts/smoke-dist.mjs");
    const contract = read("scripts/dist-contract.mjs");

    expect(smoke).toContain("REQUIRED_EXTENSION_IDS");
    expect(contract).toContain("com.kuroii.nyaworks.panel");
    expect(contract).toContain("com.kuroii.nyaworks.nyapie.p0");
    expect(smoke).not.toContain("NyaLauncher.exe");
    expect(contract).not.toContain("NyaLauncher.exe");
  });
});
