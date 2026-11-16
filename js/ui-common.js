(function (global) {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type) {
    var node = $("status");
    if (!node) {
      return;
    }
    node.textContent = message || "";
    node.className = "status-bar no-print " + (type || "info");
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

  function markActiveNav() {
    var current = document.body.getAttribute("data-page");
    document.querySelectorAll(".nav-drawer-link[data-page]").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-page") === current);
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

  document.addEventListener("DOMContentLoaded", bindNav);

  global.AppUI = {
    $: $,
    setStatus: setStatus,
    confirmModal: confirmModal,
    openNavDrawer: openNavDrawer,
    closeNavDrawer: closeNavDrawer
  };
})(window);
