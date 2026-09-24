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

  $.global.NYAWORKS = {
    version: "0.1.0-alpha.1",
    getHostInfo: getHostInfo,
    openDataDirectory: openDataDirectory
  };
}());

