import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import {
  REQUIRED_DIST_FILES,
  REQUIRED_EXTENSION_IDS
} from "./dist-contract.mjs";

for (const file of REQUIRED_DIST_FILES) {
  await access(file, constants.R_OK);
}

const builtAssets = await readdir("dist/assets");

if (!builtAssets.some((file) => /^nyaworks-home-banner-.*\.png$/.test(file))) {
  throw new Error("Built assets are missing the NYAWORKS home banner.");
}

const manifest = await readFile("dist/CSXS/manifest.xml", "utf8");

for (const extensionId of REQUIRED_EXTENSION_IDS) {
  if (!manifest.includes(extensionId)) {
    throw new Error(`CEP manifest is missing extension id: ${extensionId}`);
  }
}

if (
  !manifest.includes("<Width>520</Width>") ||
  !manifest.includes("<Height>960</Height>")
) {
  throw new Error("CEP manifest is missing the approved 520x960 default size.");
}

console.log(
  `Smoke check passed (${REQUIRED_DIST_FILES.length + 1} required files/assets).`
);
