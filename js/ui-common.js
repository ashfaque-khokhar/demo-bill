(function (global) {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  var TOAST_MAX = 3;
  var TOAST_MS = 4000;

  function ensureToastHost() {
    var host = $("toastHost");
    if (host) {
      return host;
    }
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host no-print";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-relevant", "additions");
    document.body.appendChild(host);
    return host;
  }

  function dismissToast(el, immediate) {
    if (!el || !el.parentNode) {
      return;
    }
    if (el._toastTimer) {
      clearTimeout(el._toastTimer);
      el._toastTimer = null;
    }
    if (immediate) {
      el.parentNode.removeChild(el);
      return;
    }
    el.classList.remove("toast--visible");
    el.classList.add("toast--leaving");
    el.addEventListener("transitionend", function onEnd() {
      el.removeEventListener("transitionend", onEnd);
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    setTimeout(function () {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 350);
  }

  function showToast(message, type, options) {
    if (!message) {
      return;
    }
    type = type || "info";
    options = options || {};
    var host = ensureToastHost();
    while (host.children.length >= TOAST_MAX) {
      dismissToast(host.firstChild, true);
    }

    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;

    var text = document.createElement("p");
    text.className = "toast__text";
    text.textContent = message;
    toast.appendChild(text);

    if (type === "error") {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast__dismiss";
      btn.setAttribute("aria-label", "Dismiss notification");
      btn.textContent = "\u00d7";
      btn.addEventListener("click", function () {
        dismissToast(toast);
      });
      toast.appendChild(btn);
    }

    host.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("toast--visible");
    });

    var duration = options.duration != null ? options.duration : TOAST_MS;
    if (type === "error") {
      duration = Math.max(duration, 6000);
    }
    toast._toastTimer = setTimeout(function () {
      dismissToast(toast);
    }, duration);
  }

  function setStatus(message, type) {
    if (!message) {
      return;
    }
    showToast(message, type || "info");
  }

  function openNavDrawer() {
    var drawer = $("navDrawer");
    var backdrop = $("navDrawerBackdrop");
    var toggle = $("btnNavToggle");
    if (!drawer || !backdrop || !toggle) {
      return;
    }
    drawer.classList.add("open");
    backdrop.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    var first = drawer.querySelector(".nav-drawer-link");
    if (first) {
      first.focus();
    }
  }

  function closeNavDrawer() {
    var drawer = $("navDrawer");
    var backdrop = $("navDrawerBackdrop");
    var toggle = $("btnNavToggle");
    if (!drawer || !backdrop || !toggle) {
      return;
    }
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    toggle.focus();
  }

  function confirmModal(title, message, actions) {
    return new Promise(function (resolve) {
      var backdrop = $("modalBackdrop");
      $("modalTitle").textContent = title;
      $("modalMessage").textContent = message;
      var actionsEl = $("modalActions");
      while (actionsEl.firstChild) {
        actionsEl.removeChild(actionsEl.firstChild);
      }
      actions.forEach(function (action) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn " + (action.className || "secondary");
        btn.textContent = action.label;
        btn.addEventListener("click", function () {
          backdrop.classList.remove("open");
          resolve(action.value);
        });
        actionsEl.appendChild(btn);
      });
      backdrop.classList.add("open");
    });
  }

  function fieldWrapperForInput(input) {
    if (!input) {
      return null;
    }
    return input.closest(".field");
  }

  function clearValidationFields() {
    document.querySelectorAll(".field--invalid").forEach(function (field) {
      field.classList.remove("field--invalid");
      var err = field.querySelector(".field-error");
      if (err) {
        err.remove();
      }
      var control = field.querySelector("input, select, textarea");
      if (control) {
        control.removeAttribute("aria-invalid");
      }
    });
  }

  function showValidationFields(fieldMessages) {
    clearValidationFields();
    if (!fieldMessages) {
      return;
    }
    Object.keys(fieldMessages).forEach(function (id) {
      var input = $(id);
      if (!input) {
        return;
      }
      var field = fieldWrapperForInput(input);
      if (!field) {
        return;
      }
      field.classList.add("field--invalid");
      input.setAttribute("aria-invalid", "true");
      var hint = document.createElement("p");
      hint.className = "field-error";
      hint.textContent = fieldMessages[id];
      var label = field.querySelector("label");
      if (label && label.nextSibling) {
        field.insertBefore(hint, label.nextSibling);
      } else {
        field.appendChild(hint);
      }
    });
  }

  function markActiveNav() {
    var current = document.body.getAttribute("data-page");
    document.querySelectorAll(".nav-drawer-link[data-page]").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-page") === current);
    });
  }

  function updateTextLimitCounter(input, counter, max) {
    var len = input.value.length;
    counter.textContent = len + " / " + max;
    counter.classList.toggle("text-limit-counter--full", len >= max);
  }

  function bindTextLimitControl(input) {
    if (!input || input.getAttribute("data-limit-bound") === "1") {
      return;
    }
    var limitKey = input.getAttribute("data-text-limit");
    if (!limitKey || !global.Validation || !global.Validation.LIMITS) {
      return;
    }
    var max = global.Validation.LIMITS[limitKey];
    if (!max) {
      return;
    }
    input.maxLength = max;
    input.setAttribute("data-limit-bound", "1");

    var counter = document.createElement("span");
    counter.className = "text-limit-counter";
    counter.setAttribute("aria-live", "polite");

    var field = fieldWrapperForInput(input);
    if (field) {
      field.appendChild(counter);
    } else if (input.closest("table.items")) {
      input.insertAdjacentElement("afterend", counter);
    } else {
      var cell = input.closest("td");
      if (cell) {
        cell.appendChild(counter);
      } else {
        input.insertAdjacentElement("afterend", counter);
      }
    }

    function refresh() {
      updateTextLimitCounter(input, counter, max);
    }
    input.addEventListener("input", refresh);
    refresh();
  }

  function bindNonNegativeDecimalInput(input, allowFraction) {
    if (!input || input.getAttribute("data-nonneg-bound") === "1") {
      return;
    }
    allowFraction = allowFraction !== false;
    input.setAttribute("data-nonneg-bound", "1");
    input.setAttribute("inputmode", allowFraction ? "decimal" : "numeric");

    function blockKeys(event) {
      var key = event.key;
      if (key === "-" || key === "+" || key === "e" || key === "E") {
        event.preventDefault();
      }
      if (!allowFraction && key === ".") {
        event.preventDefault();
      }
    }

    function onInput() {
      var cleaned = global.Money.sanitizeNonNegativeNumber(input.value, allowFraction);
      if (cleaned !== input.value) {
        input.value = cleaned;
      }
    }

    input.addEventListener("keydown", blockKeys);
    input.addEventListener("input", onInput);
  }

  function bindNonNegativeDecimalInputs(root, selector, allowFraction) {
    var scope = root || document;
    scope.querySelectorAll(selector).forEach(function (input) {
      bindNonNegativeDecimalInput(input, allowFraction);
    });
  }

  function bindTextLimits(root) {
    var scope = root || document;
    scope.querySelectorAll("input[data-text-limit], textarea[data-text-limit]").forEach(function (input) {
      bindTextLimitControl(input);
    });
  }

  function bindNav() {
    var toggle = $("btnNavToggle");
    var closeBtn = $("btnNavClose");
    var backdrop = $("navDrawerBackdrop");

    markActiveNav();

    if (toggle) {
      toggle.addEventListener("click", function () {
        if (document.body.classList.contains("nav-open")) {
          closeNavDrawer();
        } else {
          openNavDrawer();
        }
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", closeNavDrawer);
    }
    if (backdrop) {
      backdrop.addEventListener("click", closeNavDrawer);
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        closeNavDrawer();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindNav();
    bindTextLimits();
  });

  global.AppUI = {
    $: $,
    setStatus: setStatus,
    showToast: showToast,
    confirmModal: confirmModal,
    openNavDrawer: openNavDrawer,
    closeNavDrawer: closeNavDrawer,
    showValidationFields: showValidationFields,
    clearValidationFields: clearValidationFields,
    bindTextLimitControl: bindTextLimitControl,
    bindTextLimits: bindTextLimits,
    bindNonNegativeDecimalInput: bindNonNegativeDecimalInput,
    bindNonNegativeDecimalInputs: bindNonNegativeDecimalInputs
  };
})(window);
