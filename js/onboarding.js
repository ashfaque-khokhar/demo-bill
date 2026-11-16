(function (global) {
  "use strict";

  var TOTAL_STEPS = 4;
  var stepIndex = 0;
  var settingsRef = null;
  var hooks = {
    onStatus: null,
    onSaved: null,
    onComplete: null,
    onLogoUpload: null
  };
  var bound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function needsOnboarding(settings) {
    if (!settings) {
      return true;
    }
    if (settings.onboardingCompleted) {
      return false;
    }
    return !(settings.businessName && settings.mobile && settings.address);
  }

  function setStatus(message, kind) {
    var el = $("onboardingStatus");
    if (!el) {
      return;
    }
    el.textContent = message || "";
    el.className = "onboarding-status" + (kind ? " " + kind : "");
  }

  function fillFromSettings(settings) {
    $("onboardBusinessName").value = settings.businessName || "";
    $("onboardBusinessMobile").value = settings.mobile || "";
    $("onboardBusinessAddress").value = settings.address || "";
    $("onboardBusinessEmail").value = settings.email || "";
    $("onboardBusinessWebsite").value = settings.website || "";
    $("onboardBusinessGstin").value = settings.gstin || "";
    $("onboardSupplierState").value = settings.supplierState || "";
    $("onboardSupplierStateCode").value = settings.supplierStateCode || "";
    $("onboardUpiId").value = settings.upiId || "";
    $("onboardBankDetails").value = settings.bankDetails || "";
    var preview = $("onboardLogoPreview");
    if (preview && hooks.getLogoUrl) {
      preview.src = hooks.getLogoUrl() || "assets/logo-placeholder.svg";
    }
  }

  function applyStepFieldsToSettings() {
    var s = settingsRef;
    if (stepIndex === 0) {
      s.businessName = $("onboardBusinessName").value.trim();
      s.mobile = $("onboardBusinessMobile").value.trim();
      s.address = $("onboardBusinessAddress").value.trim();
    } else if (stepIndex === 1) {
      s.email = $("onboardBusinessEmail").value.trim();
      s.website = $("onboardBusinessWebsite").value.trim();
      s.gstin = $("onboardBusinessGstin").value.trim();
      s.supplierState = $("onboardSupplierState").value.trim();
      s.supplierStateCode = $("onboardSupplierStateCode").value.trim();
    } else if (stepIndex === 2) {
      s.upiId = $("onboardUpiId").value.trim();
      s.bankDetails = $("onboardBankDetails").value.trim();
    }
  }

  var onboardFieldMap = {
    businessName: "onboardBusinessName",
    businessMobile: "onboardBusinessMobile",
    businessAddress: "onboardBusinessAddress",
    businessEmail: "onboardBusinessEmail",
    businessWebsite: "onboardBusinessWebsite",
    businessGstin: "onboardBusinessGstin",
    supplierStateCode: "onboardSupplierStateCode"
  };

  function validateCurrentStep() {
    applyStepFieldsToSettings();
    if (stepIndex === 0) {
      var businessCheck = Validation.validateBusinessSettings(settingsRef, onboardFieldMap);
      if (!businessCheck.ok) {
        setStatus(businessCheck.message, "error");
        if (global.AppUI && businessCheck.fields) {
          global.AppUI.showValidationFields(businessCheck.fields);
        }
        return false;
      }
      return true;
    }
    if (stepIndex === 1) {
      var optionalChecks = [
        Validation.optionalEmail(settingsRef.email, "onboardBusinessEmail"),
        Validation.optionalWebsite(settingsRef.website, "onboardBusinessWebsite"),
        Validation.optionalGstin(settingsRef.gstin, "onboardBusinessGstin"),
        Validation.optionalStateCode(settingsRef.supplierStateCode, "onboardSupplierStateCode")
      ].filter(Boolean);
      if (!optionalChecks.length) {
        return true;
      }
      var merged = Validation.mergeResults(optionalChecks);
      if (!merged.ok) {
        setStatus(merged.message, "error");
        if (global.AppUI && merged.fields) {
          global.AppUI.showValidationFields(merged.fields);
        }
        return false;
      }
    }
    return true;
  }

  function renderStep() {
    var steps = document.querySelectorAll(".onboarding-step");
    steps.forEach(function (section) {
      var index = Number(section.getAttribute("data-step"));
      var active = index === stepIndex;
      section.classList.toggle("active", active);
      if (active) {
        section.removeAttribute("hidden");
      } else {
        section.setAttribute("hidden", "");
      }
    });

    var progress = $("onboardingProgress");
    if (progress) {
      progress.textContent = "Step " + (stepIndex + 1) + " of " + TOTAL_STEPS;
    }
    var bar = $("onboardingProgressBar");
    if (bar) {
      bar.style.width = (((stepIndex + 1) / TOTAL_STEPS) * 100) + "%";
    }

    var back = $("btnOnboardBack");
    if (back) {
      back.disabled = stepIndex === 0;
    }

    var save = $("btnOnboardSave");
    if (save) {
      save.textContent = stepIndex === TOTAL_STEPS - 1 ? "Finish" : "Save";
    }

    var skip = $("btnOnboardSkip");
    if (skip) {
      skip.textContent = stepIndex === TOTAL_STEPS - 1 ? "Skip & finish" : "Skip";
    }
  }

  function showOverlay() {
    var overlay = $("onboardingOverlay");
    if (!overlay) {
      return;
    }
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function hideOverlay() {
    var overlay = $("onboardingOverlay");
    if (!overlay) {
      return;
    }
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function persistSettings(markComplete) {
    applyStepFieldsToSettings();
    if (markComplete) {
      settingsRef.onboardingCompleted = true;
    }
    await Settings.save(settingsRef);
    if (typeof hooks.onSaved === "function") {
      hooks.onSaved(settingsRef);
    }
  }

  async function finish() {
    settingsRef.onboardingCompleted = true;
    await Settings.save(settingsRef);
    hideOverlay();
    setStatus("");
    if (typeof hooks.onComplete === "function") {
      hooks.onComplete(settingsRef);
    }
    if (typeof hooks.onStatus === "function") {
      hooks.onStatus("Onboarding complete. You can edit details anytime in Settings.", "ok");
    }
  }

  async function handleSave() {
    setStatus("");
    if (!validateCurrentStep()) {
      return;
    }
    try {
      var last = stepIndex === TOTAL_STEPS - 1;
      await persistSettings(last);
      setStatus(last ? "Saved." : "Saved. Continuing…", "ok");
      if (last) {
        hideOverlay();
        if (typeof hooks.onComplete === "function") {
          hooks.onComplete(settingsRef);
        }
        if (typeof hooks.onStatus === "function") {
          hooks.onStatus("Business setup saved.", "ok");
        }
        return;
      }
      stepIndex += 1;
      renderStep();
    } catch (error) {
      setStatus((error && error.message) || "Could not save.", "error");
    }
  }

  async function handleSkip() {
    setStatus("");
    try {
      if (stepIndex === TOTAL_STEPS - 1) {
        await finish();
        return;
      }
      stepIndex += 1;
      renderStep();
    } catch (error) {
      setStatus((error && error.message) || "Could not continue.", "error");
    }
  }

  function handleBack() {
    setStatus("");
    if (stepIndex <= 0) {
      return;
    }
    stepIndex -= 1;
    renderStep();
  }

  async function handleLogoChange(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    if (typeof hooks.onLogoUpload !== "function") {
      setStatus("Logo upload is unavailable.", "error");
      return;
    }
    try {
      await hooks.onLogoUpload(file);
      var preview = $("onboardLogoPreview");
      if (preview && hooks.getLogoUrl) {
        preview.src = hooks.getLogoUrl() || preview.src;
      }
      setStatus("Logo saved.", "ok");
    } catch (error) {
      setStatus((error && error.message) || "Could not save logo.", "error");
    }
    event.target.value = "";
  }

  function bindEvents() {
    if (bound) {
      return;
    }
    bound = true;
    $("btnOnboardBack").addEventListener("click", handleBack);
    $("btnOnboardSave").addEventListener("click", function () {
      handleSave();
    });
    $("btnOnboardSkip").addEventListener("click", function () {
      handleSkip();
    });
    $("onboardLogoFile").addEventListener("change", function (event) {
      handleLogoChange(event);
    });
  }

  function maybeStart(settings, options) {
    settingsRef = settings;
    hooks = Object.assign({
      onStatus: null,
      onSaved: null,
      onComplete: null,
      onLogoUpload: null,
      getLogoUrl: null
    }, options || {});

    bindEvents();

    if (!needsOnboarding(settings)) {
      hideOverlay();
      return false;
    }

    stepIndex = 0;
    fillFromSettings(settings);
    renderStep();
    setStatus("");
    showOverlay();
    return true;
  }

  global.Onboarding = {
    needsOnboarding: needsOnboarding,
    maybeStart: maybeStart
  };
})(window);
