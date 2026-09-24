import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "dist/index.html",
  "dist/CSXS/manifest.xml",
  "dist/host/index.jsx",
  "dist/assets/brand/nyaworks-cat.png"
];

for (const file of requiredFiles) {
  await access(file, constants.R_OK);
}

const builtAssets = await readdir("dist/assets");

if (!builtAssets.some((file) => /^nyaworks-home-banner-.*\.png$/.test(file))) {
  throw new Error("Built assets are missing the NYAWORKS home banner.");
}

const manifest = await readFile("dist/CSXS/manifest.xml", "utf8");

if (!manifest.includes("com.kuroii.nyaworks.panel")) {
  throw new Error("CEP manifest is missing the NYAWORKS panel id.");
}

if (
  !manifest.includes("<Width>520</Width>") ||
  !manifest.includes("<Height>960</Height>")
) {
  throw new Error("CEP manifest is missing the approved 520x960 default size.");
}

console.log(
  `Smoke check passed (${requiredFiles.length + 1} required files/assets).`
);
