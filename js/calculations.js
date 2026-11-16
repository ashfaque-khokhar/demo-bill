(function (global) {
  "use strict";

  function safeNumber(value, fallback) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) {
      return fallback;
    }
    return n;
  }

  function lineGrossMinor(item) {
    var qty = safeNumber(item.quantity, 0);
    var rate = Money.roundPaise(item.rateMinor);
    return Money.roundPaise(qty * rate);
  }

  function applyDiscount(baseMinor, discountType, discountValue) {
    var base = Money.roundPaise(baseMinor);
    var type = discountType || "none";
    var value = safeNumber(discountValue, 0);
    if (type === "percent") {
      if (value > 100) {
        value = 100;
      }
      return Money.roundPaise((base * value) / 100);
    }
    if (type === "fixed") {
      var fixed = Money.toPaise(value);
      if (fixed > base) {
        return base;
      }
      return fixed;
    }
    return 0;
  }

  function calculateDocument(doc, settings) {
    var gstEnabled = !!(doc.gst && doc.gst.enabled);
    var supplyType = Gst.resolveSupplyType(
      doc.gst,
      settings && settings.supplierState,
      doc.customer && doc.customer.state
    );

    var items = Array.isArray(doc.items) ? doc.items : [];
    var calculatedItems = [];
    var subtotalMinor = 0;
    var itemDiscountTotal = 0;
    var taxableTotal = 0;
    var cgstTotal = 0;
    var sgstTotal = 0;
    var igstTotal = 0;
    var taxByRate = {};

    for (var i = 0; i < items.length; i += 1) {
      var src = items[i] || {};
      var gross = lineGrossMinor(src);
      var lineDisc = applyDiscount(gross, src.discountType, src.discountValue);
      var afterLineDisc = Math.max(0, gross - lineDisc);
      subtotalMinor += gross;
      itemDiscountTotal += lineDisc;

      calculatedItems.push({
        id: src.id,
        catalogueItemId: src.catalogueItemId || null,
        name: String(src.name || ""),
        quantity: safeNumber(src.quantity, 0),
        unit: String(src.unit || "Piece"),
        rateMinor: Money.roundPaise(src.rateMinor),
        discountType: src.discountType || "none",
        discountValue: safeNumber(src.discountValue, 0),
        hsnSac: String(src.hsnSac || ""),
        gstRate: safeNumber(src.gstRate, 0),
        grossMinor: gross,
        discountMinor: lineDisc,
        afterDiscountMinor: afterLineDisc,
        taxableValueMinor: 0,
        cgstMinor: 0,
        sgstMinor: 0,
        igstMinor: 0,
        lineTotalMinor: afterLineDisc
      });
    }

    var invoiceDiscountBase = 0;
    for (var j = 0; j < calculatedItems.length; j += 1) {
      invoiceDiscountBase += calculatedItems[j].afterDiscountMinor;
    }

    var invoiceDiscountMinor = applyDiscount(
      invoiceDiscountBase,
      doc.discount && doc.discount.type,
      doc.discount && doc.discount.value
    );

    var remainingInvoiceDiscount = invoiceDiscountMinor;
    for (var k = 0; k < calculatedItems.length; k += 1) {
      var item = calculatedItems[k];
      var share = 0;
      if (invoiceDiscountBase > 0 && invoiceDiscountMinor > 0) {
        if (k === calculatedItems.length - 1) {
          share = remainingInvoiceDiscount;
        } else {
          share = Money.roundPaise((item.afterDiscountMinor / invoiceDiscountBase) * invoiceDiscountMinor);
          remainingInvoiceDiscount -= share;
        }
      }
      var taxable = Math.max(0, item.afterDiscountMinor - share);
      item.taxableValueMinor = taxable;
      item.allocatedInvoiceDiscountMinor = share;
      taxableTotal += taxable;

      var taxMinor = 0;
      if (gstEnabled && item.gstRate > 0) {
        taxMinor = Money.roundPaise((taxable * item.gstRate) / 100);
        var split = Gst.splitTax(taxMinor, supplyType);
        item.cgstMinor = split.cgstMinor;
        item.sgstMinor = split.sgstMinor;
        item.igstMinor = split.igstMinor;
        cgstTotal += split.cgstMinor;
        sgstTotal += split.sgstMinor;
        igstTotal += split.igstMinor;

        var key = String(item.gstRate);
        if (!taxByRate[key]) {
          taxByRate[key] = {
            rate: item.gstRate,
            taxableValueMinor: 0,
            cgstMinor: 0,
            sgstMinor: 0,
            igstMinor: 0
          };
        }
        taxByRate[key].taxableValueMinor += taxable;
        taxByRate[key].cgstMinor += split.cgstMinor;
        taxByRate[key].sgstMinor += split.sgstMinor;
        taxByRate[key].igstMinor += split.igstMinor;
      }

      item.lineTotalMinor = taxable + item.cgstMinor + item.sgstMinor + item.igstMinor;
    }

    var taxMinorTotal = cgstTotal + sgstTotal + igstTotal;
    var discountMinor = itemDiscountTotal + invoiceDiscountMinor;
    var grandTotalMinor = taxableTotal + taxMinorTotal;

    var rateSummary = [];
    Object.keys(taxByRate).forEach(function (key) {
      rateSummary.push(taxByRate[key]);
    });
    rateSummary.sort(function (a, b) {
      return a.rate - b.rate;
    });

    return {
      items: calculatedItems,
      supplyType: supplyType,
      subtotalMinor: subtotalMinor,
      itemDiscountMinor: itemDiscountTotal,
      invoiceDiscountMinor: invoiceDiscountMinor,
      discountMinor: discountMinor,
      taxableValueMinor: taxableTotal,
      cgstMinor: cgstTotal,
      sgstMinor: sgstTotal,
      igstMinor: igstTotal,
      taxMinor: taxMinorTotal,
      grandTotalMinor: grandTotalMinor,
      taxByRate: rateSummary,
      amountInWords: Money.amountInWords(grandTotalMinor)
    };
  }

  global.Calculations = {
    calculateDocument: calculateDocument,
    applyDiscount: applyDiscount,
    lineGrossMinor: lineGrossMinor
  };
})(window);
