/* Read-only AE probe: no preset application, project edits, selection edits or undo. */
(function () {
  function propertyRow(property) {
    var row = { name: property.name, matchName: property.matchName,
      index: property.propertyIndex, type: String(property.propertyType) };
    try { row.valueType = String(property.propertyValueType); } catch (ignoreType) {}
    try { row.value = property.value; } catch (error) { row.valueError = String(error); }
    return row;
  }
  var report = { version: String(app.version), effects: [], layers: [] };
  try {
    var registered = app.effects;
    for (var i = 0; i < registered.length; i++) {
      if (String(registered[i].matchName).indexOf("Pseudo/") === 0) {
        report.effects.push({ matchName: registered[i].matchName,
          displayName: registered[i].displayName, category: registered[i].category });
      }
    }
    var comp = app.project && app.project.activeItem;
    report.comp = comp ? comp.name : null;
    if (comp && comp instanceof CompItem) {
      for (var j = 1; j <= comp.numLayers; j++) {
        var layer = comp.layer(j);
        var parade = layer.property("ADBE Effect Parade");
        if (!parade) continue;
        for (var k = 1; k <= parade.numProperties; k++) {
          var effect = parade.property(k);
          if (String(effect.matchName).indexOf("Pseudo/") !== 0) continue;
          var row = propertyRow(effect);
          row.layer = layer.name;
          row.parameters = [];
          for (var p = 1; p <= effect.numProperties; p++) {
            row.parameters.push(propertyRow(effect.property(p)));
          }
          report.layers.push(row);
        }
      }
    }
    report.lastCreationTrace = $.global.NYAWORKS &&
      $.global.NYAWORKS.getLastShapePseudoTrace
      ? JSON.parse($.global.NYAWORKS.getLastShapePseudoTrace()) : null;
  } catch (error) { report.error = String(error); }
  var output = new File(new File($.fileName).parent.parent.parent.fsName +
    "/work/shape-pseudo-state.json");
  if (!output.parent.exists) output.parent.create();
  output.encoding = "UTF-8";
  if (output.open("w")) {
    try { output.write(JSON.stringify(report, null, 2)); } finally { output.close(); }
  }
}());
