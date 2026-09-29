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

  function reloadHostScript() {
    try {
      $.evalFile(hostScriptFile);
      return JSON.stringify({ ok: true });
    } catch (error) {
      return JSON.stringify({ ok: false, reason: "host-error" });
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

      file = new File(payload.path);
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
        updatedProperties: updatedProperties
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
    ,reloadHostScript: reloadHostScript
    ,getCurrentEffects: getCurrentEffects
    ,runSearchScript: runSearchScript
    ,applySearchPreset: applySearchPreset
    ,applyResourceExpression: applyResourceExpression
    ,addSearchEffect: addSearchEffect
    ,setAnchorPoint: setAnchorPoint
    ,getActionContext: getActionContext
    ,setAlignment: setAlignment
    ,runP0TestAction: runP0TestAction
  };
}());
