(function (global) {
  "use strict";

  var STORAGE_KEY = "billing.theme";
  var MODES = ["light", "dark", "system"];
  var mediaQuery = null;

  function onSystemChange() {
    if (getStoredMode() === "system") {
      apply("system");
    }
  }

  function bindSystemListener() {
    if (!global.matchMedia) {
      return;
    }
    if (mediaQuery) {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", onSystemChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(onSystemChange);
      }
    }
    mediaQuery = global.matchMedia("(prefers-color-scheme: dark)");
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onSystemChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(onSystemChange);
    }
  }

  function getStoredMode() {
    try {
      var mode = global.localStorage.getItem(STORAGE_KEY);
      return MODES.indexOf(mode) >= 0 ? mode : "system";
    } catch (error) {
      return "system";
    }
  }

  function setStoredMode(mode) {
    if (MODES.indexOf(mode) < 0) {
      mode = "system";
    }
    try {
      global.localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      // Ignore quota / private mode.
    }
    return mode;
  }

  function resolveEffective(mode) {
    mode = mode || getStoredMode();
    if (mode === "dark") {
      return "dark";
    }
    if (mode === "light") {
      return "light";
    }
    if (global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function apply(mode) {
    var effective = resolveEffective(mode);
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.style.colorScheme = effective;
    return effective;
  }

  function bindSelect(id) {
    var el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.value = getStoredMode();
    el.addEventListener("change", function () {
      var mode = setStoredMode(el.value);
      apply(mode);
      if (mode === "system") {
        bindSystemListener();
      }
    });
  }

  function init() {
    var mode = getStoredMode();
    apply(mode);
    if (mode === "system") {
      bindSystemListener();
    }
  }

  global.Theme = {
    getMode: getStoredMode,
    setMode: function (mode) {
      setStoredMode(mode);
      apply(mode);
      if (mode === "system") {
        bindSystemListener();
      }
    },
    apply: apply,
    bindSelect: bindSelect,
    init: init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);