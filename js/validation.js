(function (global) {
  "use strict";

  var GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var WEBSITE_RE = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
  var MOBILE_RE = /^[0-9]{10,15}$/;
  var STATE_CODE_RE = /^[0-9]{1,2}$/;

  function fail(message, fields) {
    return { ok: false, message: message, fields: fields || {} };
  }

  function ok() {
    return { ok: true, message: "", fields: {} };
  }

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function requiredText(value, fieldKey, label) {
    if (!trim(value)) {
      return fail((label || "This field") + " is required.", fieldKey ? { [fieldKey]: "Required." } : {});
    }
    return null;
  }

  function optionalEmail(value, fieldKey) {
    var v = trim(value);
    if (!v) {
      return null;
    }
    if (!EMAIL_RE.test(v)) {
      return fail("Enter a valid email address.", fieldKey ? { [fieldKey]: "Invalid email." } : {});
    }
    return null;
  }

  function optionalGstin(value, fieldKey) {
    var v = trim(value).toUpperCase();
    if (!v) {
      return null;
    }
    if (!GSTIN_RE.test(v)) {
      return fail("Enter a valid 15-character GSTIN.", fieldKey ? { [fieldKey]: "Invalid GSTIN." } : {});
    }
    return null;
  }

  function optionalMobile(value, fieldKey) {
    var v = trim(value).replace(/[\s\-+]/g, "");
    if (!v) {
      return null;
    }
    if (!MOBILE_RE.test(v)) {
      return fail("Enter a valid mobile number (10–15 digits).", fieldKey ? { [fieldKey]: "Invalid mobile." } : {});
    }
    return null;
  }

  function optionalStateCode(value, fieldKey) {
    var v = trim(value);
    if (!v) {
      return null;
    }
    if (!STATE_CODE_RE.test(v)) {
      return fail("State code must be 1–2 digits.", fieldKey ? { [fieldKey]: "Invalid state code." } : {});
    }
    return null;
  }

  function optionalWebsite(value, fieldKey) {
    var v = trim(value);
    if (!v) {
      return null;
    }
    if (!WEBSITE_RE.test(v)) {
      return fail("Enter a valid website URL.", fieldKey ? { [fieldKey]: "Invalid website." } : {});
    }
    return null;
  }

  function mergeResults(results) {
    var fields = {};
    var message = "";
    for (var i = 0; i < results.length; i += 1) {
      var r = results[i];
      if (!r || r.ok) {
        continue;
      }
      if (!message) {
        message = r.message;
      }
      var f = r.fields || {};
      Object.keys(f).forEach(function (key) {
        if (!fields[key]) {
          fields[key] = f[key];
        }
      });
    }
    if (!message) {
      return ok();
    }
    return fail(message, fields);
  }

  function inRange(n, min, max, label, fieldKey) {
    if (!isFinite(n) || n < min || n > max) {
      return fail(label + " must be between " + min + " and " + max + ".", fieldKey ? { [fieldKey]: "Out of range." } : {});
    }
    return null;
  }

  function validateBusinessSettings(settings, fieldMap) {
    fieldMap = fieldMap || {};
    var id = function (logical) {
      return fieldMap[logical] || logical;
    };
    var checks = [];

    var reqName = requiredText(settings.businessName, id("businessName"), "Business name");
    if (reqName) {
      checks.push(reqName);
    }
    var reqMobile = requiredText(settings.mobile, id("businessMobile"), "Mobile");
    if (reqMobile) {
      checks.push(reqMobile);
    } else {
      checks.push(optionalMobile(settings.mobile, id("businessMobile")));
    }
    var reqAddr = requiredText(settings.address, id("businessAddress"), "Address");
    if (reqAddr) {
      checks.push(reqAddr);
    }

    checks.push(optionalEmail(settings.email, id("businessEmail")));
    checks.push(optionalWebsite(settings.website, id("businessWebsite")));
    checks.push(optionalGstin(settings.gstin, id("businessGstin")));
    checks.push(optionalStateCode(settings.supplierStateCode, id("supplierStateCode")));

    var logoW = Number(settings.logoWidth);
    var logoH = Number(settings.logoHeight);
    checks.push(inRange(logoW, 40, 300, "Logo width", id("logoWidth")));
    checks.push(inRange(logoH, 20, 160, "Logo height", id("logoHeight")));

    var numbering = settings.numbering || {};
    var pad = Number(numbering.sequencePadding);
    var start = Number(numbering.sequenceStart);
    checks.push(inRange(pad, 1, 8, "Sequence padding", id("sequencePadding")));
    if (!isFinite(start) || start < 1) {
      var startFields = {};
      startFields[id("sequenceStart")] = "Must be at least 1.";
      checks.push(fail("Sequence start must be at least 1.", startFields));
    }

    var pattern = trim(numbering.pattern);
    if (pattern.indexOf("{SEQ}") < 0) {
      checks.push(fail("Number pattern must include {SEQ}.", { [id("numberPattern")]: "Include {SEQ}." }));
    }

    return mergeResults(checks.filter(Boolean));
  }

  function isMeaningfulLine(line) {
    var name = trim(line && line.name);
    var rate = Number(line && line.rateMinor) || 0;
    return !!(name || rate > 0);
  }

  function validateCustomer(customer, options, fieldMap) {
    options = options || {};
    fieldMap = fieldMap || {};
    var id = function (logical) {
      return fieldMap[logical] || logical;
    };
    var checks = [];

    if (options.requireName) {
      var req = requiredText(customer && customer.name, id("customerName"), "Customer name");
      if (req) {
        checks.push(req);
      }
    }

    checks.push(optionalEmail(customer && customer.email, id("customerEmail")));
    checks.push(optionalGstin(customer && customer.gstin, id("customerGstin")));
    checks.push(optionalMobile(customer && customer.mobile, id("customerMobile")));
    checks.push(optionalStateCode(customer && customer.stateCode, id("customerStateCode")));

    if (options.gstEnabled) {
      var state = trim(customer && customer.state);
      if (!state) {
        checks.push(fail("Customer state is required when GST is enabled.", { [id("customerState")]: "Required for GST." }));
      }
    }

    return mergeResults(checks.filter(Boolean));
  }

  function validateLineItems(items) {
    var list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return fail("Add at least one item.");
    }

    var meaningful = 0;
    var fields = {};
    var firstMessage = "";

    for (var i = 0; i < list.length; i += 1) {
      var line = list[i] || {};
      if (!isMeaningfulLine(line)) {
        continue;
      }
      meaningful += 1;
      var row = i + 1;
      var prefix = "Row " + row + ": ";

      var qty = Number(line.quantity);
      if (!isFinite(qty) || qty <= 0) {
        firstMessage = firstMessage || prefix + "quantity must be greater than zero.";
        continue;
      }

      var rate = Number(line.rateMinor);
      if (!isFinite(rate) || rate < 0) {
        firstMessage = firstMessage || prefix + "rate must be zero or greater.";
        continue;
      }

      var gstRate = Number(line.gstRate);
      if (!isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
        firstMessage = firstMessage || prefix + "GST % must be between 0 and 100.";
        continue;
      }

      var discType = line.discountType || "none";
      var discVal = Number(line.discountValue);
      if (!isFinite(discVal) || discVal < 0) {
        firstMessage = firstMessage || prefix + "discount must be zero or greater.";
        continue;
      }
      if (discType === "percent" && discVal > 100) {
        firstMessage = firstMessage || prefix + "discount percent cannot exceed 100.";
        continue;
      }
    }

    if (meaningful === 0) {
      return fail("Enter a line item name or rate before saving.");
    }
    if (firstMessage) {
      return fail(firstMessage, fields);
    }
    return ok();
  }

  function validateInvoiceDiscount(doc) {
    var discount = doc.discount || { type: "none", value: 0 };
    var type = discount.type || "none";
    var value = Number(discount.value);
    if (type === "none") {
      return ok();
    }
    if (!isFinite(value) || value < 0) {
      return fail("Invoice discount must be zero or greater.", { invoiceDiscountValue: "Invalid value." });
    }
    if (type === "percent" && value > 100) {
      return fail("Invoice discount percent cannot exceed 100.", { invoiceDiscountValue: "Max 100%." });
    }
    return ok();
  }

  function validateDocument(doc, settings, level) {
    level = level || "generate";
    var gstEnabled = !!(doc.gst && doc.gst.enabled);
    var checks = [];

    checks.push(validateCustomer(doc.customer, {
      requireName: level === "generate" || level === "draft",
      gstEnabled: gstEnabled
    }));
    checks.push(validateLineItems(doc.items));
    checks.push(validateInvoiceDiscount(doc));

    if (gstEnabled) {
      var supplierState = trim(settings && settings.supplierState);
      if (!supplierState) {
        checks.push(fail("Supplier state is required in Settings when GST is enabled.", {}));
      }
    }

    return mergeResults(checks);
  }

  function validateCatalogueItem(item) {
    var checks = [];
    var req = requiredText(item && item.name, null, "Item name");
    if (req) {
      checks.push(req);
    }
    var rate = Number(item && item.defaultRateMinor);
    if (!isFinite(rate) || rate < 0) {
      checks.push(fail("Default rate must be zero or greater."));
    }
    var tax = Number(item && item.defaultTaxRate);
    if (!isFinite(tax) || tax < 0 || tax > 100) {
      checks.push(fail("Tax rate must be between 0 and 100."));
    }
    return mergeResults(checks);
  }

  function assertValid(result) {
    if (!result || result.ok) {
      return;
    }
    throw new Error(result.message || "Validation failed.");
  }

  global.Validation = {
    trim: trim,
    requiredText: requiredText,
    optionalEmail: optionalEmail,
    optionalGstin: optionalGstin,
    optionalMobile: optionalMobile,
    optionalStateCode: optionalStateCode,
    optionalWebsite: optionalWebsite,
    validateBusinessSettings: validateBusinessSettings,
    validateCustomer: validateCustomer,
    validateLineItems: validateLineItems,
    validateDocument: validateDocument,
    validateCatalogueItem: validateCatalogueItem,
    assertValid: assertValid,
    mergeResults: mergeResults
  };
})(window);