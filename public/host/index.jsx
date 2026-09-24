(function () {
  "use strict";

  function getHostInfo() {
    return JSON.stringify({
      name: app.name,
      version: app.version,
      projectName: app.project ? app.project.file && app.project.file.name : null
    });
  }

  $.global.NYAWORKS = {
    version: "0.1.0-alpha.1",
    getHostInfo: getHostInfo
  };
}());

