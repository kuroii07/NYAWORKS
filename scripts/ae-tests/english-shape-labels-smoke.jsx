/* AE asset probe. Run only in a separate -m -noui instance with an empty
 * unsaved project. Never closes/saves a project or edits AE preferences/XML.
 * The launcher sets NYA_ENGLISH_LABEL_ROOT to this checkout's absolute path. */
(function () {
  var report = "AE=" + app.version + "\n";
  var output = new File(Folder.temp.fsName + "/nya-english-labels-r2.txt");
  function readJSON(path) {
    var file = new File(path);
    file.encoding = "UTF-8";
    if (!file.open("r")) throw new Error("Cannot read " + path);
    var text;
    try { text = file.read(); } finally { file.close(); }
    return eval("(" + text + ")");
  }
  try {
    if (!app.project || app.project.numItems !== 0 || app.project.file) {
      throw new Error("PROBE_PROJECT_NOT_EMPTY: no project changes made");
    }
    var root = $.global.NYA_ENGLISH_LABEL_ROOT;
    if (typeof root !== "string" || !root) throw new Error("PROBE_ROOT_MISSING");
    var catalog = readJSON(root + "/public/host/pseudo-effects/catalog.json");
    var sources = ["rounded-rectangle/v7", "circle/v3", "triangle/v1", "star/v2"];
    var checked = 0;
    for (var s = 0; s < sources.length; s++) {
      var schema = readJSON(root + "/assets/pseudo-effects/" + sources[s] + "/en/schema.json");
      var entry = catalog.templates[schema.templateId];
      var comp = app.project.items.addComp("__NYA_EN_LABEL_PROBE_" + s, 800, 800, 1, 1, 25);
      var layer = comp.layers.addShape();
      layer.selected = true;
      layer.applyPreset(new File(root + "/public/host/pseudo-effects/" + entry.file));
      var effect = layer.property("ADBE Effect Parade").property(1);
      if (effect.matchName !== schema.matchName) throw new Error("Wrong effect identity");
      report += schema.templateId + " " + effect.matchName + "\n";
      for (var p = 0; p < schema.parameters.length; p++) {
        var parameter = schema.parameters[p];
        var actual = effect.property(entry.parameters[parameter.id]).name;
        report += "  " + parameter.id + "=" + actual + "\n";
        if (actual !== parameter.label) throw new Error("LABEL_MISMATCH: " + parameter.id);
        checked++;
      }
      // Group starts are exposed as flat properties in AE's pseudo-effect DOM.
      var styleIndex = s === 0 ? 11 : s === 1 ? 2 : s === 2 ? 5 : 7;
      if (effect.property(styleIndex).name !== schema.styleGroup) throw new Error("STYLE_LABEL_MISMATCH");
      checked++;
      if (s === 0) {
        if (effect.property(5).name !== schema.group) throw new Error("CORNER_GROUP_LABEL_MISMATCH");
        checked++;
      }
      if (effect.property(entry.marker.index).name !== entry.marker.name) throw new Error("MARKER_MISMATCH");
    }
    report += "PASS labels=" + checked + "\n";
  } catch (error) { report += "FAIL " + String(error) + " line=" + error.line + "\n"; }
  $.writeln(report);
  output.encoding = "UTF-8";
  if (output.open("w")) {
    try { output.write(report); } finally { output.close(); }
  }
}());
