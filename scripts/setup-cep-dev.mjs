import fs from "node:fs/promises";
import path from "node:path";
import {
  EXTENSION_ID,
  resolveCepExtensionsDir,
  resolveCepLinkPath,
  resolveDevOutputDir
} from "./cep-dev-config.mjs";

const projectRoot = process.cwd();
const devOutput = resolveDevOutputDir(projectRoot);
const extensionRoot = resolveCepExtensionsDir();
const linkPath = resolveCepLinkPath();

await fs.mkdir(devOutput, { recursive: true });
await fs.mkdir(extensionRoot, { recursive: true });

try {
  const existing = await fs.lstat(linkPath);
  if (!existing.isSymbolicLink()) {
    throw new Error(
      `Refusing to replace an existing real directory at ${linkPath}. Move it away manually, then run setup again.`
    );
  }
  await fs.unlink(linkPath);
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

const linkType = process.platform === "win32" ? "junction" : "dir";
await fs.symlink(devOutput, linkPath, linkType);

console.log(`CEP development link ready: ${linkPath}`);
console.log(`Linked to: ${path.resolve(devOutput)}`);
console.log(`Extension ID: ${EXTENSION_ID}`);
