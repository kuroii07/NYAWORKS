(function () {
  "use strict";

  function getHostInfo() {
    return JSON.stringify({
      name: app.name,
      version: app.version,
      projectName: app.project ? app.project.file && app.project.file.name : null
    });
  }

  function openDataDirectory() {
    try {
      var folder = new Folder(Folder.userData.fsName + "/NYAWORKS");

      if (!folder.exists && !folder.create()) {
        return JSON.stringify({ ok: false });
      }

      return JSON.stringify({
        ok: folder.execute(),
        path: folder.fsName
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: error && error.toString ? error.toString() : "Unknown error"
      });
    }
  }

  function createResourceSource(id, resourceType, name, relativePath) {
    var folder = new Folder(app.path.fsName + "/" + relativePath);
    var exists = folder.exists;

    return {
      id: "ae-default:" + id,
      kind: "ae-default",
      resourceType: resourceType,
      name: name,
      path: folder.fsName,
      enabled: true,
      hostVersion: app.version,
      status: exists ? "ready" : "missing",
      lastScannedAt: null,
      lastError: exists ? null : "missing"
    };
  }

  function getCurrentResourceSources() {
    try {
      return JSON.stringify({
        ok: true,
        version: app.version,
        sources: [
          createResourceSource("scripts", "script", "AE Scripts", "Scripts"),
          createResourceSource(
            "scriptui-panels",
            "panel",
            "ScriptUI Panels",
            "Scripts/ScriptUI Panels"
          ),
          createResourceSource("startup", "startup", "Startup", "Scripts/Startup"),
          createResourceSource("presets", "preset", "AE Presets", "Presets")
        ]
      });
    } catch (error) {
      return JSON.stringify({ ok: false });
    }
  }

  function decodeResourcePayload(encodedPayload) {
    return JSON.parse(decodeURIComponent(encodedPayload));
  }

  function hasAllowedExtension(filename, resourceType) {
    var allowed = {
      script: ["jsx", "jsxbin", "js"],
      panel: ["jsx", "jsxbin", "js"],
      startup: ["jsx", "jsxbin", "js"],
      preset: ["ffx"],
      expression: ["jsx", "json", "txt"]
    };
    var match = filename.match(/\.([^.\\/]+)$/);
    var extension = match ? match[1].toLowerCase() : "";
    var candidates = allowed[resourceType] || [];
    var index;

    for (index = 0; index < candidates.length; index += 1) {
      if (candidates[index] === extension) {
        return true;
      }
    }

    return false;
  }

  function padDate(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function toIsoDate(value) {
    if (!(value instanceof Date)) {
      return null;
    }

    return (
      value.getUTCFullYear() +
      "-" +
      padDate(value.getUTCMonth() + 1) +
      "-" +
      padDate(value.getUTCDate()) +
      "T" +
      padDate(value.getUTCHours()) +
      ":" +
      padDate(value.getUTCMinutes()) +
      ":" +
      padDate(value.getUTCSeconds()) +
      ".000Z"
    );
  }

  function collectResourceFiles(folder, resourceType, relativePath, items, depth) {
    var children;
    var index;
    var child;
    var childRelativePath;

    if (depth > 24 || items.length >= 5000) {
      return;
    }

    children = folder.getFiles();
    for (index = 0; index < children.length && items.length < 5000; index += 1) {
      child = children[index];
      childRelativePath = relativePath
        ? relativePath + "/" + child.name
        : child.name;

      if (child instanceof Folder) {
        collectResourceFiles(
          child,
          resourceType,
          childRelativePath,
          items,
          depth + 1
        );
      } else if (child instanceof File && hasAllowedExtension(child.name, resourceType)) {
        items.push({
          relativePath: childRelativePath,
          modifiedAt: toIsoDate(child.modified)
        });
      }
    }
  }

  function scanResourceSource(encodedPayload) {
    var payload;
    var folder;
    var resources = [];

    try {
      payload = decodeResourcePayload(encodedPayload);
      if (!payload || !payload.id || !payload.path || !payload.resourceType) {
        return JSON.stringify({
          sourceId: payload && payload.id ? payload.id : "",
          status: "error",
          resources: [],
          errorCode: "scan-failed"
        });
      }

      folder = new Folder(payload.path);
      if (!folder.exists) {
        return JSON.stringify({
          sourceId: payload.id,
          status: "missing",
          resources: [],
          errorCode: "missing"
        });
      }

      collectResourceFiles(folder, payload.resourceType, "", resources, 0);
      return JSON.stringify({
        sourceId: payload.id,
        status: "ready",
        resources: resources
      });
    } catch (error) {
      return JSON.stringify({
        sourceId: payload && payload.id ? payload.id : "",
        status: "error",
        resources: [],
        errorCode: "scan-failed"
      });
    }
  }

  function chooseResourceDirectory() {
    try {
      var folder = Folder.selectDialog("Choose a NYAWORKS resource directory");
      return folder
        ? JSON.stringify({ status: "selected", path: folder.fsName })
        : JSON.stringify({ status: "cancelled", path: null });
    } catch (error) {
      return JSON.stringify({ status: "error", path: null });
    }
  }

  $.global.NYAWORKS = {
    version: "0.1.0-alpha.1",
    getHostInfo: getHostInfo,
    openDataDirectory: openDataDirectory,
    getCurrentResourceSources: getCurrentResourceSources,
    scanResourceSource: scanResourceSource,
    chooseResourceDirectory: chooseResourceDirectory
  };
}());

