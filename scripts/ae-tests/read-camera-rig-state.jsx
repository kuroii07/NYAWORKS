/* Read-only camera rig inspection. Run once in AE with the affected comp active. */
(function () {
  var lines = [];
  var comp = null;
  var file = new File(Folder.userData.fsName + "/NYAWORKS/camera-rig-live-state.txt");
  var controllers = [];
  var index;

  function valueText(value) {
    if (value instanceof Array) return "[" + value.join(",") + "]";
    return String(value);
  }

  function oneLine(value) {
    return String(value || "none").replace(/[\r\n]+/g, " ");
  }

  function readProperty(property, label) {
    if (!property) { lines.push(label + ": missing"); return; }
    try {
      lines.push(label + " enabledBefore=" + property.expressionEnabled +
        " expressionErrorBefore=" + oneLine(property.expressionError));
      lines.push(label + " expression=" + oneLine(property.expression));
      lines.push(label + " stored=" + valueText(property.valueAtTime(comp.time, true)));
    } catch (error) { lines.push(label + " metadataReadError=" + String(error)); }
    try {
      lines.push(label + " evaluated=" + valueText(property.valueAtTime(comp.time, false)));
    } catch (error) { lines.push(label + " readError=" + String(error)); }
    // An expression failure may only become visible after valueAtTime evaluates it.
    try {
      lines.push(label + " enabledAfter=" + property.expressionEnabled +
        " expressionErrorAfter=" + oneLine(property.expressionError));
    } catch (error) { lines.push(label + " statusReadError=" + String(error)); }
  }

  function readTransform(layer, matchName, label) {
    try {
      var group = layer.property("ADBE Transform Group");
      var property = group && group.property(matchName);
      readProperty(property, label);
      if (matchName === "ADBE Position" && property && property.dimensionsSeparated) {
        lines.push(label + " dimensionsSeparated=true");
        for (var axis = 0; axis < (layer.threeDLayer ? 3 : 2); axis += 1) {
          readProperty(group.property("ADBE Position_" + axis), label + ".axis" + axis);
        }
      }
    } catch (error) { lines.push(label + " propertyReadError=" + String(error)); }
  }

  function isController(layer) {
    for (var index = 0; index < controllers.length; index += 1) {
      if (layer && layer.index === controllers[index]) return true;
    }
    return false;
  }

  try {
    lines.push("probeRevision=camera-state-20261015-2");
    lines.push("capturedAt=" + new Date().toUTCString());
    lines.push("AE=" + app.version);
    comp = app.project && app.project.activeItem;
    lines.push("hostRevision=" + ($.global.NYAWORKS && $.global.NYAWORKS.getHostRevision
      ? $.global.NYAWORKS.getHostRevision() : "unavailable"));
    if (!comp || !(comp instanceof CompItem)) {
      lines.push("activeComp=none");
    } else {
      lines.push("activeComp=yes time=" + comp.time + " layers=" + comp.numLayers);
      lines.push("activeCameraIndex=" + (comp.activeCamera ? comp.activeCamera.index : "none"));
      for (index = 1; index <= comp.numLayers; index += 1) {
        var layer = comp.layer(index);
        var parade = layer.property("ADBE Effect Parade");
        for (var effectIndex = 1; parade && effectIndex <= parade.numProperties; effectIndex += 1) {
          var effect = parade.property(effectIndex);
          if (!effect || !/^Pseudo\/NYA_Camera_v[12]_/.test(effect.matchName)) continue;
          if (!isController(layer)) controllers.push(layer.index);
          lines.push("controllerIndex=" + index + " effect=" + effect.matchName +
            " parameters=" + effect.numProperties + " effectIndex=" + effectIndex +
            " effectEnabled=" + effect.enabled + " threeD=" + layer.threeDLayer);
          var indices = [2, 5, 6, 7, 8, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26];
          for (var parameterIndex = 0; parameterIndex < indices.length; parameterIndex += 1) {
            readProperty(effect.property(indices[parameterIndex]), "control" + indices[parameterIndex]);
          }
          readTransform(layer, "ADBE Anchor Point", "controller" + index + ".anchor");
          readTransform(layer, "ADBE Position", "controller" + index + ".position");
          readTransform(layer, "ADBE Rotate X", "controller" + index + ".rotationX");
          readTransform(layer, "ADBE Rotate Y", "controller" + index + ".rotationY");
          readTransform(layer, "ADBE Rotate Z", "controller" + index + ".rotationZ");
        }
      }
      lines.push("controllerCount=" + controllers.length);
      for (index = 1; index <= comp.numLayers; index += 1) {
        var camera = comp.layer(index);
        if (!(camera instanceof CameraLayer)) {
          if (!isController(camera)) lines.push("sceneLayerIndex=" + index +
            " threeD=" + camera.threeDLayer + " enabled=" + camera.enabled);
          continue;
        }
        var parent = camera.parent;
        // Include an active unlinked camera: that is a possible broken boundary.
        lines.push("cameraIndex=" + index + " parentIndex=" + (parent ? parent.index : "none") +
          " active=" + !!(comp.activeCamera && camera.index === comp.activeCamera.index) +
          " controllerLinked=" + isController(parent) + " enabled=" + camera.enabled +
          " inPoint=" + camera.inPoint + " outPoint=" + camera.outPoint);
        readTransform(camera, "ADBE Position", "camera" + index + ".position");
        readTransform(camera, "ADBE Anchor Point", "camera" + index + ".pointOfInterest");
        try {
          var options = camera.property("ADBE Camera Options Group");
          readProperty(options && options.property("ADBE Camera Zoom"), "camera" + index + ".zoom");
          readProperty(options && options.property("ADBE Camera Depth of Field"), "camera" + index + ".depthOfField");
          readProperty(options && options.property("ADBE Camera Focus Distance"), "camera" + index + ".focusDistance");
        } catch (error) { lines.push("camera" + index + ".options readError=" + String(error)); }
      }
    }
  } catch (error) { lines.push("inspectionError=" + String(error)); }
  try {
    if (!file.parent.exists && !file.parent.create()) throw new Error("cannot-create-report-folder");
    file.encoding = "UTF-8";
    if (!file.open("w")) throw new Error("cannot-open-report");
    try {
      if (file.write(lines.join("\n")) === false) throw new Error("cannot-write-report");
    } finally { file.close(); }
    alert("NYAWORKS 检查完成。诊断已写入：\n" + file.fsName + "\n请返回对话告知已完成。");
  } catch (error) {
    alert("NYAWORKS 无法写入诊断：\n" + file.fsName + "\n" + String(error));
  }
}());
