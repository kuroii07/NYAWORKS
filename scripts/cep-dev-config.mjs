import path from "node:path";

export const EXTENSION_ID = "com.kuroii.nyaworks.panel";

export function resolveCepExtensionsDir(env = process.env, platform = process.platform) {
  if (env.NYAWORKS_CEP_EXTENSIONS_DIR) {
    return path.resolve(env.NYAWORKS_CEP_EXTENSIONS_DIR);
  }

  if (platform === "win32") {
    if (!env.APPDATA) {
      throw new Error("APPDATA is required to resolve the Windows CEP extensions directory.");
    }
    return path.join(env.APPDATA, "Adobe", "CEP", "extensions");
  }

  if (!env.HOME) {
    throw new Error("HOME is required to resolve the CEP extensions directory.");
  }
  return path.join(env.HOME, "Library", "Application Support", "Adobe", "CEP", "extensions");
}

export function resolveDevOutputDir(projectRoot = process.cwd(), env = process.env) {
  return path.resolve(projectRoot, env.NYAWORKS_CEP_DEV_OUT_DIR || "dev-extension");
}

export function resolveCepLinkPath(env = process.env, platform = process.platform) {
  return path.join(resolveCepExtensionsDir(env, platform), EXTENSION_ID);
}
