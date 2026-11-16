(function (global) {
  "use strict";

  if (!("serviceWorker" in global.navigator)) {
    return;
  }

  var refreshedForUpdate = false;

  function notifyUpdate() {
    if (refreshedForUpdate) {
      return;
    }
    refreshedForUpdate = true;
    if (global.AppUI && typeof global.AppUI.setStatus === "function") {
      global.AppUI.setStatus("App updated — refresh once for the latest version.", "info");
    }
  }

  global.navigator.serviceWorker.addEventListener("controllerchange", notifyUpdate);

  function register() {
    global.navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch(function (err) {
        console.warn("[pwa] service worker registration failed", err);
      });
  }

  if (document.readyState === "complete") {
    register();
  } else {
    global.addEventListener("load", register);
  }
})(window);