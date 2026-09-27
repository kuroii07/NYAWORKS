import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  EXTENSION_ID,
  resolveCepExtensionsDir,
  resolveDevOutputDir
} from "../scripts/cep-dev-config.mjs";

describe("CEP development configuration", () => {
  it("uses the Windows per-user CEP extensions directory by default", () => {
    expect(resolveCepExtensionsDir({ APPDATA: "C:/Users/Test/AppData/Roaming" }, "win32")).toBe(
      path.normalize("C:/Users/Test/AppData/Roaming/Adobe/CEP/extensions")
    );
  });

  it("allows an explicit CEP extensions directory", () => {
    expect(resolveCepExtensionsDir({
      APPDATA: "C:/Ignored",
      NYAWORKS_CEP_EXTENSIONS_DIR: "D:/CEP/extensions"
    }, "win32")).toBe(path.normalize("D:/CEP/extensions"));
  });

  it("keeps the development build in a stable project-local directory", () => {
    expect(resolveDevOutputDir("H:/Projects/NYAWORKS", {})).toBe(
      path.normalize("H:/Projects/NYAWORKS/dev-extension")
    );
    expect(EXTENSION_ID).toBe("com.kuroii.nyaworks.panel");
  });
});
