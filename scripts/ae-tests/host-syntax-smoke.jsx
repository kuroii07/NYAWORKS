/* AE-only, read-only project smoke check. Run with AfterFX -r.
 * Evaluates the installed development Host and checks its catalog and template.
 * This may replace $.global.NYAWORKS, but never edits an AE project. */
(function () {
  var scriptFile = new File($.fileName);
  var extensionRoot = scriptFile.parent.parent.parent.fsName + "/dev-extension";
  var hostFile = new File(extensionRoot + "/host/index.jsx");
  var reportFile = new File(Folder.temp.fsName + "/nyaworks-host-syntax-smoke.txt");
  var report = "host=" + hostFile.fsName + "\n";
  try {
    if (!hostFile.exists) throw new Error("host-file-missing");
    hostFile.encoding = "UTF-8";
    if (!hostFile.open("r")) throw new Error("host-file-unreadable");
    var source = hostFile.read();
    hostFile.close();
    eval(source);
    if (!$.global.NYAWORKS || !$.global.NYAWORKS.runLayerAction) {
      throw new Error("host-namespace-missing");
    }
    report += "result=loaded\n";
    try {
      var start = source.indexOf("  function preflightRoundedRectangleTemplate(extensionRoot) {");
      var end = source.indexOf("  function applyRoundedRectangleTemplate(", start);
      if (start < 0 || end < 0) throw new Error("preflight-function-missing");
      var preflight = eval("(" + source.substring(start, end) + ")");
      var template = preflight(extensionRoot);
      report += "template=" + template.file.fsName + "\n";
    } catch (assetError) {
      report += "template-error=" + String(assetError) + "\n";
    }
  } catch (error) {
    report += "result=failed\n";
    report += "error=" + String(error) + "\n";
    report += "line=" + (error.line || "unknown") + "\n";
  }
  reportFile.encoding = "UTF-8";
  if (reportFile.open("w")) {
    reportFile.write(report);
    reportFile.close();
  }
}());
