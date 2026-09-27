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

  function decodeSearchPayload(encodedPayload) {
    return JSON.parse(decodeURIComponent(encodedPayload));
  }

  function getCurrentEffects() {
    var effects = [];
    var seen = {};
    var matchNames = [
      "ADBE Gaussian Blur 2",
      "ADBE Fill",
      "ADBE Drop Shadow",
      "ADBE Tint"
    ];
    var names = ["Gaussian Blur", "Fill", "Drop Shadow", "Tint"];
    var index;

    for (index = 0; index < matchNames.length; index += 1) {
      if (!seen[matchNames[index]]) {
        seen[matchNames[index]] = true;
        effects.push({
          id: "effect:" + matchNames[index],
          name: names[index],
          matchName: matchNames[index],
          aliases: []
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
      var file = new File(payload.path);
      if (!file.exists) {
        return JSON.stringify({ ok: false, reason: "invalid-resource" });
      }
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
      var file = new File(payload.path);
      layers = selectedLayers();
      if (!file.exists) return JSON.stringify({ ok: false, reason: "invalid-resource" });
      if (!layers || layers.length === 0) return JSON.stringify({ ok: false, reason: "no-selected-layer" });
      app.beginUndoGroup("NYAWORKS Apply Preset");
      for (index = 0; index < layers.length; index += 1) layers[index].applyPreset(file);
      app.endUndoGroup();
      return JSON.stringify({ ok: true });
    } catch (error) {
      try { app.endUndoGroup(); } catch (ignore) {}
      return JSON.stringify({ ok: false, reason: "host-error" });
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

  function compensateAnchorPoint(layer, positionName, time) {
    var fraction = anchorPositionFraction(positionName);
    var transform;
    var anchor;
    var position;
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

    if (!fraction || !layer || layer.locked || !(layer instanceof AVLayer)) {
      return "unsupported-layer";
    }

    if (layer.matchName === "ADBE Camera Layer" || layer.matchName === "ADBE Light Layer") {
      return "unsupported-layer";
    }

    transform = layer.property("ADBE Transform Group");
    anchor = transform && transform.property("ADBE Anchor Point");
    position = transform && transform.property("ADBE Position");
    if (!transform || !anchor || !position || position.dimensionsSeparated) {
      return "unsupported-layer";
    }

    if (anchor.expressionEnabled || position.expressionEnabled || anchor.numKeys > 0 || position.numKeys > 0) {
      return "expression-conflict";
    }

    try {
      rect = layer.sourceRectAtTime(time, false);
      probe = [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5];
      before = layer.sourcePointToComp(probe);
      oldAnchor = anchor.value;
      oldPosition = position.value;
      targetAnchor = [
        rect.left + rect.width * fraction[0],
        rect.top + rect.height * fraction[1]
      ];
      if (layer.threeDLayer) {
        targetAnchor.push(oldAnchor.length > 2 ? oldAnchor[2] : 0);
      }

      anchor.setValue(targetAnchor);
      after = layer.sourcePointToComp(probe);
      dxScreen = before[0] - after[0];
      dyScreen = before[1] - after[1];

      position.setValue(oldPosition);
      xValue = oldPosition.slice(0);
      xValue[0] += 1;
      position.setValue(xValue);
      xProbe = layer.sourcePointToComp(probe);

      position.setValue(oldPosition);
      yValue = oldPosition.slice(0);
      yValue[1] += 1;
      position.setValue(yValue);
      yProbe = layer.sourcePointToComp(probe);
      position.setValue(oldPosition);

      xDerivative = [xProbe[0] - after[0], xProbe[1] - after[1]];
      yDerivative = [yProbe[0] - after[0], yProbe[1] - after[1]];
      determinant = xDerivative[0] * yDerivative[1] - yDerivative[0] * xDerivative[1];

      if (Math.abs(determinant) < 0.000001) {
        anchor.setValue(oldAnchor);
        position.setValue(oldPosition);
        return "unsupported-layer";
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
      position.setValue(xValue);

      if (distance2d(layer.sourcePointToComp(probe), before) > 0.25) {
        anchor.setValue(oldAnchor);
        position.setValue(oldPosition);
        return "unsupported-layer";
      }
      return "updated";
    } catch (error) {
      try { anchor.setValue(oldAnchor); } catch (ignoreAnchor) {}
      try { position.setValue(oldPosition); } catch (ignorePosition) {}
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

  $.global.NYAWORKS = {
    version: "0.1.0-alpha.1",
    getHostInfo: getHostInfo,
    openDataDirectory: openDataDirectory,
    getCurrentResourceSources: getCurrentResourceSources,
    scanResourceSource: scanResourceSource,
    chooseResourceDirectory: chooseResourceDirectory
    ,getCurrentEffects: getCurrentEffects
    ,runSearchScript: runSearchScript
    ,applySearchPreset: applySearchPreset
    ,addSearchEffect: addSearchEffect
    ,setAnchorPoint: setAnchorPoint
  };
}());

