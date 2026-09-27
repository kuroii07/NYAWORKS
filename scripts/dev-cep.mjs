import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { resolveDevOutputDir } from "./cep-dev-config.mjs";

const projectRoot = process.cwd();
const devOutput = resolveDevOutputDir(projectRoot);
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const commandShell = isWindows ? process.env.ComSpec || "cmd.exe" : npmCommand;
const spawnOptions = {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env
};

function runNpm(args, env = process.env) {
  if (isWindows) {
    return spawn(commandShell, ["/d", "/s", "/c", `${npmCommand} ${args.join(" ")}`], {
      ...spawnOptions,
      env
    });
  }

  return spawn(npmCommand, args, { ...spawnOptions, env });
}

async function syncPublicFile(publicRoot, outputRoot, relativePath) {
  const sourcePath = path.join(publicRoot, relativePath);
  const outputPath = path.join(outputRoot, relativePath);
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.copyFile(sourcePath, outputPath);
}

async function syncPublicTree(publicRoot, outputRoot) {
  const entries = await fsp.readdir(publicRoot, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = entry.name;
    const sourcePath = path.join(publicRoot, relativePath);
    const outputPath = path.join(outputRoot, relativePath);
    if (entry.isDirectory()) {
      await syncPublicTree(sourcePath, outputPath);
    } else if (entry.isFile()) {
      await fsp.mkdir(path.dirname(outputPath), { recursive: true });
      await fsp.copyFile(sourcePath, outputPath);
    }
  }
}

function watchPublicTree(publicRoot, outputRoot) {
  const watcher = fs.watch(publicRoot, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const relativePath = filename.toString();
    const sourcePath = path.join(publicRoot, relativePath);
    const outputPath = path.join(outputRoot, relativePath);
    setTimeout(async () => {
      try {
        const stat = await fsp.stat(sourcePath);
        if (stat.isFile()) {
          await syncPublicFile(publicRoot, outputRoot, relativePath);
          console.log(`CEP static asset synced: ${relativePath}`);
        }
      } catch (error) {
        if (error?.code === "ENOENT" && eventType === "rename") {
          await fsp.rm(outputPath, { force: true });
          console.log(`CEP static asset removed: ${relativePath}`);
        }
      }
    }, 50);
  });
  return watcher;
}

const setup = runNpm(["run", "setup:cep"]);

setup.on("exit", async (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const publicRoot = path.join(projectRoot, "public");
  let staticWatcher;

  try {
    await syncPublicTree(publicRoot, devOutput);
    staticWatcher = watchPublicTree(publicRoot, devOutput);
  } catch (error) {
    console.error("Failed to sync CEP public assets:", error);
    process.exitCode = 1;
    return;
  }

  const watcher = runNpm(["run", "build:watch"], {
    ...process.env,
    NYAWORKS_CEP_DEV: "1",
    NYAWORKS_CEP_DEV_OUT_DIR: devOutput
  });

  watcher.on("exit", (watcherCode) => {
    staticWatcher?.close();
    process.exit(watcherCode ?? 0);
  });
});
