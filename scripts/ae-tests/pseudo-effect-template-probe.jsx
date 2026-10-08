/* Evaluate this file to obtain the probe function. It never autoruns.
 * Development only: use a new, unsaved, empty project in the expected AE host.
 * No project close/new/save, no installed XML changes, no runtime registration.
 * Successful probe comp is retained for manual inspection. */
(function () {
  function readProperty(property) {
    var row = {
      name: property.name,
      matchName: property.matchName,
      index: property.propertyIndex,
      propertyType: String(property.propertyType)
    };
    var count = property.numProperties || 0;
    if (count > 0) {
      row.children = [];
      for (var i = 1; i <= count; i++) row.children.push(readProperty(property.property(i)));
    } else {
      row.valueType = String(property.propertyValueType);
      try { row.units = property.unitsText; } catch (ignoreUnits) {}
      row.canVaryOverTime = property.canVaryOverTime === true;
      row.canSetExpression = property.canSetExpression === true;
      row.numKeys = property.numKeys || 0;
      try { row.value = property.value; } catch (ignoreValue) {}
      try { if (property.hasMin) row.min = property.minValue; } catch (ignoreMin) {}
      try { if (property.hasMax) row.max = property.maxValue; } catch (ignoreMax) {}
      try { if (property.canSetExpression) row.expression = property.expression; } catch (ignoreExpression) {}
    }
    return row;
  }

  return function runPseudoEffectTemplateProbe(options) {
    options = options || {};
    var result = { ok: false, version: String(app.version) };
    if (!options.expectedMajorVersion ||
        parseInt(app.version, 10) !== options.expectedMajorVersion) {
      result.code = "PROBE_WRONG_HOST";
      return result;
    }
    if (!app.project || app.project.numItems !== 0 || app.project.file) {
      result.code = "PROBE_PROJECT_NOT_EMPTY";
      return result;
    }
    if (!options.presetFile || !options.presetFile.exists) {
      result.code = "PROBE_ASSET_MISSING";
      return result;
    }
    var comp = null;
    var undoOpen = false;
    try {
      app.beginUndoGroup("NYAWORKS pseudo-effect template probe");
      undoOpen = true;
      comp = app.project.items.addComp("__NYA_PSEUDO_PROBE__", 800, 800, 1, 2, 25);
      var layer = comp.layers.addShape();
      layer.name = "__NYA_PSEUDO_PROBE_LAYER__";
      layer.selected = true;
      layer.applyPreset(options.presetFile);
      // Always reacquire indexed property groups after application.
      var effects = layer.property("ADBE Effect Parade");
      result.effectCount = effects.numProperties;
      result.effects = [];
      for (var i = 1; i <= effects.numProperties; i++) {
        result.effects.push(readProperty(effects.property(i)));
      }
      result.compName = comp.name;
      result.compId = comp.id;
      result.ok = true;
    } catch (error) {
      result.code = "PROBE_FAILED";
      result.message = error.message || String(error);
      if (comp) {
        try { comp.remove(); }
        catch (cleanupError) { result.cleanupError = cleanupError.message || String(cleanupError); }
      }
    } finally {
      if (undoOpen) {
        try { app.endUndoGroup(); }
        catch (undoError) {
          result.ok = false;
          result.code = "PROBE_UNDO_CLOSE_FAILED";
          result.undoError = undoError.message || String(undoError);
        }
      }
    }
    return result;
  };
}())
