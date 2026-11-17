(function (global) {
  "use strict";

  var GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var WEBSITE_RE = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
  var MOBILE_RE = /^[0-9]{10,15}$/;
  var STATE_CODE_RE = /^[0-9]{1,2}$/;

  var LIMITS = {
    businessName: 120,
    mobile: 15,
    address: 500,
    email: 254,
    website: 2048,
    gstin: 15,
    stateName: 60,
    stateCode: 2,
    upiId: 100,
    bankDetails: 500,
    disclaimer: 2000,
    notes: 2000,
    numberPattern: 80,
    tableHeading: 40,
    lineItemName: 8,
    lineItemQuantity: 4,
    lineItemRate: 6,
    lineItemUnit: 32,
    hsnSac: 8,
    amountDigits: 7,
    maxAmountMinor: 999999999,
    maxAmountRupees: 9999999.99
  };

  var AMOUNT_CAP_MESSAGE = "cannot exceed ₹99,99,999.99 (7 digits).";

  var HEADING_FIELD_IDS = {
    item: "hItem",
    quantity: "hQty",
    unit: "hUnit",
    rate: "hRate",
    discount: "hDiscount",
    tax: "hTax",
    amount: "hAmount",
    subtotal: "hSubtotal",
    grandTotal: "hGrand"
  };

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

  function maxLengthText(value, limitKey, fieldKey, label) {
    var max = LIMITS[limitKey];
    if (!max) {
      return null;
    }
    var v = String(value == null ? "" : value);
    if (v.length <= max) {
      return null;
    }
    var shortLabel = label || "This field";
    return fail(
      shortLabel + " must be at most " + max + " characters.",
      fieldKey ? { [fieldKey]: "Max " + max + " characters." } : {}
    );
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

  function maxAmountMinor(paise, label, fieldKey) {
    var max = LIMITS.maxAmountMinor;
    var n = Number(paise);
    if (!isFinite(n) || n <= max) {
      return null;
    }
    var shortLabel = label || "Amount";
    return fail(
      shortLabel + " " + AMOUNT_CAP_MESSAGE,
      fieldKey ? { [fieldKey]: "Max 7 digits." } : {}
    );
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

    checks.push(maxLengthText(settings.businessName, "businessName", id("businessName"), "Business name"));
    checks.push(maxLengthText(settings.mobile, "mobile", id("businessMobile"), "Mobile"));
    checks.push(maxLengthText(settings.address, "address", id("businessAddress"), "Address"));
    checks.push(maxLengthText(settings.email, "email", id("businessEmail"), "Email"));
    checks.push(maxLengthText(settings.website, "website", id("businessWebsite"), "Website"));
    checks.push(maxLengthText(settings.gstin, "gstin", id("businessGstin"), "GSTIN"));
    checks.push(maxLengthText(settings.supplierState, "stateName", id("supplierState"), "Supplier state"));
    checks.push(maxLengthText(settings.supplierStateCode, "stateCode", id("supplierStateCode"), "State code"));
    checks.push(maxLengthText(settings.upiId, "upiId", id("upiId"), "UPI ID"));
    checks.push(maxLengthText(settings.bankDetails, "bankDetails", id("bankDetails"), "Bank details"));
    checks.push(maxLengthText(settings.disclaimer, "disclaimer", id("disclaimer"), "Disclaimer"));

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
    checks.push(maxLengthText(pattern, "numberPattern", id("numberPattern"), "Number pattern"));

    var headings = settings.headings || {};
    Object.keys(HEADING_FIELD_IDS).forEach(function (key) {
      checks.push(
        maxLengthText(headings[key], "tableHeading", HEADING_FIELD_IDS[key], "Table heading")
      );
    });

    return mergeResults(checks.filter(Boolean));
  }

  function isMeaningfulLine(line) {
    var name = trim(line && line.name);
    var unit = trim(line && line.unit);
    var rate = Number(line && line.rateMinor) || 0;
    var qty = Number(line && line.quantity);
    var discType = (line && line.discountType) || "none";
    var hsn = trim(line && line.hsnSac);
    var gst = Number(line && line.gstRate);
    if (name || unit || hsn || rate > 0 || (isFinite(gst) && gst > 0) || (isFinite(qty) && qty > 0)) {
      return true;
    }
    return discType !== "none";
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

    checks.push(maxLengthText(customer && customer.name, "businessName", id("customerName"), "Customer name"));
    checks.push(maxLengthText(customer && customer.address, "address", id("customerAddress"), "Address"));
    checks.push(maxLengthText(customer && customer.email, "email", id("customerEmail"), "Email"));
    checks.push(maxLengthText(customer && customer.gstin, "gstin", id("customerGstin"), "Customer GSTIN"));
    checks.push(maxLengthText(customer && customer.mobile, "mobile", id("customerMobile"), "Mobile"));
    checks.push(maxLengthText(customer && customer.state, "stateName", id("customerState"), "State"));
    checks.push(maxLengthText(customer && customer.stateCode, "stateCode", id("customerStateCode"), "State code"));

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

      if (!trim(line.name)) {
        firstMessage = firstMessage || prefix + "item name is required.";
        continue;
      }
      if (!trim(line.unit)) {
        firstMessage = firstMessage || prefix + "unit is required.";
        continue;
      }

      var qty = Number(line.quantity);
      if (!isFinite(qty) || qty <= 0) {
        firstMessage = firstMessage || prefix + "quantity must be greater than zero.";
        continue;
      }
      var qtyTooLong = maxLengthText(line.quantity, "lineItemQuantity", null, prefix + "quantity");
      if (qtyTooLong) {
        firstMessage = firstMessage || qtyTooLong.message;
        continue;
      }

      var rate = Number(line.rateMinor);
      if (!isFinite(rate) || rate <= 0) {
        firstMessage = firstMessage || prefix + "rate must be greater than zero.";
        continue;
      }
      var rateDisplay =
        line.rateInput != null && String(line.rateInput).trim() !== ""
          ? String(line.rateInput).trim()
          : global.Money
            ? String(global.Money.fromPaise(rate))
            : String(rate);
      var rateTooLong = maxLengthText(rateDisplay, "lineItemRate", null, prefix + "rate");
      if (rateTooLong) {
        firstMessage = firstMessage || rateTooLong.message;
        continue;
      }
      var rateCap = maxAmountMinor(rate, prefix + "rate", null);
      if (rateCap) {
        firstMessage = firstMessage || rateCap.message;
        continue;
      }

      var gstRate = Number(line.gstRate);
      if (!isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
        firstMessage = firstMessage || prefix + "GST % must be between 0 and 100.";
        continue;
      }

      var discType = line.discountType || "none";
      var discVal = Number(line.discountValue);
      if (discType !== "none") {
        if (!isFinite(discVal) || discVal <= 0) {
          firstMessage =
            firstMessage ||
            prefix + "discount value must be greater than zero when a discount type is selected.";
          continue;
        }
        if (discType === "percent" && discVal > 100) {
          firstMessage = firstMessage || prefix + "discount percent cannot exceed 100.";
          continue;
        }
        if (discType === "fixed" && global.Money) {
          var discCap = maxAmountMinor(global.Money.toPaise(discVal), prefix + "discount", null);
          if (discCap) {
            firstMessage = firstMessage || discCap.message;
            continue;
          }
        }
      } else if (!isFinite(discVal) || discVal < 0) {
        firstMessage = firstMessage || prefix + "discount must be zero or greater.";
        continue;
      }

      var nameTooLong = maxLengthText(line.name, "lineItemName", null, prefix + "name");
      if (nameTooLong) {
        firstMessage = firstMessage || nameTooLong.message;
        continue;
      }
      var unitTooLong = maxLengthText(line.unit, "lineItemUnit", null, prefix + "unit");
      if (unitTooLong) {
        firstMessage = firstMessage || unitTooLong.message;
        continue;
      }
      var hsnTooLong = maxLengthText(line.hsnSac, "hsnSac", null, prefix + "HSN/SAC");
      if (hsnTooLong) {
        firstMessage = firstMessage || hsnTooLong.message;
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
    if (!isFinite(value) || value <= 0) {
      return fail("Invoice discount must be greater than zero when a discount type is selected.", {
        invoiceDiscountValue: "Must be greater than zero."
      });
    }
    if (type === "percent" && value > 100) {
      return fail("Invoice discount percent cannot exceed 100.", { invoiceDiscountValue: "Max 100%." });
    }
    if (type === "fixed" && global.Money) {
      var invCap = maxAmountMinor(global.Money.toPaise(value), "Invoice discount", "invoiceDiscountValue");
      if (invCap) {
        return invCap;
      }
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
    checks.push(maxLengthText(doc.notes, "notes", "notes", "Notes"));

    if (gstEnabled) {
      var supplierState = trim(settings && settings.supplierState);
      if (!supplierState) {
        checks.push(fail("Supplier state is required in Settings when GST is enabled.", {}));
      }
    }

    return mergeResults(checks.filter(Boolean));
  }

  function assertValid(result) {
    if (!result || result.ok) {
      return;
    }
    throw new Error(result.message || "Validation failed.");
  }

  global.Validation = {
    LIMITS: LIMITS,
    trim: trim,
    requiredText: requiredText,
    maxLengthText: maxLengthText,
    maxAmountMinor: maxAmountMinor,
    optionalEmail: optionalEmail,
    optionalGstin: optionalGstin,
    optionalMobile: optionalMobile,
    optionalStateCode: optionalStateCode,
    optionalWebsite: optionalWebsite,
    validateBusinessSettings: validateBusinessSettings,
    validateCustomer: validateCustomer,
    isMeaningfulLine: isMeaningfulLine,
    validateLineItems: validateLineItems,
    validateDocument: validateDocument,
    assertValid: assertValid,
    mergeResults: mergeResults
  };
})(window);