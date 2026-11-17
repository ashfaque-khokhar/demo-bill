(function (global) {
  "use strict";

  function defaultDiscountOptions() {
    return {
      itemLevel: true,
      invoiceLevel: true,
      taxTreatment: "before-tax"
    };
  }

  function defaultSettings() {
    return {
      id: "default",
      schemaVersion: 1,
      businessName: "",
      address: "",
      mobile: "",
      email: "",
      website: "",
      gstin: "",
      upiId: "",
      bankDetails: "",
      logoAssetId: null,
      numbering: {
        pattern: "{PREFIX}/{YYYY}/{SEQ}",
        prefixByType: {
          bill: "BILL",
          "cash-memo": "CM",
          quotation: "QT",
          receipt: "REC",
          "tax-invoice": "INV"
        },
        sequencePadding: 4,
        sequenceStart: 1,
        sequenceScope: "per-type",
        resetRule: "never",
        nextSequenceByType: {},
        lastYearByType: {}
      },
      disclaimer: "Thank you for your business. Please retain this document for your records.",
      supplierState: "",
      supplierStateCode: "",
      currencyCode: "INR",
      currencySymbol: "₹",
      dateFormat: "DD-MM-YYYY",
      paperSize: "A4",
      discount: defaultDiscountOptions(),
      headings: {
        item: "Item",
        quantity: "Qty",
        unit: "Unit",
        rate: "Rate",
        discount: "Discount",
        tax: "Tax",
        amount: "Amount",
        subtotal: "Subtotal",
        grandTotal: "Grand Total"
      },
      logoWidth: 120,
      logoHeight: 48,
      logoAlignment: "left",
      onboardingCompleted: false,
      updatedAt: 0
    };
  }

  function snapshot(settings) {
    return JSON.parse(JSON.stringify({
      businessName: settings.businessName,
      address: settings.address,
      mobile: settings.mobile,
      email: settings.email,
      website: settings.website,
      gstin: settings.gstin,
      upiId: settings.upiId,
      bankDetails: settings.bankDetails,
      supplierState: settings.supplierState,
      supplierStateCode: settings.supplierStateCode,
      disclaimer: settings.disclaimer,
      currencyCode: settings.currencyCode,
      currencySymbol: settings.currencySymbol,
      headings: settings.headings,
      discount: settings.discount,
      logoWidth: settings.logoWidth,
      logoHeight: settings.logoHeight,
      logoAlignment: settings.logoAlignment,
      logoAssetId: settings.logoAssetId
    }));
  }

  async function load() {
    var existing = await StorageRepository.get("settings", "default");
    if (!existing) {
      var created = defaultSettings();
      created.updatedAt = Date.now();
      await StorageRepository.put("settings", created);
      return created;
    }
    var base = defaultSettings();
    return Object.assign(base, existing, {
      numbering: Object.assign(base.numbering, existing.numbering || {}),
      headings: Object.assign(base.headings, existing.headings || {}),
      discount: Object.assign(base.discount, existing.discount || {})
    });
  }

  async function save(settings) {
    settings.id = "default";
    settings.updatedAt = Date.now();
    await StorageRepository.put("settings", settings);
    return settings;
  }

  global.Settings = {
    defaultSettings: defaultSettings,
    defaultDiscountOptions: defaultDiscountOptions,
    snapshot: snapshot,
    load: load,
    save: save
  };
})(window);
