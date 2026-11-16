(function (global) {
  "use strict";

  function createId() {
    return "doc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function emptyDocument(settings, documentType) {
    var typeId = documentType || "tax-invoice";
    var peek = Numbering.peekNumber(settings, typeId, todayIso());
    return {
      id: null,
      schemaVersion: 1,
      documentType: typeId,
      documentNumber: peek.documentNumber,
      numberingSnapshot: {
        pattern: settings.numbering.pattern,
        sequenceValue: peek.sequenceValue
      },
      invoiceDate: todayIso(),
      customer: Customers.emptyCustomer(),
      gst: {
        enabled: typeId === "tax-invoice",
        supplyType: "auto",
        rateMode: "exclusive",
        placeOfSupply: "",
        discountTaxTreatment: "before-tax"
      },
      discount: { type: "none", value: 0 },
      items: [Items.createLine()],
      notes: "",
      paperSize: settings.paperSize || "A4",
      currencyCode: "INR",
      businessSnapshot: null,
      createdAt: 0,
      updatedAt: 0,
      isNew: true
    };
  }

  function applyCalculated(doc, calc) {
    doc.items = calc.items.map(function (item) {
      return {
        id: item.id,
        catalogueItemId: item.catalogueItemId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        rateMinor: item.rateMinor,
        discountType: item.discountType,
        discountValue: item.discountValue,
        hsnSac: item.hsnSac,
        gstRate: item.gstRate,
        cgstMinor: item.cgstMinor,
        sgstMinor: item.sgstMinor,
        igstMinor: item.igstMinor,
        taxableValueMinor: item.taxableValueMinor,
        lineTotalMinor: item.lineTotalMinor
      };
    });
    doc.subtotalMinor = calc.subtotalMinor;
    doc.discountMinor = calc.discountMinor;
    doc.taxableValueMinor = calc.taxableValueMinor;
    doc.cgstMinor = calc.cgstMinor;
    doc.sgstMinor = calc.sgstMinor;
    doc.igstMinor = calc.igstMinor;
    doc.taxMinor = calc.taxMinor;
    doc.grandTotalMinor = calc.grandTotalMinor;
    if (doc.gst) {
      doc.gst.resolvedSupplyType = calc.supplyType;
    }
    return doc;
  }

  async function saveDocument(doc, settings) {
    var working = JSON.parse(JSON.stringify(doc));
    var calc = Calculations.calculateDocument(working, settings);
    applyCalculated(working, calc);

    if (!working.customer || !working.customer.name) {
      throw new Error("Customer name is required.");
    }
    if (!working.items.length) {
      throw new Error("Add at least one item.");
    }

    var isNew = !working.id || working.isNew;
    if (isNew) {
      var sequenceValue = Numbering.reserveNext(settings, working.documentType, working.invoiceDate);
      working.documentNumber = Numbering.buildDocumentNumber(
        settings,
        working.documentType,
        sequenceValue,
        working.invoiceDate
      );
      working.numberingSnapshot = {
        pattern: settings.numbering.pattern,
        sequenceValue: sequenceValue,
        prefix: (settings.numbering.prefixByType || {})[working.documentType] || ""
      };
      working.id = createId();
      working.createdAt = Date.now();
      await Settings.save(settings);
    }

    var duplicates = await StorageRepository.findInvoiceByNumber(working.documentNumber);
    for (var i = 0; i < duplicates.length; i += 1) {
      if (duplicates[i].id !== working.id) {
        throw new Error("Document number already exists: " + working.documentNumber);
      }
    }

    working.businessSnapshot = Settings.snapshot(settings);
    working.updatedAt = Date.now();
    delete working.isNew;
    await StorageRepository.put("invoices", working);
    return working;
  }

  async function listDocuments() {
    var rows = await StorageRepository.getAll("invoices");
    rows.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return rows;
  }

  async function getDocument(id) {
    return StorageRepository.get("invoices", id);
  }

  async function deleteDocument(id) {
    await StorageRepository.remove("invoices", id);
  }

  function duplicateDocument(doc, settings) {
    var copy = JSON.parse(JSON.stringify(doc));
    copy.id = null;
    copy.isNew = true;
    copy.createdAt = 0;
    copy.updatedAt = 0;
    copy.invoiceDate = todayIso();
    var peek = Numbering.peekNumber(settings, copy.documentType, copy.invoiceDate);
    copy.documentNumber = peek.documentNumber;
    copy.numberingSnapshot = {
      pattern: settings.numbering.pattern,
      sequenceValue: peek.sequenceValue
    };
    return copy;
  }

  global.DocumentEditor = {
    emptyDocument: emptyDocument,
    applyCalculated: applyCalculated,
    saveDocument: saveDocument,
    listDocuments: listDocuments,
    getDocument: getDocument,
    deleteDocument: deleteDocument,
    duplicateDocument: duplicateDocument,
    todayIso: todayIso
  };
})(window);
