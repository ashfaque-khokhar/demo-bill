(function (global) {
  "use strict";

  function normalizeState(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function resolveSupplyType(gst, supplierState, customerState) {
    if (!gst || !gst.enabled) {
      return "none";
    }
    if (gst.supplyType === "intra-state" || gst.supplyType === "inter-state") {
      return gst.supplyType;
    }
    var a = normalizeState(supplierState);
    var b = normalizeState(customerState || gst.placeOfSupply);
    if (!a || !b) {
      return "intra-state";
    }
    if (a === b) {
      return "intra-state";
    }
    return "inter-state";
  }

  function splitTax(taxMinor, supplyType) {
    var tax = Money.roundPaise(taxMinor);
    if (supplyType === "inter-state") {
      return { cgstMinor: 0, sgstMinor: 0, igstMinor: tax };
    }
    var half = Math.floor(tax / 2);
    var other = tax - half;
    return { cgstMinor: half, sgstMinor: other, igstMinor: 0 };
  }

  global.Gst = {
    normalizeState: normalizeState,
    resolveSupplyType: resolveSupplyType,
    splitTax: splitTax
  };
})(window);
