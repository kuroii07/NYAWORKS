import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fromRoot = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFileSync(fromRoot(path), "utf8");

describe("NyaLauncher project contract", () => {
  it("pins a roll-forward compatible .NET 10 SDK", () => {
    const globalJson = JSON.parse(read("global.json"));

    expect(globalJson).toEqual({
      sdk: {
        version: "10.0.100",
        rollForward: "latestFeature",
        allowPrerelease: false
      }
    });
  });

  it("defines a Windows desktop application and test project", () => {
    const appProject = read(
      "native/NyaLauncher/src/NyaLauncher/NyaLauncher.csproj"
    );
    const testProject = read(
      "native/NyaLauncher/tests/NyaLauncher.Tests/NyaLauncher.Tests.csproj"
    );

    expect(appProject).toContain("<TargetFramework>net10.0-windows</TargetFramework>");
    expect(appProject).toContain("<OutputType>WinExe</OutputType>");
    expect(appProject).toContain("<UseWindowsForms>true</UseWindowsForms>");
    expect(appProject).toContain("<Nullable>enable</Nullable>");
    expect(appProject).toContain("<ImplicitUsings>enable</ImplicitUsings>");
    expect(appProject).toContain("<AllowUnsafeBlocks>true</AllowUnsafeBlocks>");
    expect(testProject).toContain("<TargetFramework>net10.0-windows</TargetFramework>");
    expect(testProject).toContain('ProjectReference Include="..\\..\\src\\NyaLauncher\\NyaLauncher.csproj"');
  });

  it("keeps prohibited native responsibilities out of the project", () => {
    const projectFiles = [
      read("native/NyaLauncher/src/NyaLauncher/NyaLauncher.csproj"),
      read("native/NyaLauncher/tests/NyaLauncher.Tests/NyaLauncher.Tests.csproj"),
      read("native/NyaLauncher/Directory.Packages.props")
    ].join("\n");

    expect(projectFiles).not.toMatch(/WebView2|HttpListener|WebSocket/i);
  });

  it("provides local bootstrap, test, and publish scripts", () => {
    expect(
      existsSync(fromRoot("scripts/bootstrap-nya-launcher-sdk.ps1"))
    ).toBe(true);
    expect(existsSync(fromRoot("scripts/test-nya-launcher.ps1"))).toBe(true);
    expect(existsSync(fromRoot("scripts/build-nya-launcher.ps1"))).toBe(true);
    expect(
      existsSync(fromRoot("native/NyaLauncher/NyaLauncher.slnx"))
    ).toBe(true);
  });

  it("ignores local SDK, packages, native intermediates, and publish output", () => {
    const gitignore = read(".gitignore");

    expect(gitignore).toContain(".dotnet/");
    expect(gitignore).toContain(".nuget/");
    expect(gitignore).toContain("native/NyaLauncher/**/bin/");
    expect(gitignore).toContain("native/NyaLauncher/**/obj/");
    expect(gitignore).toContain("outputs/nya-launcher-p1/");
  });
});
