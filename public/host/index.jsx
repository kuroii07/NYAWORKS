(function () {
  "use strict";

  var hostScriptFile = new File($.fileName);

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
    var folder = new Folder(Folder.startup.fsName + "/" + relativePath);
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
          createResourceSource("startup", "startup", "Startup", "Scripts/Startup")
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
    var safeFilename = filename ? String(filename) : "";
    var lastDot = safeFilename.lastIndexOf(".");
    var extension = lastDot >= 0
      ? safeFilename.substring(lastDot + 1).toLowerCase()
      : "";
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

  function resourceEntryName(entry) {
    var value;

    if (typeof entry === "string") {
      value = entry;
    } else if (entry && typeof entry.name === "string") {
      value = entry.name;
    } else if (entry && entry.fsName) {
      value = String(entry.fsName);
    } else {
      return "";
    }

    value = value.replace(/\\/g, "/");
    return value.substring(value.lastIndexOf("/") + 1);
  }

  function isResourceFolderEntry(entry) {
    return !!entry && (
      entry instanceof Folder ||
      typeof entry.getFiles === "function"
    );
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
    var childName;
    var childRelativePath;

    if (depth > 24 || items.length >= 5000) {
      return;
    }

    children = folder.getFiles() || [];
    for (index = 0; index < children.length && items.length < 5000; index += 1) {
      child = children[index];
      childName = resourceEntryName(child);
      if (!childName) {
        continue;
      }
      childRelativePath = relativePath
        ? relativePath + "/" + childName
        : childName;

      if (isResourceFolderEntry(child)) {
        collectResourceFiles(
          child,
          resourceType,
          childRelativePath,
          items,
          depth + 1
        );
      } else if (
        (child instanceof File || typeof child === "string" || (child && typeof child.name === "string")) &&
        hasAllowedExtension(childName, resourceType)
      ) {
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

  function openResourceDirectory(encodedPayload) {
    var payload;
    var folder;
    var systemPath;
    var osName;

    try {
      payload = decodeResourcePayload(encodedPayload);
      if (!payload || !payload.path) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      folder = new Folder(payload.path);
      if (!folder.exists) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      systemPath = String(folder.fsName).replace(/"/g, "\\\"");
      osName = $.os ? String($.os) : "";
      if (typeof system !== "undefined" && typeof system.callSystem === "function") {
        if (/Windows/i.test(osName)) {
          system.callSystem("explorer.exe \"" + systemPath + "\"");
        } else if (/Macintosh|Mac OS/i.test(osName)) {
          system.callSystem("open \"" + systemPath + "\"");
        } else {
          system.callSystem("xdg-open \"" + systemPath + "\"");
        }
      } else if (typeof folder.execute === "function") {
        folder.execute();
      } else {
        return JSON.stringify({ ok: false, reason: "host-error", detail: "No folder opener available" });
      }

      return JSON.stringify({ ok: true, path: folder.fsName });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  function decodeResourceFileActionPayload(encodedPayload) {
    try {
      return JSON.parse(decodeURIComponent(encodedPayload));
    } catch (error) {
      return null;
    }
  }

  function isUnsafeResourceFilePath(path) {
    return !path || /[\x00-\x1f"]/.test(String(path));
  }

  function revealResourceFile(encodedPayload) {
    var payload;
    var path;
    var file;
    var systemPath;

    try {
      payload = decodeResourceFileActionPayload(encodedPayload);
      if (!payload || isUnsafeResourceFilePath(payload.path)) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      path = decodeResourceFilePath(payload.path);
      if (isUnsafeResourceFilePath(path)) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      file = new File(path);
      if (!file.exists || isUnsafeResourceFilePath(file.fsName)) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }
      if (
        /Windows/i.test($.os ? String($.os) : "") &&
        typeof system !== "undefined" &&
        typeof system.callSystem === "function"
      ) {
        systemPath = String(file.fsName);
        try {
          var selectResult = system.callSystem("explorer.exe /select,\"" + systemPath + "\"");
          if (typeof selectResult === "string" && selectResult.length > 0) {
            throw new Error(selectResult);
          }
          return JSON.stringify({ ok: true, path: file.fsName });
        } catch (selectError) {
          // Explorer can fail without throwing a useful error; use the folder
          // opener below so the resource remains reachable in AE.
        }
      }

      if (file.parent && typeof file.parent.execute === "function") {
        try {
          file.parent.execute();
          return JSON.stringify({
            ok: true,
            path: file.fsName,
            fallback: "folder"
          });
        } catch (folderError) {
          // Fall through to the structured failure below.
        }
      }

      return JSON.stringify({ ok: false, reason: "system-open-failed" });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "system-open-failed",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  function canOpenResourceFile(resourceType, filename) {
    var lowerName = String(filename || "").toLowerCase();
    if (resourceType === "expression") {
      return /\.(jsx|txt|json)$/.test(lowerName);
    }
    if (resourceType === "script" || resourceType === "startup") {
      return /\.(jsx|js)$/.test(lowerName);
    }
    return false;
  }

  function openResourceFile(encodedPayload) {
    var payload;
    var path;
    var file;

    try {
      payload = decodeResourceFileActionPayload(encodedPayload);
      if (!payload || isUnsafeResourceFilePath(payload.path)) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      path = decodeResourceFilePath(payload.path);
      if (isUnsafeResourceFilePath(path)) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      file = new File(path);
      if (!file.exists) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }
      if (!canOpenResourceFile(payload.resourceType, file.name)) {
        return JSON.stringify({ ok: false, reason: "unsupported-file-type" });
      }
      if (typeof file.execute !== "function" || file.execute() !== true) {
        return JSON.stringify({ ok: false, reason: "system-open-failed" });
      }

      return JSON.stringify({ ok: true, path: file.fsName });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "system-open-failed",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  function reloadHostScript() {
    try {
      $.evalFile(hostScriptFile);
      return JSON.stringify({ ok: true });
    } catch (error) {
      return JSON.stringify({ ok: false, reason: "host-error" });
    }
  }

  var TEXT_EDITOR_APPEARANCE_SECTION = "NYAWORKS";
  var TEXT_EDITOR_APPEARANCE_KEY = "textEditorAppearance";

  function isSupportedTextEditorTheme(themeId) {
    return themeId === "obsidian-cyan" ||
      themeId === "nebula-violet" ||
      themeId === "molten-amber" ||
      themeId === "deep-emerald" ||
      themeId === "sakura-night-pink";
  }

  function isSupportedTextEditorLanguage(languageId) {
    return languageId === "zh-CN" ||
      languageId === "zh-TW" ||
      languageId === "en" ||
      languageId === "ja" ||
      languageId === "ko";
  }

  function normalizeTextEditorAppearance(value) {
    if (!value ||
      !isSupportedTextEditorTheme(value.themeId) ||
      !isSupportedTextEditorLanguage(value.languageId)) {
      return null;
    }
    return {
      themeId: String(value.themeId),
      languageId: String(value.languageId)
    };
  }

  function setTextEditorAppearance(encodedPayload) {
    var appearance;
    try {
      appearance = normalizeTextEditorAppearance(
        JSON.parse(decodeURIComponent(encodedPayload || ""))
      );
      if (!appearance) {
        return JSON.stringify({ ok: false, reason: "invalid-appearance" });
      }
      app.settings.saveSetting(
        TEXT_EDITOR_APPEARANCE_SECTION,
        TEXT_EDITOR_APPEARANCE_KEY,
        JSON.stringify(appearance)
      );
      return JSON.stringify({ ok: true });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  function getTextEditorAppearance() {
    var stored;
    var appearance;
    try {
      if (!app.settings.haveSetting(
        TEXT_EDITOR_APPEARANCE_SECTION,
        TEXT_EDITOR_APPEARANCE_KEY
      )) {
        return JSON.stringify({ ok: false, reason: "not-set" });
      }
      stored = app.settings.getSetting(
        TEXT_EDITOR_APPEARANCE_SECTION,
        TEXT_EDITOR_APPEARANCE_KEY
      );
      appearance = normalizeTextEditorAppearance(JSON.parse(stored));
      if (!appearance) {
        return JSON.stringify({ ok: false, reason: "invalid-appearance" });
      }
      return JSON.stringify({ ok: true, appearance: appearance });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  function decodeSearchPayload(encodedPayload) {
    return JSON.parse(decodeURIComponent(encodedPayload));
  }

  function decodeResourceFilePath(path) {
    var value = path == null ? "" : String(path);
    var segments = value.split("/");
    var index;

    for (index = 0; index < segments.length; index += 1) {
      try {
        segments[index] = decodeURIComponent(segments[index]);
      } catch (error) {
        // Keep only the malformed segment intact and decode the rest of the path.
      }
    }

    return segments.join("/");
  }

  function getCurrentEffects() {
    var effects = [];
    var seen = {};
    var installed;
    var installedCount;
    var installedEffect;
    var installedMatchName;
    var installedName;
    var matchNames = [
      "ADBE Gaussian Blur 2",
      "ADBE Fill",
      "ADBE Drop Shadow",
      "ADBE Tint"
    ];
    var names = ["Gaussian Blur", "Fill", "Drop Shadow", "Tint"];
    var aliases = [
      ["高斯模糊", "高斯模糊 2", "gaussian blur"],
      ["填充", "纯色填充", "填充效果"],
      ["投影", "阴影", "drop shadow"],
      ["色调", "色调映射", "tint"]
    ];
    var index;

    try {
      installed = app && app.effects;
      installedCount = Number(installed && (installed.numItems || installed.length) || 0);
      for (index = 1; index <= installedCount; index += 1) {
        installedEffect = installed.item
          ? installed.item(index)
          : installed[index - 1];
        if (!installedEffect) continue;
        installedMatchName = String(installedEffect.matchName || "");
        installedName = String(installedEffect.displayName || installedEffect.name || "");
        if (!installedMatchName || !installedName || seen[installedMatchName]) continue;
        seen[installedMatchName] = true;
        effects.push({
          id: "effect:" + installedMatchName,
          name: installedName,
          matchName: installedMatchName,
          aliases: []
        });
      }
    } catch (ignoreInstalledEffects) {}

    for (index = 0; index < matchNames.length; index += 1) {
      if (!seen[matchNames[index]]) {
        seen[matchNames[index]] = true;
        effects.push({
          id: "effect:" + matchNames[index],
          name: names[index],
          matchName: matchNames[index],
          aliases: aliases[index]
        });
      }
    }

    return JSON.stringify({ ok: true, effects: effects });
  }

  function runSearchScript(encodedPayload) {
    var payload;
    try {
      payload = decodeSearchPayload(encodedPayload);
      if (!payload || !payload.path) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }
      var file = new File(decodeResourceFilePath(payload.path));
      if (!file.exists) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      if (
        payload.resourceType === "panel" &&
        app &&
        typeof app.findMenuCommandId === "function" &&
        typeof app.executeCommand === "function"
      ) {
        var scriptName = decodeResourceFilePath(file.name).replace(/\.[^.]+$/, "");
        var commandId = app.findMenuCommandId(scriptName);
        if (commandId > 0) {
          app.executeCommand(commandId);
          return JSON.stringify({ ok: true });
        }
      }

      // A ScriptUI panel file is still a valid JSX resource. When AE has not
      // registered a menu command for it yet, execute the file directly so
      // the resource remains usable from the library.
      $.evalFile(file);
      return JSON.stringify({ ok: true });
    } catch (error) {
      return JSON.stringify({ ok: false, reason: "host-error" });
    }
  }

  function selectedLayers() {
    return app.project && app.project.activeItem && app.project.activeItem.selectedLayers
      ? app.project.activeItem.selectedLayers
      : [];
  }

  function applySearchPreset(encodedPayload) {
    var payload;
    var layers;
    var index;
    try {
      payload = decodeSearchPayload(encodedPayload);
      if (!payload || !payload.path) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }
      var file = new File(decodeResourceFilePath(payload.path));
      layers = selectedLayers();
      if (!file.exists) return JSON.stringify({ ok: false, reason: "invalid-resource" });
      if (!layers || layers.length === 0) return JSON.stringify({ ok: false, reason: "no-selected-layer" });
      app.beginUndoGroup("NYAWORKS Apply Preset");
      for (index = 0; index < layers.length; index += 1) layers[index].applyPreset(file);
      app.endUndoGroup();
      return JSON.stringify({ ok: true, updatedItems: layers.length });
    } catch (error) {
      try { app.endUndoGroup(); } catch (ignore) {}
      return JSON.stringify({ ok: false, reason: "host-error" });
    }
  }

  function applyResourceExpression(encodedPayload) {
    var payload;
    var file;
    var content;
    var parsed;
    var item;
    var properties;
    var updatedProperties = 0;
    var index;
    var property;
    var undoStarted = false;

    try {
      payload = decodeSearchPayload(encodedPayload);
      if (!payload || !payload.path) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      file = new File(decodeResourceFilePath(payload.path));
      if (!file.exists) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }

      file.encoding = "UTF-8";
      if (!file.open("r")) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }
      content = file.read();
      file.close();

      if (/\.json$/i.test(file.name)) {
        parsed = JSON.parse(content);
        content = parsed && typeof parsed.expression === "string"
          ? parsed.expression
          : parsed && typeof parsed.code === "string"
            ? parsed.code
            : "";
      }

      if (!content || !/\S/.test(content)) {
        return JSON.stringify({ ok: false, reason: "empty-expression" });
      }

      item = app.project && app.project.activeItem;
      properties = item && item.selectedProperties
        ? item.selectedProperties
        : [];

      for (index = 0; index < properties.length; index += 1) {
        if (properties[index] && properties[index].canSetExpression === true) {
          updatedProperties += 1;
        }
      }

      if (updatedProperties === 0) {
        return JSON.stringify({ ok: false, reason: "no-selected-property" });
      }

      app.beginUndoGroup("NYAWORKS Apply Expression");
      undoStarted = true;
      for (index = 0; index < properties.length; index += 1) {
        property = properties[index];
        if (property && property.canSetExpression === true) {
          property.expression = content;
        }
      }
      app.endUndoGroup();
      undoStarted = false;

      return JSON.stringify({
        ok: true,
        updatedItems: updatedProperties
      });
    } catch (error) {
      try {
        if (file && file.opened) {
          file.close();
        }
      } catch (ignoreFileClose) {}
      try {
        if (undoStarted) {
          app.endUndoGroup();
        }
      } catch (ignoreUndoClose) {}
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  function addSearchEffect(encodedPayload) {
    var payload;
    var layers;
    var index;
    try {
      payload = decodeSearchPayload(encodedPayload);
      layers = selectedLayers();
      if (!payload || !payload.matchName) return JSON.stringify({ ok: false, reason: "invalid-resource" });
      if (!layers || layers.length === 0) return JSON.stringify({ ok: false, reason: "no-selected-layer" });
      app.beginUndoGroup("NYAWORKS Add Effect");
      for (index = 0; index < layers.length; index += 1) layers[index].property("ADBE Effect Parade").addProperty(payload.matchName);
      app.endUndoGroup();
      return JSON.stringify({ ok: true });
    } catch (error) {
      try { app.endUndoGroup(); } catch (ignore) {}
      return JSON.stringify({ ok: false, reason: "host-error" });
    }
  }

  function anchorPositionFraction(position) {
    var fractions = {
      "top-left": [0, 0],
      "top": [0.5, 0],
      "top-right": [1, 0],
      "left": [0, 0.5],
      "center": [0.5, 0.5],
      "right": [1, 0.5],
      "bottom-left": [0, 1],
      "bottom": [0.5, 1],
      "bottom-right": [1, 1]
    };
    return fractions[position] || null;
  }

  function distance2d(first, second) {
    var dx = first[0] - second[0];
    var dy = first[1] - second[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function copyPropertyValue(value) {
    var result = [];
    var index;

    if (!value || typeof value.length !== "number") return null;
    for (index = 0; index < value.length; index += 1) {
      result.push(Number(value[index]) || 0);
    }
    return result;
  }

  // AE's direct AVLayer transform properties are more stable than looking up
  // every property through the Transform Group (especially for text layers in
  // AE 2025). Keep the conversion in one place so alignment and anchor-point
  // operations use the same values.
  function readPropertyValue(property, fallback) {
    var value;
    try {
      if (property && property.value !== undefined) {
        value = property.value;
        if (value && typeof value.length === "number") return copyPropertyValue(value);
        if (typeof value === "number") return Number(value);
      }
    } catch (ignorePropertyValue) {}
    return fallback;
  }

  function readLayerBounds(layer, time) {
    var rect;
    var source;
    var width;
    var height;

    // Text and shape layers expose sourceRectAtTime().  Keep this as the
    // preferred path because it reflects the visible contents at the current
    // time, but do not make the whole tool fail when an AE layer type does not.
    try {
      if (layer && layer.sourceRectAtTime) {
        rect = layer.sourceRectAtTime(time, false);
        if (
          rect &&
          isFiniteNumber(Number(rect.left)) &&
          isFiniteNumber(Number(rect.top)) &&
          isFiniteNumber(Number(rect.width)) &&
          isFiniteNumber(Number(rect.height))
        ) {
          return {
            left: Number(rect.left),
            top: Number(rect.top),
            width: Number(rect.width),
            height: Number(rect.height)
          };
        }
      }
    } catch (ignoreSourceRect) {}

    // Solids, footage and some older AE layer types are more reliable through
    // their source dimensions.  This also gives null-like layers a usable
    // zero-size anchor instead of classifying them as unsupported.
    try {
      source = layer && layer.source;
      width = source && Number(source.width);
      height = source && Number(source.height);
      if (isFiniteNumber(width) && isFiniteNumber(height)) {
        return { left: 0, top: 0, width: width, height: height };
      }
    } catch (ignoreSource) {}

    try {
      width = Number(layer && layer.width);
      height = Number(layer && layer.height);
      if (isFiniteNumber(width) && isFiniteNumber(height)) {
        return { left: 0, top: 0, width: width, height: height };
      }
    } catch (ignoreLayerSize) {}

    // Adjustment/null and a few third-party layer types do not expose a source
    // rectangle or source dimensions, but they still have a valid Transform
    // group and can safely use their local origin as the anchor bounds.
    // Returning a zero-size rect keeps the anchor operation usable instead of
    // incorrectly classifying the layer as unsupported.
    if (layer && layer.property("ADBE Transform Group")) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    return null;
  }

  function readPositionState(transform, layer) {
    var position = null;
    var xPosition;
    var yPosition;
    var zPosition;
    var value;

    // Prefer the direct AVLayer property. It works for text, shape, solid and
    // footage layers even when AE returns an incomplete Transform Group proxy.
    try { if (layer) position = layer.position; } catch (ignoreLayerPosition) {}
    if (!position && transform) {
      try { position = transform.property("ADBE Position"); } catch (ignoreTransformPosition) {}
    }
    if (!position) return null;
    if (!position.dimensionsSeparated) {
      value = readPropertyValue(position, null);
      if (!value) return null;
      return {
        property: position,
        separated: false,
        value: value
      };
    }

    if (transform) {
      try { xPosition = transform.property("ADBE Position_0"); } catch (ignoreXPosition) {}
      try { yPosition = transform.property("ADBE Position_1"); } catch (ignoreYPosition) {}
    }
    if (transform) {
      try { zPosition = transform.property("ADBE Position_2"); } catch (ignoreZPosition) {}
    }
    if (!xPosition || !yPosition) return null;

    return {
      property: position,
      separated: true,
      x: xPosition,
      y: yPosition,
      z: zPosition,
      value: [
        Number(readPropertyValue(xPosition, 0)) || 0,
        Number(readPropertyValue(yPosition, 0)) || 0,
        zPosition ? Number(readPropertyValue(zPosition, 0)) || 0 : 0
      ]
    };
  }

  function setPositionState(positionState, value) {
    if (!positionState.separated) {
      positionState.property.setValue(value);
      return;
    }

    positionState.x.setValue(value[0]);
    positionState.y.setValue(value[1]);
    if (positionState.z && value.length > 2) {
      positionState.z.setValue(value[2]);
    }
  }

  function applySimple2dCompensation(transform, positionState, targetAnchor, oldAnchor, oldPosition) {
    var scale;
    var rotation;
    var scaleX;
    var scaleY;
    var angle;
    var cosAngle;
    var sinAngle;
    var localX;
    var localY;
    var positionValue;

    scale = transform.property("ADBE Scale");
    rotation = transform.property("ADBE Rotate Z") || transform.property("ADBE Rotation");
    if (!scale || !rotation) return false;

    scale = scale.value;
    rotation = Number(rotation.value) || 0;
    scaleX = Number(scale[0]) / 100;
    scaleY = Number(scale[1]) / 100;
    angle = rotation * Math.PI / 180;
    cosAngle = Math.cos(angle);
    sinAngle = Math.sin(angle);
    localX = (targetAnchor[0] - oldAnchor[0]) * scaleX;
    localY = (targetAnchor[1] - oldAnchor[1]) * scaleY;
    positionValue = oldPosition.slice(0);
    positionValue[0] += localX * cosAngle - localY * sinAngle;
    positionValue[1] += localX * sinAngle + localY * cosAngle;
    setPositionState(positionState, positionValue);
    return true;
  }

  function compensateAnchorPoint(layer, positionName, time) {
    var fraction = anchorPositionFraction(positionName);
    var transform;
    var anchor;
    var position;
    var positionState;
    var rect;
    var probe;
    var before;
    var after;
    var oldAnchor;
    var targetAnchor;
    var oldPosition;
    var xProbe;
    var yProbe;
    var dxScreen;
    var dyScreen;
    var determinant;
    var deltaX;
    var deltaY;
    var xDerivative;
    var yDerivative;
    var xValue;
    var yValue;
    var zValue;

    // Do not rely on a strict AVLayer constructor check here.  In some AE ExtendScript
    // runtimes the constructor is not exposed consistently for shape layers,
    // even though they provide the full AVLayer transform API we need.
    if (!fraction || !layer || !layer.property) {
      return "unsupported-layer";
    }

    if (layer.locked) {
      return "locked-layer";
    }

    if (layer.matchName === "ADBE Camera Layer" || layer.matchName === "ADBE Light Layer") {
      return "unsupported-layer";
    }

    transform = layer.property("ADBE Transform Group");
    anchor = transform && transform.property("ADBE Anchor Point");
    if (!anchor) anchor = layer.anchorPoint;
    positionState = readPositionState(transform, layer);
    position = positionState && positionState.property;
    if (!transform || !anchor || !positionState || !position) {
      return "unsupported-layer";
    }

    if (anchor.expressionEnabled || position.expressionEnabled || anchor.numKeys > 0 || position.numKeys > 0) {
      return "expression-conflict";
    }

    try {
      rect = readLayerBounds(layer, time);
      if (!rect) {
        return "unsupported-layer";
      }
      oldAnchor = copyPropertyValue(anchor.value);
      oldPosition = positionState.value.slice(0);
      targetAnchor = [
        rect.left + rect.width * fraction[0],
        rect.top + rect.height * fraction[1]
      ];
      if (layer.threeDLayer) {
        targetAnchor.push(oldAnchor.length > 2 ? oldAnchor[2] : 0);
      }

      // 2D layers have a stable local transform path. Use it first so ordinary
      // text, shape, solid and footage layers do not depend on comp-space
      // probing (which can be unavailable for some AE layer types).
      if (!layer.threeDLayer) {
        anchor.setValue(targetAnchor);
        if (applySimple2dCompensation(
          transform,
          positionState,
          targetAnchor,
          oldAnchor,
          oldPosition
        )) {
          return "updated";
        }
        // A few layer types expose the anchor/position properties but omit
        // scale or rotation. The anchor change is still valid; only the
        // position-preserving compensation is unavailable.
        return "updated";
      }

      probe = [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5];
      if (typeof layer.sourcePointToComp !== "function") {
        anchor.setValue(targetAnchor);
        return "updated";
      }
      before = layer.sourcePointToComp(probe);

      anchor.setValue(targetAnchor);
      after = layer.sourcePointToComp(probe);
      dxScreen = before[0] - after[0];
      dyScreen = before[1] - after[1];

      setPositionState(positionState, oldPosition);
      xValue = oldPosition.slice(0);
      xValue[0] += 1;
      setPositionState(positionState, xValue);
      xProbe = layer.sourcePointToComp(probe);

      setPositionState(positionState, oldPosition);
      yValue = oldPosition.slice(0);
      yValue[1] += 1;
      setPositionState(positionState, yValue);
      yProbe = layer.sourcePointToComp(probe);
      setPositionState(positionState, oldPosition);

      xDerivative = [xProbe[0] - after[0], xProbe[1] - after[1]];
      yDerivative = [yProbe[0] - after[0], yProbe[1] - after[1]];
      determinant = xDerivative[0] * yDerivative[1] - yDerivative[0] * xDerivative[1];

      if (Math.abs(determinant) < 0.000001) {
        anchor.setValue(targetAnchor);
        return "updated";
      }

      deltaX = (dxScreen * yDerivative[1] - yDerivative[0] * dyScreen) / determinant;
      deltaY = (xDerivative[0] * dyScreen - dxScreen * xDerivative[1]) / determinant;
      xValue = oldPosition.slice(0);
      xValue[0] += deltaX;
      xValue[1] += deltaY;
      if (layer.threeDLayer && oldPosition.length > 2) {
        zValue = oldPosition[2];
        xValue[2] = zValue;
      }
      setPositionState(positionState, xValue);

      if (distance2d(layer.sourcePointToComp(probe), before) > 0.25) {
        anchor.setValue(targetAnchor);
        return "updated";
      }
      return "updated";
    } catch (error) {
      try {
        if (targetAnchor && oldAnchor && oldPosition && !layer.threeDLayer) {
          anchor.setValue(targetAnchor);
          if (applySimple2dCompensation(
            transform,
            positionState,
            targetAnchor,
            oldAnchor,
            oldPosition
          )) {
            return "updated";
          }
        }
      } catch (fallbackError) {}
      try { anchor.setValue(oldAnchor); } catch (ignoreAnchor) {}
      try { setPositionState(positionState, oldPosition); } catch (ignorePosition) {}
      return "host-error";
    }
  }

  function setAnchorPoint(encodedPayload) {
    var payload;
    var fraction;
    var layers;
    var index;
    var result;
    var updatedLayers = 0;
    var threeDLayers = 0;
    var firstFailure = null;
    var time;

    try {
      payload = decodeSearchPayload(encodedPayload);
      fraction = payload && anchorPositionFraction(payload.position);
      if (!fraction) return JSON.stringify({ ok: false, reason: "host-error" });
      layers = selectedLayers();
      if (!layers || layers.length === 0) return JSON.stringify({ ok: false, reason: "no-selected-layer" });
      time = app.project.activeItem.time;
      app.beginUndoGroup("NYAWORKS Set Anchor Point");
      for (index = 0; index < layers.length; index += 1) {
        result = compensateAnchorPoint(layers[index], payload.position, time);
        if (result === "updated") {
          updatedLayers += 1;
          if (layers[index].threeDLayer) threeDLayers += 1;
        } else if (!firstFailure) {
          firstFailure = result;
        }
      }
      app.endUndoGroup();
      if (updatedLayers === 0) {
        return JSON.stringify({ ok: false, reason: firstFailure || "host-error" });
      }
      return JSON.stringify({
        ok: true,
        updatedLayers: updatedLayers,
        threeDLayers: threeDLayers
      });
    } catch (error) {
      try { app.endUndoGroup(); } catch (ignore) {}
      return JSON.stringify({ ok: false, reason: "host-error" });
    }
  }

  function getActionContext() {
    try {
      var activeItem = app.project && app.project.activeItem;
      var layers = activeItem && activeItem instanceof CompItem
        ? activeItem.selectedLayers
        : [];
      return JSON.stringify({
        ok: true,
        activeComp: !!(activeItem && activeItem instanceof CompItem),
        selectedLayers: layers ? layers.length : 0,
        selectedKeys: 0
      });
    } catch (error) {
      return JSON.stringify({ ok: false, reason: "host-error" });
    }
  }

  function decodeLayerActionPayload(encodedPayload) {
    try {
      return JSON.parse(decodeURIComponent(encodedPayload || ""));
    } catch (error) {
      return null;
    }
  }

  function getLayerCreationContext() {
    var comp = app.project && app.project.activeItem;
    var selection;
    var start;
    var end;
    var insertionIndex = null;
    var insertionLayer = null;
    var index;
    var layer;

    if (!comp || !(comp instanceof CompItem)) return null;
    selection = comp.selectedLayers || [];
    start = Number(comp.displayStartTime) || 0;
    end = start + Number(comp.duration || 0);

    if (selection.length > 0) {
      start = Number(selection[0].inPoint);
      end = Number(selection[0].outPoint);
      insertionIndex = Number(selection[0].index);
      insertionLayer = selection[0];
      for (index = 1; index < selection.length; index += 1) {
        layer = selection[index];
        if (Number(layer.inPoint) < start) start = Number(layer.inPoint);
        if (Number(layer.outPoint) > end) end = Number(layer.outPoint);
        if (Number(layer.index) < insertionIndex) {
          insertionIndex = Number(layer.index);
          insertionLayer = layer;
        }
      }
    }

    return {
      comp: comp,
      selection: selection,
      start: start,
      end: end,
      insertionIndex: insertionIndex,
      insertionLayer: insertionLayer
    };
  }

  function applyLayerTiming(layer, context) {
    layer.startTime = context.start;
    layer.inPoint = context.start;
    layer.outPoint = context.end;
  }

  function placeLayerAboveSelection(layer, context) {
    var target = context.insertionLayer || null;
    if (target && typeof layer.moveBefore === "function") {
      layer.moveBefore(target);
    } else if (typeof layer.moveToBeginning === "function") {
      layer.moveToBeginning();
    }
  }

  function selectOnlyLayers(layers, comp) {
    var index;
    var current;
    for (index = 1; index <= comp.numLayers; index += 1) {
      try {
        current = comp.layer(index);
        if (current) current.selected = false;
      } catch (ignoreSelectionClear) {}
    }
    for (index = 0; index < layers.length; index += 1) {
      layers[index].selected = true;
    }
  }

  function layerTransformProperty(layer, matchName) {
    var transform = layer && layer.property("ADBE Transform Group");
    return transform && transform.property(matchName);
  }

  function setLayerCentered(layer, comp, anchor) {
    var anchorProperty = layerTransformProperty(layer, "ADBE Anchor Point");
    var positionProperty = layerTransformProperty(layer, "ADBE Position");
    if (anchorProperty) anchorProperty.setValue(anchor);
    if (positionProperty) positionProperty.setValue([comp.width / 2, comp.height / 2]);
  }

  function layerNameExists(comp, name, ignoredLayer) {
    var index;
    var layer;
    for (index = 1; index <= Number(comp && comp.numLayers || 0); index += 1) {
      layer = comp.layer(index);
      if (layer && layer !== ignoredLayer && String(layer.name || "") === name) return true;
    }
    try {
      for (index = 0; index < Number(comp.selectedLayers && comp.selectedLayers.length || 0); index += 1) {
        layer = comp.selectedLayers[index];
        if (layer && layer !== ignoredLayer && String(layer.name || "") === name) return true;
      }
    } catch (ignoreSelectedNameLookup) {}
    return false;
  }

  function uniqueLayerName(comp, baseName, ignoredLayer) {
    var candidate = baseName;
    var suffix = 2;
    while (layerNameExists(comp, candidate, ignoredLayer)) {
      candidate = baseName + " " + suffix;
      suffix += 1;
    }
    return candidate;
  }

  function readCreationCompBounds(layer, time) {
    var rect;
    var source;
    var transform;
    var anchorProperty;
    var positionProperty;
    var scaleProperty;
    var rotationProperty;
    var anchor;
    var position;
    var scale;
    var rotation;
    var points;
    var compPoints = [];
    var index;
    var localX;
    var localY;
    var radians;
    var cos;
    var sin;
    var x;
    var y;
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    try {
      if (layer.sourceRectAtTime) rect = layer.sourceRectAtTime(time, false);
    } catch (ignoreCreationSourceRect) {}
    if (!rect) {
      source = layer.source;
      if (source && Number(source.width) >= 0 && Number(source.height) >= 0) {
        rect = { left: 0, top: 0, width: Number(source.width), height: Number(source.height) };
      } else if (Number(layer.width) >= 0 && Number(layer.height) >= 0) {
        rect = { left: 0, top: 0, width: Number(layer.width), height: Number(layer.height) };
      }
    }
    if (!rect) return null;
    points = [
      [Number(rect.left), Number(rect.top)],
      [Number(rect.left) + Number(rect.width), Number(rect.top)],
      [Number(rect.left) + Number(rect.width), Number(rect.top) + Number(rect.height)],
      [Number(rect.left), Number(rect.top) + Number(rect.height)]
    ];
    try {
      if (typeof layer.sourcePointToComp === "function") {
        for (index = 0; index < points.length; index += 1) {
          compPoints.push(layer.sourcePointToComp(points[index]));
        }
      }
    } catch (ignoreCreationPointConversion) {
      compPoints = [];
    }
    if (compPoints.length === points.length) {
      for (index = 0; index < compPoints.length; index += 1) {
        if (!compPoints[index] || !isFinite(Number(compPoints[index][0])) || !isFinite(Number(compPoints[index][1]))) {
          compPoints = [];
          break;
        }
      }
    }
    if (compPoints.length !== points.length) {
      if (layer.parent || layer.threeDLayer) return null;
      transform = layer.property("ADBE Transform Group");
      anchorProperty = transform && transform.property("ADBE Anchor Point");
      positionProperty = transform && transform.property("ADBE Position");
      scaleProperty = transform && transform.property("ADBE Scale");
      rotationProperty = transform && (transform.property("ADBE Rotate Z") || transform.property("ADBE Rotation"));
      anchor = anchorProperty && anchorProperty.value;
      position = positionProperty && positionProperty.value;
      scale = scaleProperty && scaleProperty.value || [100, 100];
      rotation = Number(rotationProperty && rotationProperty.value || 0);
      if (!anchor || !position || anchor.length < 2 || position.length < 2) return null;
      radians = rotation * Math.PI / 180;
      cos = Math.cos(radians);
      sin = Math.sin(radians);
      for (index = 0; index < points.length; index += 1) {
        localX = (points[index][0] - Number(anchor[0])) * Number(scale[0]) / 100;
        localY = (points[index][1] - Number(anchor[1])) * Number(scale[1]) / 100;
        compPoints.push([
          Number(position[0]) + localX * cos - localY * sin,
          Number(position[1]) + localX * sin + localY * cos
        ]);
      }
    }
    for (index = 0; index < compPoints.length; index += 1) {
      if (!compPoints[index] || !isFinite(Number(compPoints[index][0])) || !isFinite(Number(compPoints[index][1]))) {
        return null;
      }
      x = Number(compPoints[index][0]);
      y = Number(compPoints[index][1]);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return { left: minX, top: minY, right: maxX, bottom: maxY };
  }

  function selectionCompBounds(context) {
    var result = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    var time = Number(context.comp.time);
    var index;
    var current;
    if (!context.selection.length) return null;
    if (!isFinite(time)) time = Number(context.start) || 0;
    for (index = 0; index < context.selection.length; index += 1) {
      current = readCreationCompBounds(context.selection[index], time);
      if (!current) return null;
      result.left = Math.min(result.left, current.left);
      result.top = Math.min(result.top, current.top);
      result.right = Math.max(result.right, current.right);
      result.bottom = Math.max(result.bottom, current.bottom);
    }
    return result;
  }

  function findLocalizedMenuCommand(candidates) {
    var index;
    var commandId;
    if (!app || typeof app.findMenuCommandId !== "function") return 0;
    for (index = 0; index < candidates.length; index += 1) {
      try {
        commandId = Number(app.findMenuCommandId(candidates[index])) || 0;
        if (commandId > 0) return commandId;
      } catch (ignoreMenuLookup) {}
    }
    return 0;
  }

  function executeMenuCommand(commandId) {
    if (!commandId || !app || typeof app.executeCommand !== "function") return false;
    try {
      app.executeCommand(commandId);
      return true;
    } catch (ignoreMenuExecution) {
      return false;
    }
  }

  function finishCreatedLayer(layer, context) {
    applyLayerTiming(layer, context);
    placeLayerAboveSelection(layer, context);
    selectOnlyLayers([layer], context.comp);
    return {
      ok: true,
      createdLayers: 1,
      updatedLayers: 0,
      createdItems: 0
    };
  }

  function getTextDocumentProperty(layer) {
    var textGroup = layer && layer.property("ADBE Text Properties");
    return textGroup && textGroup.property("ADBE Text Document");
  }

  function updateTextLayerContent(layer, text) {
    var textDocumentProperty = getTextDocumentProperty(layer);
    var textDocument = textDocumentProperty && textDocumentProperty.value;
    if (!textDocumentProperty || !textDocument) {
      throw new Error("not-a-text-layer");
    }
    textDocument.text = text;
    textDocumentProperty.setValue(textDocument);
  }

  function createTextLayer(context, text) {
    var comp = context.comp;
    var layer;
    // 文字层只保留一个稳定入口；不主动设置字体，让 AE 沿用当前“最近使用字体”。
    // 旧版本传入 ctrl 时也回退到同一个点文字行为，避免历史布局产生另一套逻辑。
    layer = comp.layers.addText(text);
    var rect = layer.sourceRectAtTime(context.start, false);
    setLayerCentered(layer, comp, [
      Number(rect.left) + Number(rect.width) / 2,
      Number(rect.top) + Number(rect.height) / 2
    ]);
    return finishCreatedLayer(layer, context);
  }

  function readSelectedTextLayer() {
    var comp = app.project ? app.project.activeItem : null;
    var selection;
    var layer;
    var textDocumentProperty;
    var textDocument;
    var token;
    if (!comp || !(comp instanceof CompItem)) {
      return JSON.stringify({ ok: false, reason: "no-active-comp" });
    }
    selection = comp.selectedLayers || [];
    if (selection.length !== 1) {
      return JSON.stringify({ ok: false, reason: "invalid-selection" });
    }
    layer = selection[0];
    textDocumentProperty = getTextDocumentProperty(layer);
    textDocument = textDocumentProperty && textDocumentProperty.value;
    if (!textDocument) {
      return JSON.stringify({ ok: false, reason: "unsupported-layer-type" });
    }
    token = "nya-text-" + String(new Date().getTime()) + "-" + String(Math.random());
    $.global.NYAWORKS_TEXT_LAYER_EDITOR_TARGET = {
      token: token,
      comp: comp,
      layer: layer
    };
    return JSON.stringify({
      ok: true,
      text: String(textDocument.text),
      layerName: String(layer.name || ""),
      targetId: token
    });
  }

  function applyTextLayerEdit(encodedPayload) {
    var payload = decodeLayerActionPayload(encodedPayload);
    var target = $.global.NYAWORKS_TEXT_LAYER_EDITOR_TARGET;
    var activeComp = app.project ? app.project.activeItem : null;
    var resolvedLayer;
    var undoStarted = false;
    if (!payload || typeof payload.targetId !== "string" || typeof payload.text !== "string") {
      return JSON.stringify({ ok: false, reason: "host-error", detail: "invalid-payload" });
    }
    if (!payload.text.length) {
      return JSON.stringify({ ok: false, reason: "empty-text" });
    }
    if (!target || target.token !== payload.targetId || activeComp !== target.comp) {
      return JSON.stringify({ ok: false, reason: "invalid-target" });
    }
    try {
      resolvedLayer = target.comp.layer(target.layer.index);
      if (resolvedLayer !== target.layer || !getTextDocumentProperty(target.layer)) {
        return JSON.stringify({ ok: false, reason: "invalid-target" });
      }
      app.beginUndoGroup("NYAWORKS Apply Text");
      undoStarted = true;
      updateTextLayerContent(target.layer, payload.text);
      return JSON.stringify({ ok: true, createdLayers: 0, updatedLayers: 1 });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "invalid-target",
        detail: error && error.toString ? error.toString() : "target-unavailable"
      });
    } finally {
      if (undoStarted) app.endUndoGroup();
    }
  }

  function createTextLayerFromEditor(encodedPayload) {
    var payload = decodeLayerActionPayload(encodedPayload);
    var context;
    var result;
    var undoStarted = false;
    if (!payload || typeof payload.text !== "string") {
      return JSON.stringify({ ok: false, reason: "host-error", detail: "invalid-payload" });
    }
    if (!payload.text.length) {
      return JSON.stringify({ ok: false, reason: "empty-text" });
    }
    context = getLayerCreationContext();
    if (!context) {
      return JSON.stringify({ ok: false, reason: "no-active-comp" });
    }
    try {
      app.beginUndoGroup("NYAWORKS Create Text");
      undoStarted = true;
      result = createTextLayer(context, payload.text);
      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "create-text-failed"
      });
    } finally {
      if (undoStarted) app.endUndoGroup();
    }
  }

  function createSolidLayer(context, modifier) {
    var comp = context.comp;
    var width;
    var height;
    // 纯色层不再承载修饰键扩展：始终创建 AE 原生黑色全合成 Solid，
    // 颜色直接由效果控件中的 Fill 效果控制，避免额外的“颜色控制”重复入口。
    width = comp.width;
    height = comp.height;
    var layer = comp.layers.addSolid(
      [0, 0, 0],
      uniqueLayerName(comp, "Nya 纯色", null),
      width,
      height,
      comp.pixelAspect,
      comp.duration
    );
    var effects = layer.property("ADBE Effect Parade");
    var fill = effects && effects.addProperty("ADBE Fill");
    var color = fill && fill.property("ADBE Fill-0002");
    if (color) {
      color.setValue([0, 0, 0]);
    }
    return finishCreatedLayer(layer, context);
  }

  function addLayerControl(layer, matchName, name, value) {
    var effects = layer.property("ADBE Effect Parade");
    var control;
    var property;
    if (!effects || typeof effects.addProperty !== "function") return null;
    try {
      control = effects.addProperty(matchName);
    } catch (ignoreControlCreation) {
      return null;
    }
    if (!control) return null;
    control.name = name;
    property = control.property(1);
    if (property && typeof property.setValue === "function" && typeof value !== "undefined") {
      try {
        property.setValue(value);
      } catch (ignoreControlValue) {
        // Layer Control 的“无目标”在不同 AE 版本中可能不接受数值 0。
        // 控件本身仍然保留，让用户可以在效果控件中手动指定目标图层。
      }
    }
    return property;
  }

  function setShapeExpression(property, expression) {
    if (!property) return false;
    property.expression = expression;
    property.expressionEnabled = true;
    return true;
  }

  function addShapeFill(contents) {
    var fill = contents.addProperty("ADBE Vector Graphic - Fill");
    var color = fill && fill.property("ADBE Vector Fill Color");
    if (color) color.setValue([1, 1, 1]);
  }

  function preflightRoundedRectangleTemplate(extensionRoot) {
    if (typeof extensionRoot !== "string") {
      throw new Error("pseudo-extension-root-unavailable");
    }
    var driveLetter = extensionRoot.charAt(0).toUpperCase();
    var driveRoot = driveLetter >= "A" && driveLetter <= "Z" &&
      extensionRoot.charAt(1) === ":" &&
      (extensionRoot.charAt(2) === "/" || extensionRoot.charAt(2) === "\\");
    if (!driveRoot && extensionRoot.charAt(0) !== "/") {
      throw new Error("pseudo-extension-root-unavailable");
    }
    while (extensionRoot.length > 1 &&
           (extensionRoot.charAt(extensionRoot.length - 1) === "/" ||
            extensionRoot.charAt(extensionRoot.length - 1) === "\\")) {
      extensionRoot = extensionRoot.substring(0, extensionRoot.length - 1);
    }
    var root = extensionRoot + "/host/pseudo-effects/";
    var catalogFile = new File(root + "catalog.json");
    var template;
    var catalog;
    var file;
    if (!catalogFile.exists) {
      throw new Error("pseudo-catalog-missing: " + catalogFile.fsName);
    }
    if (!catalogFile.open("r")) {
      throw new Error(
        "pseudo-catalog-unreadable: " + catalogFile.fsName +
        " (" + (catalogFile.error || "unknown") + ")"
      );
    }
    try {
      catalog = JSON.parse(catalogFile.read());
    } finally {
      catalogFile.close();
    }
    template = catalog.templates && catalog.templates["shape.roundedRectangle/v7/zh-CN"];
    if (!template || template.file !== "rounded-rectangle-zh-CN.ffx" ||
        template.matchName !== "Pseudo/NYA_RRect_v7_zhCN") {
      throw new Error("pseudo-template-invalid");
    }
    file = new File(root + template.file);
    if (!file.exists) throw new Error("pseudo-template-missing");
    return { file: file, definition: template };
  }

  function applyRoundedRectangleTemplate(layer, context, template) {
    var selected = context.selection;
    var selectedProperties = context.comp.selectedProperties || [];
    var effects = layer.property("ADBE Effect Parade");
    var before = effects ? effects.numProperties : -1;
    var effect;
    var index;
    var mapping = template.definition.parameters;
    var keys = [
      "width", "height", "radius", "separate",
      "topLeftPercent", "topRightPercent", "bottomRightPercent", "bottomLeftPercent",
      "fillEnabled", "fillColor", "strokeEnabled", "strokeColor", "strokeWidth"
    ];
    if (before < 0 || !mapping) throw new Error("pseudo-effects-unavailable");
    try {
      for (index = 0; index < selected.length; index += 1) selected[index].selected = false;
      for (index = 0; index < selectedProperties.length; index += 1) {
        selectedProperties[index].selected = false;
      }
      layer.selected = true;
      layer.applyPreset(template.file);
    } finally {
      layer.selected = false;
      for (index = 0; index < selected.length; index += 1) selected[index].selected = true;
      for (index = 0; index < selectedProperties.length; index += 1) {
        try { selectedProperties[index].selected = true; } catch (ignoreRemovedProperty) {}
      }
    }
    effects = layer.property("ADBE Effect Parade");
    if (!effects || effects.numProperties !== before + 1) {
      throw new Error("pseudo-effect-count-mismatch");
    }
    effect = effects.property(before + 1);
    var markerIndex = template.definition.marker && template.definition.marker.index;
    if (!effect || effect.matchName !== template.definition.matchName ||
        !markerIndex || !effect.property(markerIndex) ||
        effect.property(markerIndex).name !== template.definition.marker.name) {
      throw new Error("pseudo-effect-signature-mismatch");
    }
    for (index = 0; index < keys.length; index += 1) {
      var parameterIndex = mapping[keys[index]];
      var parameter = effect.property(parameterIndex);
      if (!parameter || parameter.matchName !==
          template.definition.matchName + "-" + ("000" + parameterIndex).slice(-4)) {
        throw new Error("pseudo-parameter-mismatch-" + keys[index]);
      }
    }
    return effect;
  }

  function createRoundedRectangleShape(layer, contents, context, template) {
    var path = contents.addProperty("ADBE Vector Shape - Group");
    var pathProperty = path.property("ADBE Vector Shape");
    var fill;
    var fillIndex;
    var fillColor;
    var fillOpacity;
    var stroke;
    var strokeIndex;
    var strokeColor;
    var strokeOpacity;
    var strokeWidth;
    path.name = "Nya 圆角矩形";
    applyRoundedRectangleTemplate(layer, context, template);
    setShapeExpression(pathProperty, [
      'w=Math.max(0,effect("Nya 圆角矩形")(1));',
      'h=Math.max(0,effect("Nya 圆角矩形")(2));',
      'round=Math.max(0,effect("Nya 圆角矩形")(3));',
      'separate=effect("Nya 圆角矩形")(4)>0;',
      'limit=Math.min(w,h)/2;',
      'tl=Math.min(limit,Math.max(0,separate?effect("Nya 圆角矩形")(6):round)*limit/100);',
      'tr=Math.min(limit,Math.max(0,separate?effect("Nya 圆角矩形")(7):round)*limit/100);',
      'br=Math.min(limit,Math.max(0,separate?effect("Nya 圆角矩形")(8):round)*limit/100);',
      'bl=Math.min(limit,Math.max(0,separate?effect("Nya 圆角矩形")(9):round)*limit/100);',
      'hw=w/2;hh=h/2;k=0.5522847498;',
      'points=[[-hw+tl,-hh],[hw-tr,-hh],[hw,-hh+tr],[hw,hh-br],[hw-br,hh],[-hw+bl,hh],[-hw,hh-bl],[-hw,-hh+tl]];',
      'ins=[[-k*tl,0],[0,0],[0,-k*tr],[0,0],[k*br,0],[0,0],[0,k*bl],[0,0]];',
      'outs=[[0,0],[k*tr,0],[0,0],[0,k*br],[0,0],[-k*bl,0],[0,0],[0,-k*tl]];',
      'createPath(points,ins,outs,true);'
    ].join("\n"));
    if (pathProperty.expressionError) throw new Error("pseudo-expression-invalid");

    fill = contents.addProperty("ADBE Vector Graphic - Fill");
    fillIndex = fill && fill.propertyIndex;
    stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
    strokeIndex = stroke && stroke.propertyIndex;
    // Adding a property to an AE indexed group invalidates previously held
    // Property references, so reacquire both operators after all additions.
    fill = fillIndex ? contents.property(fillIndex) : null;
    stroke = strokeIndex ? contents.property(strokeIndex) : null;
    fillColor = fill && fill.property("ADBE Vector Fill Color");
    fillOpacity = fill && fill.property("ADBE Vector Fill Opacity");
    strokeColor = stroke && stroke.property("ADBE Vector Stroke Color");
    strokeOpacity = stroke && stroke.property("ADBE Vector Stroke Opacity");
    strokeWidth = stroke && stroke.property("ADBE Vector Stroke Width");
    if (!fillColor || !fillOpacity || !strokeColor || !strokeOpacity || !strokeWidth) {
      throw new Error("pseudo-style-properties-unavailable");
    }
    setShapeExpression(fillOpacity, 'effect("Nya 圆角矩形")(12)>0?100:0');
    setShapeExpression(fillColor, 'effect("Nya 圆角矩形")(13)');
    setShapeExpression(strokeOpacity, 'effect("Nya 圆角矩形")(14)>0?100:0');
    setShapeExpression(strokeColor, 'effect("Nya 圆角矩形")(15)');
    setShapeExpression(strokeWidth, 'Math.max(0,effect("Nya 圆角矩形")(16))');
    if (fillOpacity.expressionError || fillColor.expressionError ||
        strokeOpacity.expressionError || strokeColor.expressionError ||
        strokeWidth.expressionError) {
      throw new Error("pseudo-style-expression-invalid");
    }
  }

  function createEllipseShape(layer, contents) {
    var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
    var size = ellipse.property("ADBE Vector Ellipse Size");
    ellipse.name = "Nya 圆";
    addLayerControl(layer, "ADBE Slider Control", "Nya 半径", 250);
    setShapeExpression(size, 'r=Math.max(0,effect("Nya 半径")(1));[r*2,r*2]');
  }

  function createPolygonShape(layer, contents, isStar) {
    var star = contents.addProperty("ADBE Vector Shape - Star");
    var type = star.property("ADBE Vector Star Type");
    var points = star.property("ADBE Vector Star Points");
    var outerRadius = star.property("ADBE Vector Star Outer Radius");
    var rotation = star.property("ADBE Vector Star Rotation");
    var outerRoundness = star.property("ADBE Vector Star Outer Roundness") ||
      star.property("ADBE Vector Star Outer Roundess");
    var innerRadius;
    var innerRoundness;
    star.name = isStar ? "Nya 星形" : "Nya 三角形";
    if (type && typeof type.setValue === "function") type.setValue(isStar ? 1 : 2);
    if (points && typeof points.setValue === "function") points.setValue(isStar ? 5 : 3);
    if (isStar) {
      addLayerControl(layer, "ADBE Slider Control", "Nya 角数", 5);
      addLayerControl(layer, "ADBE Slider Control", "Nya 外半径", 250);
      addLayerControl(layer, "ADBE Slider Control", "Nya 内半径", 125);
      addLayerControl(layer, "ADBE Angle Control", "Nya 旋转", 0);
      addLayerControl(layer, "ADBE Slider Control", "Nya 外圆角", 0);
      addLayerControl(layer, "ADBE Slider Control", "Nya 内圆角", 0);
      innerRadius = star.property("ADBE Vector Star Inner Radius");
      innerRoundness = star.property("ADBE Vector Star Inner Roundness") ||
        star.property("ADBE Vector Star Inner Roundess");
      setShapeExpression(points, 'Math.max(2,Math.round(effect("Nya 角数")(1)))');
      setShapeExpression(outerRadius, 'Math.max(0,effect("Nya 外半径")(1))');
      setShapeExpression(innerRadius, 'Math.max(0,Math.min(effect("Nya 内半径")(1),effect("Nya 外半径")(1)))');
      setShapeExpression(rotation, 'effect("Nya 旋转")(1)');
      setShapeExpression(outerRoundness, 'Math.max(0,Math.min(100,effect("Nya 外圆角")(1)))');
      setShapeExpression(innerRoundness, 'Math.max(0,Math.min(100,effect("Nya 内圆角")(1)))');
    } else {
      addLayerControl(layer, "ADBE Slider Control", "Nya 半径", 250);
      addLayerControl(layer, "ADBE Angle Control", "Nya 旋转", 0);
      addLayerControl(layer, "ADBE Slider Control", "Nya 圆角", 0);
      setShapeExpression(outerRadius, 'Math.max(0,effect("Nya 半径")(1))');
      setShapeExpression(rotation, 'effect("Nya 旋转")(1)');
      setShapeExpression(outerRoundness, 'Math.max(0,Math.min(100,effect("Nya 圆角")(1)))');
    }
  }

  function createShapeLayer(context, modifier, extensionRoot) {
    var template = modifier === "none" ? preflightRoundedRectangleTemplate(extensionRoot) : null;
    var layer = context.comp.layers.addShape();
    var root;
    var group;
    var contents;
    var names = {
      none: "Nya 圆角矩形",
      alt: "Nya 圆",
      ctrl: "Nya 三角形",
      shift: "Nya 星形"
    };
    try {
      root = layer.property("ADBE Root Vectors Group");
      group = root.addProperty("ADBE Vector Group");
      contents = group.property("ADBE Vectors Group");
      layer.name = uniqueLayerName(context.comp, names[modifier] || names.none, layer);
      group.name = layer.name;
      if (modifier === "alt") {
        createEllipseShape(layer, contents);
      } else if (modifier === "ctrl") {
        createPolygonShape(layer, contents, false);
      } else if (modifier === "shift") {
        createPolygonShape(layer, contents, true);
      } else {
        createRoundedRectangleShape(layer, contents, context, template);
      }
      if (modifier !== "none") addShapeFill(contents);
      setLayerCentered(layer, context.comp, [0, 0]);
      return finishCreatedLayer(layer, context);
    } catch (error) {
      try { layer.remove(); } catch (ignoreCleanup) {}
      for (var index = 0; index < context.selection.length; index += 1) {
        try { context.selection[index].selected = true; } catch (ignoreSelectionRestore) {}
      }
      throw error;
    }
  }

  function createAdjustmentLayer(context) {
    var comp = context.comp;
    var layer = comp.layers.addSolid(
      [1, 1, 1],
      "Nya Adjustment",
      comp.width,
      comp.height,
      comp.pixelAspect,
      comp.duration
    );
    layer.adjustmentLayer = true;
    return finishCreatedLayer(layer, context);
  }

  function readLayerPositionForController(layer) {
    var anchor = layerTransformProperty(layer, "ADBE Anchor Point");
    var position = layerTransformProperty(layer, "ADBE Position");
    var value = position && position.value;
    var compPoint;
    if (layer && layer.parent && anchor) {
      try {
        if (typeof layer.sourcePointToComp === "function") {
          compPoint = layer.sourcePointToComp(anchor.value || [0, 0]);
        }
      } catch (ignoreControllerSourcePoint) {}
      try {
        if (!compPoint && typeof layer.toComp === "function") {
          compPoint = layer.toComp(anchor.value || [0, 0, 0]);
        }
      } catch (ignoreControllerToComp) {}
      if (compPoint && compPoint.length >= 2) {
        return [
          Number(compPoint[0]) || 0,
          Number(compPoint[1]) || 0,
          compPoint.length > 2 ? Number(compPoint[2]) || 0 : 0
        ];
      }
    }
    if (!value || value.length < 2) return null;
    return [
      Number(value[0]) || 0,
      Number(value[1]) || 0,
      value.length > 2 ? Number(value[2]) || 0 : 0
    ];
  }

  function averageControllerPosition(layers, comp) {
    var total = [0, 0, 0];
    var valid = 0;
    var index;
    var position;
    for (index = 0; index < layers.length; index += 1) {
      position = readLayerPositionForController(layers[index]);
      if (position) {
        total[0] += position[0];
        total[1] += position[1];
        total[2] += position[2];
        valid += 1;
      }
    }
    return valid > 0
      ? [total[0] / valid, total[1] / valid, total[2] / valid]
      : [comp.width / 2, comp.height / 2, 0];
  }

  function createGuideNull(context, position, isThreeD, name) {
    var layer = context.comp.layers.addNull(context.comp.duration);
    var anchor = [Number(layer.width || 100) / 2, Number(layer.height || 100) / 2];
    var targetPosition = [position[0], position[1]];
    layer.name = uniqueLayerName(context.comp, name || "Nya 控制", layer);
    layer.guideLayer = true;
    layer.threeDLayer = !!isThreeD;
    if (isThreeD) {
      anchor.push(0);
      targetPosition.push(position.length > 2 ? position[2] : 0);
    }
    layerTransformProperty(layer, "ADBE Anchor Point").setValue(anchor);
    layerTransformProperty(layer, "ADBE Position").setValue(targetPosition);
    applyLayerTiming(layer, context);
    return layer;
  }

  function validateControllerSelection(selection) {
    var index;
    for (index = 0; index < selection.length; index += 1) {
      if (!selection[index] || selection[index].locked || selection[index].parent) {
        return { ok: false, reason: "invalid-selection", detail: "locked-missing-or-parented-layer" };
      }
    }
    return { ok: true };
  }

  function createNullLayer(context, modifier) {
    var validation = validateControllerSelection(context.selection);
    var controllers = [];
    var controller;
    var target;
    var position;
    var targetContext;
    var index;
    var isThreeD = modifier === "shift";
    if (!validation.ok) return validation;

    if (modifier === "alt" && context.selection.length > 0) {
      for (index = 0; index < context.selection.length; index += 1) {
        target = context.selection[index];
        position = readLayerPositionForController(target) || [context.comp.width / 2, context.comp.height / 2, 0];
        targetContext = {
          comp: context.comp,
          selection: [target],
          start: Number(target.inPoint),
          end: Number(target.outPoint),
          insertionIndex: Number(target.index),
          insertionLayer: target
        };
        controller = createGuideNull(targetContext, position, !!target.threeDLayer, "Nya 控制");
        placeLayerAboveSelection(controller, targetContext);
        target.parent = controller;
        controllers.push(controller);
      }
    } else {
      for (index = 0; index < context.selection.length; index += 1) {
        if (context.selection[index].threeDLayer) isThreeD = true;
      }
      position = averageControllerPosition(context.selection, context.comp);
      controller = createGuideNull(context, position, isThreeD, "Nya 控制");
      placeLayerAboveSelection(controller, context);
      for (index = 0; index < context.selection.length; index += 1) {
        context.selection[index].parent = controller;
      }
      controllers.push(controller);
    }

    selectOnlyLayers(controllers, context.comp);
    return {
      ok: true,
      createdLayers: controllers.length,
      updatedLayers: context.selection.length,
      createdItems: 0
    };
  }

  function expressionLayerName(name) {
    return String(name || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function addCameraControllerControls(controller, position) {
    var positionProperty = layerTransformProperty(controller, "ADBE Position");
    var rotateX = layerTransformProperty(controller, "ADBE Rotate X");
    var rotateY = layerTransformProperty(controller, "ADBE Rotate Y");
    var rotateZ = layerTransformProperty(controller, "ADBE Rotate Z");
    addLayerControl(controller, "ADBE Layer Control", "Nya 目标图层", 0);
    addLayerControl(controller, "ADBE Slider Control", "Nya 相机位置 X", position[0]);
    addLayerControl(controller, "ADBE Slider Control", "Nya 相机位置 Y", position[1]);
    addLayerControl(controller, "ADBE Slider Control", "Nya 相机位置 Z", position[2]);
    addLayerControl(controller, "ADBE Angle Control", "Nya 相机旋转 X", 0);
    addLayerControl(controller, "ADBE Angle Control", "Nya 相机旋转 Y", 0);
    addLayerControl(controller, "ADBE Angle Control", "Nya 相机旋转 Z", 0);
    addLayerControl(controller, "ADBE Checkbox Control", "Nya 自动移动", 0);
    addLayerControl(controller, "ADBE Slider Control", "Nya 移动速度", 0);
    addLayerControl(controller, "ADBE Slider Control", "Nya 镜头焦距", 35);
    addLayerControl(controller, "ADBE Checkbox Control", "Nya 镜头景深", 0);
    addLayerControl(controller, "ADBE Checkbox Control", "Nya 焦点自动", 0);
    addLayerControl(controller, "ADBE Slider Control", "Nya 焦点距离", 1000);
    addLayerControl(controller, "ADBE Slider Control", "Nya 抖动强度", 0);
    addLayerControl(controller, "ADBE Slider Control", "Nya 抖动频率", 2);
    setShapeExpression(positionProperty, [
      'base=[effect("Nya 相机位置 X")(1),effect("Nya 相机位置 Y")(1),effect("Nya 相机位置 Z")(1)];',
      'moving=effect("Nya 自动移动")(1)>0;',
      'speed=effect("Nya 移动速度")(1);',
      'amount=Math.max(0,effect("Nya 抖动强度")(1));',
      'frequency=Math.max(0,effect("Nya 抖动频率")(1));',
      'result=base+[0,0,moving?time*speed:0];',
      'amount>0?result+(wiggle(frequency,amount)-value):result;'
    ].join("\n"));
    setShapeExpression(rotateX, 'effect("Nya 相机旋转 X")(1)');
    setShapeExpression(rotateY, 'effect("Nya 相机旋转 Y")(1)');
    setShapeExpression(rotateZ, 'effect("Nya 相机旋转 Z")(1)');
  }

  function configureCameraFromController(camera, controller, comp) {
    var options = camera.property("ADBE Camera Options Group");
    var zoom = options && options.property("ADBE Camera Zoom");
    var depth = options && options.property("ADBE Camera Depth of Field");
    var focus = options && options.property("ADBE Camera Focus Distance");
    var pointOfInterest = layerTransformProperty(camera, "ADBE Point of Interest");
    var controllerName = expressionLayerName(controller.name);
    if (zoom) setShapeExpression(zoom, 'thisComp.width*thisComp.layer("' + controllerName + '").effect("Nya 镜头焦距")(1)/36');
    if (depth) setShapeExpression(depth, 'thisComp.layer("' + controllerName + '").effect("Nya 镜头景深")(1)>0?1:0');
    if (focus) setShapeExpression(focus, [
      'ctrl=thisComp.layer("' + controllerName + '");',
      'target=ctrl.effect("Nya 目标图层")(1);',
      'autoFocus=ctrl.effect("Nya 焦点自动")(1)>0;',
      'autoFocus&&target?length(toWorld([0,0,0]),target.toWorld(target.anchorPoint)):ctrl.effect("Nya 焦点距离")(1);'
    ].join("\n"));
    if (pointOfInterest) setShapeExpression(pointOfInterest, [
      'ctrl=thisComp.layer("' + controllerName + '");',
      'target=ctrl.effect("Nya 目标图层")(1);',
      'target?fromWorld(target.toWorld(target.anchorPoint)):value;'
    ].join("\n"));
  }

  function setCamera35mm(camera, comp) {
    var options = camera.property("ADBE Camera Options Group");
    var zoom = options && options.property("ADBE Camera Zoom");
    if (zoom) zoom.setValue(Number(comp.width) * 35 / 36);
  }

  function createCameraRig(context, modifier) {
    var comp = context.comp;
    var center = averageControllerPosition(context.selection, comp);
    var commandId = 0;
    var camera;
    var controller;
    var result;
    if (modifier === "ctrl") {
      commandId = findLocalizedMenuCommand([
        "Camera Settings...", "Camera Settings…",
        "摄像机设置...", "摄像机设置…", "相机设置...", "相机设置…",
        "攝影機設定...", "攝影機設定…",
        "カメラ設定...", "カメラ設定…", "카메라 설정...", "카메라 설정…"
      ]);
      if (!commandId) return { ok: false, reason: "host-error", detail: "camera-settings-unavailable" };
    }
    camera = comp.layers.addCamera(uniqueLayerName(comp, "Nya 摄像机", null), [center[0], center[1]]);
    setCamera35mm(camera, comp);
    applyLayerTiming(camera, context);
    controller = createGuideNull(context, center, true, "Nya 摄像机控制");
    addCameraControllerControls(controller, center);
    camera.parent = controller;
    // Parent 后重新写入局部坐标，确保控制器位于合成中心时摄像机仍在
    // 控制器前方，而不是因为 AE 保留世界坐标造成位置偏移。
    var localPosition = layerTransformProperty(camera, "ADBE Position");
    var localPointOfInterest = layerTransformProperty(camera, "ADBE Point of Interest");
    if (localPosition) localPosition.setValue([0, 0, -1000]);
    if (localPointOfInterest) localPointOfInterest.setValue([0, 0, 0]);
    configureCameraFromController(camera, controller, comp);
    placeLayerAboveSelection(camera, context);
    if (typeof controller.moveBefore === "function") controller.moveBefore(camera);
    selectOnlyLayers([controller], comp);
    result = { ok: true, createdLayers: 2, updatedLayers: 0, createdItems: 0 };
    if (commandId) {
      selectOnlyLayers([camera], comp);
      if (!executeMenuCommand(commandId)) {
        return { ok: false, reason: "host-error", detail: "camera-settings-unavailable" };
      }
      selectOnlyLayers([controller], comp);
    }
    return result;
  }

  function projectItemNameExists(name) {
    var project = app.project;
    var index;
    if (!project) return false;
    for (index = 1; index <= Number(project.numItems || 0); index += 1) {
      if (project.item(index) && project.item(index).name === name) return true;
    }
    return false;
  }

  function uniqueProjectItemName(baseName) {
    var candidate = baseName;
    var suffix = 2;
    while (projectItemNameExists(candidate)) {
      candidate = baseName + " " + suffix;
      suffix += 1;
    }
    return candidate;
  }

  function selectedLayerIndices(selection) {
    var indices = [];
    var index;
    for (index = 0; index < selection.length; index += 1) {
      indices.push(Number(selection[index].index));
    }
    indices.sort(function (first, second) { return first - second; });
    return indices;
  }

  function findLayerForSource(comp, source) {
    var index;
    var layer;
    for (index = 1; index <= comp.numLayers; index += 1) {
      layer = comp.layer(index);
      if (layer && layer.source === source) return layer;
    }
    return comp.selectedLayers && comp.selectedLayers.length === 1
      ? comp.selectedLayers[0]
      : null;
  }

  function shiftPropertyForCrop(property, offsetX, offsetY) {
    var value;
    var index;
    if (!property || property.expressionEnabled || property.expression) return false;
    try {
      if (Number(property.numKeys || 0) > 0) {
        for (index = 1; index <= property.numKeys; index += 1) {
          value = property.keyValue(index);
          if (!value || value.length < 2) return false;
          value = value.slice(0);
          value[0] = Number(value[0]) - offsetX;
          value[1] = Number(value[1]) - offsetY;
          property.setValueAtKey(index, value);
        }
        return true;
      }
      value = property.value;
      if (!value || value.length < 2) return false;
      value = value.slice(0);
      value[0] = Number(value[0]) - offsetX;
      value[1] = Number(value[1]) - offsetY;
      property.setValue(value);
      return true;
    } catch (ignoreCropPosition) {
      return false;
    }
  }

  function selectionContainsLayer(selection, target) {
    var index;
    for (index = 0; index < selection.length; index += 1) {
      if (selection[index] === target) return true;
    }
    return false;
  }

  function canCropSelection(selection) {
    var index;
    var layer;
    var position;
    var value;
    for (index = 0; index < selection.length; index += 1) {
      layer = selection[index];
      if (layer.parent && selectionContainsLayer(selection, layer.parent)) continue;
      if (layer.parent) return false;
      position = layerTransformProperty(layer, "ADBE Position");
      if (!position || position.expressionEnabled || position.expression) return false;
      try {
        if (Number(position.numKeys || 0) > 0) {
          if (typeof position.keyValue !== "function" || typeof position.setValueAtKey !== "function") return false;
          value = position.keyValue(1);
        } else {
          if (typeof position.setValue !== "function") return false;
          value = position.value;
        }
      } catch (ignoreCropPreflight) {
        return false;
      }
      if (!value || value.length < 2) return false;
    }
    return true;
  }

  function trimPrecompTiming(source, layer, start, end) {
    var duration = Math.max(0.001, Number(end) - Number(start));
    var index;
    var child;
    for (index = 1; index <= Number(source.numLayers || 0); index += 1) {
      child = source.layer(index);
      if (!child) continue;
      child.startTime = Number(child.startTime) - Number(start);
      child.inPoint = Math.max(0, Math.min(duration, Number(child.inPoint) - Number(start)));
      child.outPoint = Math.max(
        child.inPoint,
        Math.min(duration, Number(child.outPoint) - Number(start))
      );
    }
    source.displayStartTime = 0;
    source.duration = duration;
    layer.startTime = Number(start);
    layer.inPoint = Number(start);
    layer.outPoint = Number(end);
  }

  function cropPrecompToBounds(source, layer, bounds) {
    var left = Math.floor(Number(bounds.left));
    var top = Math.floor(Number(bounds.top));
    var right = Math.ceil(Number(bounds.right));
    var bottom = Math.ceil(Number(bounds.bottom));
    var width = Math.max(1, right - left);
    var height = Math.max(1, bottom - top);
    var index;
    var child;
    var position;
    for (index = 1; index <= Number(source.numLayers || 0); index += 1) {
      child = source.layer(index);
      if (!child || child.parent) continue;
      position = layerTransformProperty(child, "ADBE Position");
      if (!shiftPropertyForCrop(position, left, top)) return false;
    }
    source.width = width;
    source.height = height;
    layerTransformProperty(layer, "ADBE Anchor Point").setValue([width / 2, height / 2]);
    layerTransformProperty(layer, "ADBE Position").setValue([
      left + width / 2,
      top + height / 2
    ]);
    return true;
  }

  function precomposeSelected(context, modifier) {
    var selection = context.selection;
    var topLayer = selection[0];
    var index;
    var indices;
    var name;
    var source;
    var layer;
    var bounds = null;
    var commandId = 0;
    if (!selection.length) return { ok: false, reason: "no-selected-layer" };
    if (modifier === "alt") {
      bounds = selectionCompBounds(context);
      if (!bounds || !canCropSelection(selection)) {
        return { ok: false, reason: "invalid-selection", detail: "precomp-bounds-unavailable" };
      }
    }
    if (modifier === "settings") {
      commandId = findLocalizedMenuCommand([
        "Composition Settings...", "Composition Settings…",
        "合成设置...", "合成设置…",
        "合成設定...", "合成設定…",
        "コンポジション設定...", "コンポジション設定…",
        "컴포지션 설정...", "컴포지션 설정…"
      ]);
      if (!commandId) return { ok: false, reason: "host-error", detail: "composition-settings-unavailable" };
    }
    for (index = 1; index < selection.length; index += 1) {
      if (Number(selection[index].index) < Number(topLayer.index)) topLayer = selection[index];
    }
    indices = selectedLayerIndices(selection);
    name = uniqueProjectItemName(String(topLayer.name || "Layer") + " Precomp");
    source = context.comp.layers.precompose(indices, name, true);
    layer = findLayerForSource(context.comp, source);
    if (!layer) return { ok: false, reason: "host-error", detail: "precomp-layer-not-found" };
    trimPrecompTiming(source, layer, context.start, context.end);
    if (bounds && !cropPrecompToBounds(source, layer, bounds)) {
      return { ok: false, reason: "invalid-selection", detail: "precomp-bounds-unsupported" };
    }
    selectOnlyLayers([layer], context.comp);
    if (commandId) {
      if (typeof source.openInViewer !== "function") {
        return { ok: false, reason: "host-error", detail: "composition-viewer-unavailable" };
      }
      source.openInViewer();
      if (!executeMenuCommand(commandId)) {
        return { ok: false, reason: "host-error", detail: "composition-settings-unavailable" };
      }
    }
    return { ok: true, createdLayers: 1, updatedLayers: 0, createdItems: 1 };
  }

  function propertyIsDefault(property, expected) {
    var value;
    var index;
    if (!property || Number(property.numKeys || 0) > 0 || property.expressionEnabled || property.expression) {
      return false;
    }
    value = property.value;
    if (expected && typeof expected.length === "number") {
      if (!value || value.length < expected.length) return false;
      for (index = 0; index < expected.length; index += 1) {
        if (Math.abs(Number(value[index]) - Number(expected[index])) > 0.0001) return false;
      }
      return true;
    }
    return Math.abs(Number(value) - Number(expected)) <= 0.0001;
  }

  function numbersAreClose(first, second) {
    return Math.abs(Number(first) - Number(second)) <= 0.0001;
  }

  function layerHasTrackMatteDependency(layer) {
    var matteType;
    var normalized;
    try {
      if (layer && (layer.hasTrackMatte || layer.isTrackMatte)) return true;
    } catch (ignoreModernTrackMatte) {}
    try {
      matteType = layer && layer.trackMatteType;
      if (typeof matteType === "undefined" || matteType === null) return false;
      if (typeof TrackMatteType !== "undefined") {
        return matteType !== TrackMatteType.NO_TRACK_MATTE;
      }
      normalized = String(matteType).toUpperCase();
      return normalized !== "NO_TRACK_MATTE" &&
        normalized !== "TRACKMATTETYPE.NO_TRACK_MATTE" &&
        normalized !== "0";
    } catch (ignoreLegacyTrackMatte) {
      return true;
    }
  }

  function layerUsesNormalBlending(layer) {
    var mode;
    try {
      mode = layer && layer.blendingMode;
      if (typeof mode === "undefined" || mode === null) return true;
      if (typeof BlendingMode !== "undefined") return mode === BlendingMode.NORMAL;
      mode = String(mode).toUpperCase();
      return mode === "NORMAL" || mode === "BLENDINGMODE.NORMAL";
    } catch (ignoreBlendingMode) {
      return false;
    }
  }

  function propertyTreeHasUnsafeExpression(property) {
    var count;
    var index;
    var child;
    var expression;
    if (!property) return false;
    try {
      expression = String(property.expression || "");
      if (property.expressionEnabled && expression) {
        // thisComp / comp() 在解开后会指向不同的合成；其余常见表达式
        // 通过 copyToComp 可以原样保留，不应阻塞普通解预合成。
        if (/\bthisComp\b|\bcomp\s*\(/.test(expression)) return true;
      }
    } catch (ignoreExpressionRead) {}
    try {
      count = Number(property.numProperties || 0);
      for (index = 1; index <= count; index += 1) {
        child = property.property(index);
        if (propertyTreeHasUnsafeExpression(child)) return true;
      }
    } catch (ignorePropertyTraversal) {
      return false;
    }
    return false;
  }

  function layerStylesAreActive(layerStyles) {
    var count;
    var index;
    var style;
    var propertyCount;
    var propertyIndex;
    var candidate;
    var matchName;
    if (!layerStyles) return false;
    try {
      count = Number(layerStyles.numProperties || 0);
      for (index = 1; index <= count; index += 1) {
        style = layerStyles.property(index);
        if (!style) continue;
        try {
          if (style.enabled === true) return true;
          if (style.enabled === false) continue;
        } catch (ignoreStyleEnabled) {}
        propertyCount = Number(style.numProperties || 0);
        for (propertyIndex = 1; propertyIndex <= propertyCount; propertyIndex += 1) {
          candidate = style.property(propertyIndex);
          if (!candidate) continue;
          matchName = String(candidate.matchName || candidate.name || "").toLowerCase();
          if (matchName.indexOf("enable") >= 0 && Number(candidate.value) !== 0) return true;
        }
      }
    } catch (ignoreLayerStyleTraversal) {
      return false;
    }
    return false;
  }

  function sourceContainsLayer(source, target) {
    var index;
    if (!source || !target) return false;
    for (index = 1; index <= Number(source.numLayers || 0); index += 1) {
      if (source.layer(index) === target) return true;
    }
    return false;
  }

  function propertyGroupHasActiveItems(group, requireExplicitEnabled) {
    var count;
    var index;
    var item;
    var enabled;
    if (!group) return false;
    try {
      count = Number(group.numProperties || 0);
      for (index = 1; index <= count; index += 1) {
        item = group.property(index);
        if (!item) continue;
        try {
          enabled = item.enabled;
          if (enabled === false) continue;
          if (requireExplicitEnabled && enabled !== true) continue;
        } catch (ignoreItemEnabled) {}
        if (requireExplicitEnabled) continue;
        return true;
      }
    } catch (ignoreActiveGroupTraversal) {
      // 无法读取组内容时宁可保守拒绝，避免静默丢失效果或遮罩。
      return true;
    }
    return false;
  }

  function validateUnprecomposeOuter(layer, comp) {
    var source = layer && layer.source;
    var transform;
    var effects;
    var masks;
    var layerStyles;
    var anchorProperty;
    var positionProperty;
    var positionValue;
    if (!layer || !source || !(source instanceof CompItem)) {
      return { ok: false, reason: "unsupported-precomp", detail: "select-one-precomp-layer" };
    }
    if (
      layer.threeDLayer ||
      layer.collapseTransformation ||
      layer.parent ||
      layer.locked ||
      layer.enabled === false ||
      layer.audioEnabled === false ||
      layer.guideLayer ||
      layer.adjustmentLayer ||
      layer.solo ||
      layer.motionBlur ||
      layer.frameBlending ||
      layer.preserveTransparency ||
      layerHasTrackMatteDependency(layer) ||
      !layerUsesNormalBlending(layer)
    ) {
      return { ok: false, reason: "unsafe-unprecompose", detail: "outer-layer-dependency" };
    }
    if (layer.timeRemapEnabled || Number(layer.stretch) !== 100) {
      return { ok: false, reason: "unsafe-unprecompose", detail: "outer-time-modification" };
    }
    if (
      !numbersAreClose(layer.inPoint, layer.startTime) ||
      !numbersAreClose(layer.outPoint, Number(layer.startTime) + Number(source.duration))
    ) {
      return { ok: false, reason: "unsafe-unprecompose", detail: "outer-time-trimmed" };
    }
    effects = layer.property("ADBE Effect Parade");
    masks = layer.property("ADBE Mask Parade");
    layerStyles = layer.property("ADBE Layer Styles");
    if (
      propertyGroupHasActiveItems(effects, true) ||
      propertyGroupHasActiveItems(masks, true) ||
      layerStylesAreActive(layerStyles)
    ) {
      return { ok: false, reason: "unsafe-unprecompose", detail: "outer-effects-masks-or-styles" };
    }
    transform = layer.property("ADBE Transform Group");
    anchorProperty = transform && transform.property("ADBE Anchor Point");
    positionProperty = transform && transform.property("ADBE Position");
    if (
      !propertyIsDefault(anchorProperty, [source.width / 2, source.height / 2]) ||
      !propertyIsDefault(transform && transform.property("ADBE Scale"), [100, 100]) ||
      !propertyIsDefault(transform && (transform.property("ADBE Rotate Z") || transform.property("ADBE Rotation")), 0) ||
      !propertyIsDefault(transform && transform.property("ADBE Orientation"), [0, 0, 0]) ||
      !propertyIsDefault(transform && transform.property("ADBE Opacity"), 100)
    ) {
      return { ok: false, reason: "unsafe-unprecompose", detail: "outer-transform-not-default" };
    }
    if (!positionProperty || Number(positionProperty.numKeys || 0) > 0 || positionProperty.expressionEnabled || positionProperty.expression) {
      return { ok: false, reason: "unsafe-unprecompose", detail: "outer-transform-not-default" };
    }
    positionValue = positionProperty.value;
    if (!positionValue || positionValue.length < 2) {
      return { ok: false, reason: "unsafe-unprecompose", detail: "outer-transform-not-default" };
    }
    return {
      ok: true,
      source: source,
      offsetX: Number(positionValue[0]) - Number(source.width) / 2,
      offsetY: Number(positionValue[1]) - Number(source.height) / 2
    };
  }

  function validateUnprecomposeSource(source) {
    var index;
    var layer;
    for (index = 1; index <= source.numLayers; index += 1) {
      layer = source.layer(index);
      if (!layer) return { ok: false, reason: "unsafe-unprecompose", detail: "missing-source-layer" };
      if (layer.matchName === "ADBE Camera Layer" || layer.matchName === "ADBE Light Layer") {
        return { ok: false, reason: "unsafe-unprecompose", detail: "camera-or-light-content" };
      }
      if (layer.locked || layerHasTrackMatteDependency(layer)) {
        return { ok: false, reason: "unsafe-unprecompose", detail: "cross-layer-dependency" };
      }
      if (layer.parent && !sourceContainsLayer(source, layer.parent)) {
        return { ok: false, reason: "unsafe-unprecompose", detail: "cross-layer-dependency" };
      }
      if (propertyTreeHasUnsafeExpression(layer)) {
        return { ok: false, reason: "unsafe-unprecompose", detail: "source-expression" };
      }
    }
    return { ok: true };
  }

  function unprecomposeSelected(context) {
    var outer = context.selection[0];
    var outerValidation;
    var sourceValidation;
    var source;
    var copies = [];
    var pairs = [];
    var copy;
    var beforeCopy;
    var index;
    var pairIndex;
    var parentSource;
    var parentCopy;
    var delta;
    var offsetX;
    var offsetY;
    var anchor;
    if (context.selection.length !== 1) {
      return {
        ok: false,
        reason: context.selection.length === 0 ? "no-selected-layer" : "invalid-selection"
      };
    }
    outerValidation = validateUnprecomposeOuter(outer, context.comp);
    if (!outerValidation.ok) return outerValidation;
    source = outerValidation.source;
    offsetX = Number(outerValidation.offsetX) || 0;
    offsetY = Number(outerValidation.offsetY) || 0;
    sourceValidation = validateUnprecomposeSource(source);
    if (!sourceValidation.ok) return sourceValidation;
    delta = Number(outer.startTime) - Number(source.displayStartTime || 0);

    try {
      for (index = source.numLayers; index >= 1; index -= 1) {
        beforeCopy = context.comp.layer(1);
        try {
          source.layer(index).copyToComp(context.comp);
        } catch (copyError) {
          copy = context.comp.layer(1);
          if (copy && copy !== beforeCopy) copies.push(copy);
          throw copyError;
        }
        copy = context.comp.layer(1);
        if (!copy) throw new Error("copy-not-found");
        copies.push(copy);
        pairs.push({ sourceLayer: source.layer(index), copy: copy });
        copy.startTime = Number(copy.startTime) + delta;
        copy.inPoint = Number(copy.inPoint) + delta;
        copy.outPoint = Number(copy.outPoint) + delta;
        if ((offsetX !== 0 || offsetY !== 0) && !shiftPropertyForCrop(
          layerTransformProperty(copy, "ADBE Position"),
          -offsetX,
          -offsetY
        )) {
          throw new Error("position-restore-failed");
        }
      }
      for (pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
        parentSource = pairs[pairIndex].sourceLayer && pairs[pairIndex].sourceLayer.parent;
        if (!parentSource) continue;
        parentCopy = null;
        for (index = 0; index < pairs.length; index += 1) {
          if (pairs[index].sourceLayer === parentSource) {
            parentCopy = pairs[index].copy;
            break;
          }
        }
        if (!parentCopy) throw new Error("parent-restore-failed");
        pairs[pairIndex].copy.parent = parentCopy;
      }
      anchor = outer;
      for (index = 0; index < copies.length; index += 1) {
        copies[index].moveBefore(anchor);
        anchor = copies[index];
      }
      selectOnlyLayers(copies, context.comp);
      outer.remove();
      return { ok: true, createdLayers: copies.length, updatedLayers: 0, createdItems: 0 };
    } catch (error) {
      for (index = 0; index < copies.length; index += 1) {
        try { copies[index].remove(); } catch (ignoreCopyRemoval) {}
      }
      try { outer.selected = true; } catch (ignoreOuterSelectionRestore) {}
      return {
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "copy-failed"
      };
    }
  }

  function createLightLayer(context, modifier) {
    var comp = context.comp;
    var center = [comp.width / 2, comp.height / 2, 0];
    var layer = comp.layers.addLight(uniqueLayerName(comp, "Nya 灯光", null), [center[0], center[1]]);
    var lightTypes = {
      none: LightType.POINT,
      alt: LightType.SPOT,
      ctrl: LightType.PARALLEL,
      shift: LightType.AMBIENT
    };
    layer.lightType = lightTypes[modifier];
    var position = layerTransformProperty(layer, "ADBE Position");
    var pointOfInterest = layerTransformProperty(layer, "ADBE Point of Interest");
    if (position) {
      position.setValue(center);
    }
    if (pointOfInterest) pointOfInterest.setValue(center);
    return finishCreatedLayer(layer, context);
  }

  function runLayerAction(encodedPayload) {
    var payload = decodeLayerActionPayload(encodedPayload);
    var context;
    var result;
    var action;
    var modifier;
    var undoStarted = false;

    if (!payload || typeof payload.action !== "string") {
      return JSON.stringify({ ok: false, reason: "host-error", detail: "invalid-payload" });
    }
    action = payload.action;
    if (
      typeof payload.modifier !== "undefined" &&
      payload.modifier !== "none" &&
      payload.modifier !== "alt" &&
      payload.modifier !== "ctrl" &&
      payload.modifier !== "shift" &&
      payload.modifier !== "settings"
    ) {
      return JSON.stringify({ ok: false, reason: "host-error", detail: "invalid-modifier" });
    }
    modifier = payload.modifier || "none";
    if (action === "create-text" && modifier === "alt") {
      return JSON.stringify({ ok: false, reason: "host-error", detail: "text-editor-ui-required" });
    }
    context = getLayerCreationContext();
    if (!context) return JSON.stringify({ ok: false, reason: "no-active-comp" });
    if ((action === "precompose-selected" || action === "unprecompose-selected") && context.selection.length === 0) {
      return JSON.stringify({ ok: false, reason: "no-selected-layer" });
    }
    try {
      app.beginUndoGroup(
        action === "precompose-selected"
          ? "NYAWORKS Precompose"
          : action === "unprecompose-selected"
            ? "NYAWORKS Unprecompose"
            : "NYAWORKS Create Layer"
      );
      undoStarted = true;
      if (action === "create-text") {
        result = createTextLayer(context, "text");
      } else if (action === "create-solid") {
        result = createSolidLayer(context, modifier);
      } else if (action === "create-shape") {
        result = createShapeLayer(context, modifier, payload.extensionRoot);
      } else if (action === "create-adjustment") {
        result = createAdjustmentLayer(context, modifier);
      } else if (action === "create-null") {
        result = createNullLayer(context, modifier);
      } else if (action === "create-camera-rig") {
        result = createCameraRig(context, modifier);
      } else if (action === "create-light") {
        result = createLightLayer(context, modifier);
      } else if (action === "precompose-selected") {
        result = precomposeSelected(context, modifier);
      } else if (action === "unprecompose-selected") {
        result = unprecomposeSelected(context, modifier);
      } else {
        result = { ok: false, reason: "unsupported-layer-type" };
      }
      app.endUndoGroup();
      undoStarted = false;
      return JSON.stringify(result);
    } catch (error) {
      try {
        if (undoStarted) app.endUndoGroup();
      } catch (ignoreUndoClose) {}
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  function alignmentActionInfo(action) {
    var actions = {
      "left": { axis: "x", edge: "start" },
      "center-x": { axis: "x", edge: "center" },
      "right": { axis: "x", edge: "end" },
      "top": { axis: "y", edge: "start" },
      "center-y": { axis: "y", edge: "center" },
      "bottom": { axis: "y", edge: "end" }
    };
    return actions[action] || null;
  }

  function readCompPoint(layer, point) {
    var result;
    var compPoint = [point[0], point[1], point.length > 2 ? point[2] : 0];
    // AVLayer.sourcePointToComp always receives a two-value source-space
    // point, including when the layer's 3D switch is enabled. Try this stable
    // AE API first; three-value calls can return plausible but wrong results.
    try {
      if (layer && typeof layer.sourcePointToComp === "function") {
        result = layer.sourcePointToComp([point[0], point[1]]);
        if (result && result.length >= 2) return result;
      }
    } catch (ignoreSourcePointToComp2d) {}
    try {
      if (layer && typeof layer.toComp === "function") {
        result = layer.toComp(compPoint);
        if (result && result.length >= 2) return result;
      }
    } catch (ignoreToComp) {}
    // Some older AE builds expose a 2D-only overload for 2D layers.
    try {
      if (layer && !layer.threeDLayer && typeof layer.toComp === "function") {
        result = layer.toComp([point[0], point[1]]);
        if (result && result.length >= 2) return result;
      }
    } catch (ignoreToComp2d) {}
    return null;
  }

  function readFallback2dCompBounds(layer, rect) {
    var transform;
    var anchorProperty;
    var positionProperty;
    var scaleProperty;
    var rotationProperty;
    var anchor;
    var position;
    var scale;
    var rotation;
    var scaleX;
    var scaleY;
    var radians;
    var cos;
    var sin;
    var points;
    var index;
    var localX;
    var localY;
    var x;
    var y;
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    // AE can fail to return usable coordinates from toComp/sourcePointToComp
    // for a normal unparented 2D text layer. Reconstruct its comp bounds from
    // sourceRectAtTime plus the layer transform so it remains alignable.
    if (!layer || layer.threeDLayer || layer.parent || !rect) return null;
    try {
      transform = layer.property("ADBE Transform Group");
      anchorProperty = transform && transform.property("ADBE Anchor Point");
      positionProperty = transform && transform.property("ADBE Position");
      scaleProperty = transform && transform.property("ADBE Scale");
      rotationProperty = transform && (
        transform.property("ADBE Rotate Z") || transform.property("ADBE Rotation")
      );

      // Read the direct AVLayer values first. This is the stable path for AE
      // 2025 text layers; matchName lookups remain only as a fallback.
      anchor = readPropertyValue(layer && layer.anchorPoint, null);
      position = readPropertyValue(layer && layer.position, null);
      scale = readPropertyValue(layer && layer.scale, null);
      rotation = readPropertyValue(layer && (layer.rotation || layer.zRotation), null);
      if (!anchor && anchorProperty) anchor = readPropertyValue(anchorProperty, null);
      if (!position && positionProperty) position = readPropertyValue(positionProperty, null);
      if (!scale && scaleProperty) scale = readPropertyValue(scaleProperty, null);
      if (rotation === null && rotationProperty) rotation = readPropertyValue(rotationProperty, 0);

      // Keep alignment usable for AE layer types that omit one optional
      // transform property. A missing scale/rotation means the identity
      // transform, not an unsupported layer. Anchor and position still need
      // to be present because they define the comp-space origin.
      if (!scale || typeof scale.length !== "number" || scale.length < 2) {
        scale = [100, 100];
      }
      if (!isFiniteNumber(Number(rotation))) {
        rotation = 0;
      }
      if (!anchor || !position || anchor.length < 2 || position.length < 2) return null;
      scaleX = Number(scale[0]) / 100;
      scaleY = Number(scale[1]) / 100;
      if (!isFiniteNumber(scaleX) || !isFiniteNumber(scaleY) || !isFiniteNumber(rotation)) return null;
      radians = rotation * Math.PI / 180;
      cos = Math.cos(radians);
      sin = Math.sin(radians);
      points = [
        [Number(rect.left), Number(rect.top)],
        [Number(rect.left) + Number(rect.width), Number(rect.top)],
        [Number(rect.left) + Number(rect.width), Number(rect.top) + Number(rect.height)],
        [Number(rect.left), Number(rect.top) + Number(rect.height)]
      ];
      for (index = 0; index < points.length; index += 1) {
        localX = (points[index][0] - Number(anchor[0])) * scaleX;
        localY = (points[index][1] - Number(anchor[1])) * scaleY;
        x = Number(position[0]) + localX * cos - localY * sin;
        y = Number(position[1]) + localX * sin + localY * cos;
        if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return {
        left: minX,
        top: minY,
        right: maxX,
        bottom: maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
      };
    } catch (ignoreFallbackBounds) {
      return null;
    }
  }

  function readDirect2dCompBounds(layer, rect) {
    var anchor;
    var position;
    var scale;
    var rotation;
    var scaleX;
    var scaleY;
    var leftOffset;
    var rightOffset;
    var topOffset;
    var bottomOffset;
    var left;
    var right;
    var top;
    var bottom;

    if (!layer || layer.threeDLayer || layer.parent || !rect) return null;
    anchor = readPropertyValue(layer.anchorPoint, null);
    position = readPropertyValue(layer.position, null);
    scale = readPropertyValue(layer.scale, [100, 100]);
    rotation = readPropertyValue(layer.rotation || layer.zRotation, 0);
    if (!anchor || !position || anchor.length < 2 || position.length < 2) return null;
    if (Math.abs(Number(rotation) || 0) > 0.000001) return null;
    scaleX = Number(scale && scale[0]) / 100;
    scaleY = Number(scale && scale[1]) / 100;
    if (!isFiniteNumber(scaleX) || !isFiniteNumber(scaleY)) return null;
    leftOffset = (Number(rect.left) - Number(anchor[0])) * scaleX;
    rightOffset = (Number(rect.left + rect.width) - Number(anchor[0])) * scaleX;
    topOffset = (Number(rect.top) - Number(anchor[1])) * scaleY;
    bottomOffset = (Number(rect.top + rect.height) - Number(anchor[1])) * scaleY;
    left = Number(position[0]) + Math.min(leftOffset, rightOffset);
    right = Number(position[0]) + Math.max(leftOffset, rightOffset);
    top = Number(position[1]) + Math.min(topOffset, bottomOffset);
    bottom = Number(position[1]) + Math.max(topOffset, bottomOffset);
    if (!isFiniteNumber(left) || !isFiniteNumber(right) || !isFiniteNumber(top) || !isFiniteNumber(bottom)) {
      return null;
    }
    return {
      left: left,
      top: top,
      right: right,
      bottom: bottom,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2
    };
  }

  function readCompBounds(layer, time) {
    var rect;
    var fallback;
    var points;
    var index;
    var point;
    var minX;
    var minY;
    var maxX;
    var maxY;

    if (!layer || layer.matchName === "ADBE Camera Layer" || layer.matchName === "ADBE Light Layer") {
      return null;
    }
    rect = readLayerBounds(layer, time);
    if (!rect) return null;
    fallback = readDirect2dCompBounds(layer, rect);
    if (fallback) return fallback;
    // Prefer the deterministic local-transform path for ordinary unparented
    // 2D layers. This avoids the AE 2025 text-layer coordinate conversion
    // failure that previously made every alignment action report
    // "unsupported-layer" even though the layer was valid and selected.
    fallback = readFallback2dCompBounds(layer, rect);
    if (fallback) return fallback;
    points = [
      readCompPoint(layer, [rect.left, rect.top, 0]),
      readCompPoint(layer, [rect.left + rect.width, rect.top, 0]),
      readCompPoint(layer, [rect.left + rect.width, rect.top + rect.height, 0]),
      readCompPoint(layer, [rect.left, rect.top + rect.height, 0])
    ];
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (index = 0; index < points.length; index += 1) {
      point = points[index];
      if (!point || !isFiniteNumber(Number(point[0])) || !isFiniteNumber(Number(point[1]))) {
        continue;
      }
      minX = Math.min(minX, Number(point[0]));
      minY = Math.min(minY, Number(point[1]));
      maxX = Math.max(maxX, Number(point[0]));
      maxY = Math.max(maxY, Number(point[1]));
    }
    if (!isFiniteNumber(minX) || !isFiniteNumber(minY) || !isFiniteNumber(maxX) || !isFiniteNumber(maxY)) {
      return readFallback2dCompBounds(layer, rect);
    }
    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  function unionCompBounds(boundsList) {
    var result;
    var index;
    var bounds;

    if (!boundsList || boundsList.length === 0) return null;
    result = {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity
    };
    for (index = 0; index < boundsList.length; index += 1) {
      bounds = boundsList[index];
      if (!bounds) continue;
      result.left = Math.min(result.left, bounds.left);
      result.top = Math.min(result.top, bounds.top);
      result.right = Math.max(result.right, bounds.right);
      result.bottom = Math.max(result.bottom, bounds.bottom);
    }
    if (!isFiniteNumber(result.left) || !isFiniteNumber(result.top) ||
        !isFiniteNumber(result.right) || !isFiniteNumber(result.bottom)) {
      return null;
    }
    result.centerX = (result.left + result.right) / 2;
    result.centerY = (result.top + result.bottom) / 2;
    return result;
  }

  function compDeltaToThreeDPositionDelta(layer, positionState, probe, deltaX, deltaY) {
    var oldPosition;
    var before;
    var xValue;
    var yValue;
    var xProbe;
    var yProbe;
    var axisXx;
    var axisXy;
    var axisYx;
    var axisYy;
    var determinant;

    if (
      !layer ||
      !positionState ||
      !probe ||
      typeof layer.sourcePointToComp !== "function"
    ) {
      return null;
    }
    oldPosition = positionState.value.slice(0);
    try {
      before = layer.sourcePointToComp(probe);
      xValue = oldPosition.slice(0);
      xValue[0] += 1;
      setPositionState(positionState, xValue);
      xProbe = layer.sourcePointToComp(probe);

      setPositionState(positionState, oldPosition);
      yValue = oldPosition.slice(0);
      yValue[1] += 1;
      setPositionState(positionState, yValue);
      yProbe = layer.sourcePointToComp(probe);
      setPositionState(positionState, oldPosition);

      if (!before || !xProbe || !yProbe) return null;
      axisXx = Number(xProbe[0]) - Number(before[0]);
      axisXy = Number(xProbe[1]) - Number(before[1]);
      axisYx = Number(yProbe[0]) - Number(before[0]);
      axisYy = Number(yProbe[1]) - Number(before[1]);
      determinant = axisXx * axisYy - axisYx * axisXy;
      if (
        !isFiniteNumber(axisXx) ||
        !isFiniteNumber(axisXy) ||
        !isFiniteNumber(axisYx) ||
        !isFiniteNumber(axisYy) ||
        !isFiniteNumber(determinant) ||
        Math.abs(determinant) < 0.00000001
      ) {
        return null;
      }
      return [
        (axisYy * deltaX - axisYx * deltaY) / determinant,
        (-axisXy * deltaX + axisXx * deltaY) / determinant
      ];
    } catch (ignoreThreeDDelta) {
      try { setPositionState(positionState, oldPosition); } catch (ignoreRestore) {}
      return null;
    }
  }

  function compDeltaToLayerPositionDelta(layer, deltaX, deltaY) {
    var parent;
    var ancestor;
    var origin;
    var unitX;
    var unitY;
    var axisXx;
    var axisXy;
    var axisYx;
    var axisYy;
    var determinant;

    if (!layer || layer.threeDLayer) return null;
    parent = layer.parent;
    if (!parent) return [deltaX, deltaY];
    ancestor = parent;
    while (ancestor) {
      if (ancestor.threeDLayer) return null;
      ancestor = ancestor.parent;
    }
    if (typeof parent.sourcePointToComp !== "function") return null;

    try {
      origin = parent.sourcePointToComp([0, 0]);
      unitX = parent.sourcePointToComp([1, 0]);
      unitY = parent.sourcePointToComp([0, 1]);
      if (!origin || !unitX || !unitY) return null;
      axisXx = Number(unitX[0]) - Number(origin[0]);
      axisXy = Number(unitX[1]) - Number(origin[1]);
      axisYx = Number(unitY[0]) - Number(origin[0]);
      axisYy = Number(unitY[1]) - Number(origin[1]);
      determinant = axisXx * axisYy - axisYx * axisXy;
      if (
        !isFiniteNumber(axisXx) ||
        !isFiniteNumber(axisXy) ||
        !isFiniteNumber(axisYx) ||
        !isFiniteNumber(axisYy) ||
        !isFiniteNumber(determinant) ||
        Math.abs(determinant) < 0.00000001
      ) {
        return null;
      }
      return [
        (axisYy * deltaX - axisYx * deltaY) / determinant,
        (-axisXy * deltaX + axisXx * deltaY) / determinant
      ];
    } catch (ignoreParentDelta) {
      return null;
    }
  }

  function moveLayerByCompDelta(layer, deltaX, deltaY, time) {
    var transform;
    var positionState;
    var position;
    var oldValue;
    var nextValue;
    var positionDelta;
    var rect;
    var probe;
    var errorDetail;

    if (!layer || layer.locked) return "locked-layer";
    if (layer.matchName === "ADBE Camera Layer" || layer.matchName === "ADBE Light Layer") {
      return "unsupported-layer";
    }
    try { transform = layer.property("ADBE Transform Group"); } catch (ignoreTransformGroup) { transform = null; }
    positionState = readPositionState(transform, layer);
    position = positionState && positionState.property;
    if (!positionState || !position) return "unsupported-layer";
    if (position.expressionEnabled || position.numKeys > 0) return "expression-conflict";
    oldValue = positionState.value.slice(0);
    nextValue = oldValue.slice(0);

    try {
      if (layer.threeDLayer) {
        rect = readLayerBounds(layer, time);
        if (!rect) return "unsupported-layer";
        probe = [
          Number(rect.left) + Number(rect.width) / 2,
          Number(rect.top) + Number(rect.height) / 2
        ];
        positionDelta = compDeltaToThreeDPositionDelta(
          layer,
          positionState,
          probe,
          deltaX,
          deltaY
        );
        if (!positionDelta) return "unsupported-layer";
        nextValue[0] += positionDelta[0];
        nextValue[1] += positionDelta[1];
      } else {
        positionDelta = compDeltaToLayerPositionDelta(
          layer,
          deltaX,
          deltaY
        );
        if (!positionDelta) return "unsupported-layer";
        nextValue[0] += positionDelta[0];
        nextValue[1] += positionDelta[1];
      }
      setPositionState(positionState, nextValue);
      return "updated";
    } catch (error) {
      try { setPositionState(positionState, oldValue); } catch (ignoreRestore) {}
      errorDetail = error && error.toString ? error.toString() : "unknown";
      return { reason: "host-error", detail: "position-write:" + errorDetail };
    }
  }

  // For an unparented 2D layer with no rotation, write the exact Position
  // value AE's own Align panel uses. Keeping this path separate avoids a
  // comp-space round trip and fixes the start-edge (left/top) case for text
  // layers whose sourceRect has a non-zero left/top offset.
  function alignUnparented2dLayer(layer, action, target, rect, reference) {
    var transform;
    var positionState;
    var anchor;
    var scale;
    var anchorX;
    var anchorY;
    var scaleX;
    var scaleY;
    var leftOffset;
    var rightOffset;
    var topOffset;
    var bottomOffset;
    var centerOffsetX;
    var centerOffsetY;
    var desired;
    var nextValue;
    var rotation;

    if (!layer || layer.threeDLayer || layer.parent || !rect || !reference) return null;
    try {
      rotation = readPropertyValue(layer.rotation || layer.zRotation, 0);
      if (Math.abs(Number(rotation) || 0) > 0.000001) return null;
      transform = layer.property("ADBE Transform Group");
      positionState = readPositionState(transform, layer);
      anchor = readPropertyValue(layer.anchorPoint, null);
      scale = readPropertyValue(layer.scale, [100, 100]);
      if (!positionState || !anchor || anchor.length < 2) return null;
      anchorX = Number(anchor[0]) || 0;
      anchorY = Number(anchor[1]) || 0;
      scaleX = Number(scale && scale[0]) / 100;
      scaleY = Number(scale && scale[1]) / 100;
      if (!isFiniteNumber(scaleX) || !isFiniteNumber(scaleY)) return null;
      leftOffset = (Number(rect.left) - anchorX) * scaleX;
      rightOffset = (Number(rect.left + rect.width) - anchorX) * scaleX;
      topOffset = (Number(rect.top) - anchorY) * scaleY;
      bottomOffset = (Number(rect.top + rect.height) - anchorY) * scaleY;
      centerOffsetX = (leftOffset + rightOffset) / 2;
      centerOffsetY = (topOffset + bottomOffset) / 2;
      leftOffset = Math.min(leftOffset, rightOffset);
      rightOffset = Math.max(leftOffset, rightOffset);
      topOffset = Math.min(topOffset, bottomOffset);
      bottomOffset = Math.max(topOffset, bottomOffset);
      nextValue = positionState.value.slice(0);
      if (action === "left") {
        desired = target === "selection" ? reference.left : 0;
        nextValue[0] = desired - leftOffset;
      } else if (action === "center-x") {
        desired = target === "selection" ? reference.centerX : Number(reference.right) / 2;
        nextValue[0] = desired - centerOffsetX;
      } else if (action === "right") {
        desired = target === "selection" ? reference.right : Number(reference.right);
        nextValue[0] = desired - rightOffset;
      } else if (action === "top") {
        desired = target === "selection" ? reference.top : 0;
        nextValue[1] = desired - topOffset;
      } else if (action === "center-y") {
        desired = target === "selection" ? reference.centerY : Number(reference.bottom) / 2;
        nextValue[1] = desired - centerOffsetY;
      } else if (action === "bottom") {
        desired = target === "selection" ? reference.bottom : Number(reference.bottom);
        nextValue[1] = desired - bottomOffset;
      } else {
        return null;
      }
      setPositionState(positionState, nextValue);
      return "updated";
    } catch (error) {
      return { reason: "host-error", detail: "direct-position-write:" + (error && error.toString ? error.toString() : "unknown") };
    }
  }

  function calculateAlignmentDelta(info, current, reference) {
    var deltaX = 0;
    var deltaY = 0;

    if (!info || !current || !reference) return null;
    if (info.axis === "x") {
      if (info.edge === "start") {
        deltaX = reference.left - current.left;
      } else if (info.edge === "end") {
        deltaX = reference.right - current.right;
      } else {
        deltaX = reference.centerX - current.centerX;
      }
    } else {
      if (info.edge === "start") {
        deltaY = reference.top - current.top;
      } else if (info.edge === "end") {
        deltaY = reference.bottom - current.bottom;
      } else {
        deltaY = reference.centerY - current.centerY;
      }
    }
    return [deltaX, deltaY];
  }

  function applyLayerAlignment(layers, action, target, time, comp) {
    var info = alignmentActionInfo(action);
    var bounds = [];
    var layerBounds = [];
    var index;
    var current;
    var reference;
    var deltaX;
    var deltaY;
    var delta;
    var result;
    var updatedLayers = 0;
    var firstFailure = null;
    var failureDetail = null;

    if (!info || !comp) return { updatedLayers: 0, reason: "host-error" };
    for (index = 0; index < layers.length; index += 1) {
      current = readCompBounds(layers[index], time);
      layerBounds.push(current);
      if (current) bounds.push(current);
    }
    if (bounds.length === 0) return { updatedLayers: 0, reason: "unsupported-layer" };
    reference = target === "selection"
      ? unionCompBounds(bounds)
      : { left: 0, top: 0, right: Number(comp.width), bottom: Number(comp.height) };
    if (!reference) return { updatedLayers: 0, reason: "host-error" };
    reference.centerX = (reference.left + reference.right) / 2;
    reference.centerY = (reference.top + reference.bottom) / 2;

    for (index = 0; index < layers.length; index += 1) {
      current = layerBounds[index];
      if (!current) {
        if (!firstFailure) {
          firstFailure = "unsupported-layer";
          failureDetail = "bounds:layer=" + String(index + 1) + ";matchName=" + String(layers[index] && layers[index].matchName || "unknown");
        }
        continue;
      }
      result = alignUnparented2dLayer(
        layers[index],
        action,
        target,
        readLayerBounds(layers[index], time),
        reference
      );
      if (result === "updated") {
        updatedLayers += 1;
        continue;
      }
      if (result && result.reason) {
        if (!firstFailure) {
          firstFailure = result.reason;
          failureDetail = result.detail;
        }
        continue;
      }
      delta = calculateAlignmentDelta(info, current, reference);
      if (!delta) {
        if (!firstFailure) firstFailure = "host-error";
        continue;
      }
      deltaX = delta[0];
      deltaY = delta[1];
      result = moveLayerByCompDelta(layers[index], deltaX, deltaY, time);
      if (result === "updated") updatedLayers += 1;
      else if (!firstFailure) {
        firstFailure = typeof result === "string" ? result : result.reason;
        failureDetail = typeof result === "string" ? null : result.detail;
      }
    }
    return { updatedLayers: updatedLayers, reason: firstFailure, detail: failureDetail };
  }

  function paragraphJustificationForAction(action) {
    if (action === "paragraph-left") {
      return ParagraphJustification.LEFT_JUSTIFY;
    }
    if (action === "paragraph-center") {
      return ParagraphJustification.CENTER_JUSTIFY;
    }
    if (action === "paragraph-right") {
      return ParagraphJustification.RIGHT_JUSTIFY;
    }
    return null;
  }

  function applyParagraphAlignment(layers, action) {
    var justification;
    var index;
    var layer;
    var textProperties;
    var documentProperty;
    var documentValue;
    var sourceText;
    var layerComp;
    var textTime;
    var writtenJustification;
    var updatedLayers = 0;
    var firstFailure = null;
    var failureDetail = null;

    justification = paragraphJustificationForAction(action);
    if (justification === null) return { updatedLayers: 0, reason: "host-error" };
    for (index = 0; index < layers.length; index += 1) {
      layer = layers[index];
      if (layer.locked) {
        if (!firstFailure) firstFailure = "locked-layer";
        continue;
      }
      try {
        // `Source Text` is the stable AVLayer alias used by AE's own
        // paragraph controls. Some AE versions expose the nested match-name
        // path but return a stale proxy from it when called through CEP.
        documentProperty = null;
        try { documentProperty = layer.property("Source Text"); } catch (ignoreSourceTextProperty) {}
        if (!documentProperty) {
          textProperties = layer.property("ADBE Text Properties");
          documentProperty = textProperties && textProperties.property("ADBE Text Document");
        }
        if (!documentProperty) {
          if (!firstFailure) firstFailure = "no-text-layer";
          continue;
        }
        layerComp = layer.containingComp || (app.project && app.project.activeItem);
        textTime = layerComp ? layerComp.time : 0;
        documentValue = documentProperty.numKeys && documentProperty.numKeys > 0
          ? documentProperty.valueAtTime(textTime, false)
          : documentProperty.value;
        documentValue.justification = justification;
        if (documentProperty.numKeys && documentProperty.numKeys > 0) {
          documentProperty.setValueAtTime(textTime, documentValue);
        } else {
          documentProperty.setValue(documentValue);
        }
        // AE can return a stale TextDocument proxy on the first write in a CEP
        // host. Read it back and retry at the current time if the paragraph
        // value was not committed.
        try {
          writtenJustification = documentProperty.value.justification;
        } catch (ignoreParagraphReadback) {
          writtenJustification = null;
        }
        if (Number(writtenJustification) !== Number(justification) && documentProperty.setValueAtTime) {
          documentProperty.setValueAtTime(textTime, documentValue);
        }
        updatedLayers += 1;
      } catch (error) {
        if (!firstFailure) {
          firstFailure = "host-error";
          failureDetail = "paragraph-write:" + (error && error.toString ? error.toString() : "unknown");
        }
      }
    }
    return { updatedLayers: updatedLayers, reason: firstFailure, detail: failureDetail };
  }

  function setAlignment(encodedPayload) {
    var payload;
    var action;
    var target;
    var layers;
    var comp;
    var time;
    var result;
    var stage = "decode";

    try {
      payload = decodeSearchPayload(encodedPayload);
      stage = "selection";
      action = payload && payload.action;
      target = payload && payload.target === "selection" ? "selection" : "composition";
      layers = selectedLayers();
      comp = app.project && app.project.activeItem;
      if (!layers || layers.length === 0) {
        return JSON.stringify({ ok: false, reason: "no-selected-layer", detail: "selection:count=0" });
      }
      if (!comp) {
        return JSON.stringify({ ok: false, reason: "host-error", detail: "selection:activeItem=none" });
      }
      if (typeof comp.width !== "number" || typeof comp.height !== "number") {
        return JSON.stringify({ ok: false, reason: "host-error", detail: "selection:activeItem-not-comp" });
      }
      time = comp.time;
      stage = "apply";
      app.beginUndoGroup("NYAWORKS Align");
      if (action === "paragraph-left" || action === "paragraph-center" || action === "paragraph-right") {
        result = applyParagraphAlignment(layers, action);
      } else {
        result = applyLayerAlignment(layers, action, target, time, comp);
      }
      app.endUndoGroup();
      if (!result || result.updatedLayers === 0) {
        return JSON.stringify({
          ok: false,
          reason: (result && result.reason) || "host-error",
          detail: result && result.detail
            ? result.detail
            : "apply:action=" + String(action) + ";target=" + String(target) + ";layers=" + String(layers.length)
        });
      }
      return JSON.stringify({ ok: true, updatedLayers: result.updatedLayers });
    } catch (error) {
      try { app.endUndoGroup(); } catch (ignore) {}
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: "alignment:" + stage + ":" + (error && error.toString ? error.toString() : "unknown")
      });
    }
  }

  function runP0TestAction(encodedPayload) {
    var payload;
    var activeItem;
    var projectName = null;

    try {
      payload = JSON.parse(decodeURIComponent(encodedPayload || ""));
      if (!payload || typeof payload.actionId !== "string") {
        return JSON.stringify({
          ok: false,
          reason: "invalid-payload",
          detail: "Missing actionId"
        });
      }

      activeItem = app.project ? app.project.activeItem : null;
      if (app.project && app.project.file) {
        projectName = app.project.file.name;
      }

      return JSON.stringify({
        ok: true,
        message: "P0 action received",
        data: {
          actionId: payload.actionId,
          aeVersion: app.version,
          projectName: projectName,
          activeItemName: activeItem && activeItem.name ? activeItem.name : null
        }
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        reason: "host-error",
        detail: error && error.toString ? error.toString() : "unknown"
      });
    }
  }

  $.global.NYAWORKS = {
    version: "0.1.0-alpha.1-dev",
    getHostInfo: getHostInfo,
    openDataDirectory: openDataDirectory,
    getCurrentResourceSources: getCurrentResourceSources,
    scanResourceSource: scanResourceSource,
    chooseResourceDirectory: chooseResourceDirectory
    ,openResourceDirectory: openResourceDirectory
    ,revealResourceFile: revealResourceFile
    ,openResourceFile: openResourceFile
    ,reloadHostScript: reloadHostScript
    ,setTextEditorAppearance: setTextEditorAppearance
    ,getTextEditorAppearance: getTextEditorAppearance
    ,getCurrentEffects: getCurrentEffects
    ,runSearchScript: runSearchScript
    ,applySearchPreset: applySearchPreset
    ,applyResourceExpression: applyResourceExpression
    ,addSearchEffect: addSearchEffect
    ,setAnchorPoint: setAnchorPoint
    ,getActionContext: getActionContext
    ,runLayerAction: runLayerAction
    ,readSelectedTextLayer: readSelectedTextLayer
    ,applyTextLayerEdit: applyTextLayerEdit
    ,createTextLayerFromEditor: createTextLayerFromEditor
    ,setAlignment: setAlignment
    ,runP0TestAction: runP0TestAction
  };
}());
