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

  function isGenerated(doc) {
    return !!doc && doc.lifecycleStatus === "generated";
  }

  function normalizeDocument(doc) {
    if (!doc) {
      return doc;
    }
    var normalized = doc;
    if (!normalized.lifecycleStatus) {
      if ((typeof normalized.generatedAt === "number" && normalized.generatedAt > 0) ||
          (normalized.numberReserved === true && normalized.documentNumber)) {
        normalized.lifecycleStatus = "generated";
      } else {
        normalized.lifecycleStatus = "draft";
      }
    }
    if (typeof normalized.numberReserved !== "boolean") {
      normalized.numberReserved = normalized.lifecycleStatus === "generated";
    }
    if (typeof normalized.generatedAt !== "number") {
      normalized.generatedAt = normalized.lifecycleStatus === "generated" ? normalized.updatedAt || 0 : 0;
    }
    if (!isGenerated(normalized) && !normalized.numberReserved) {
      normalized.documentNumber = "";
    }
    if (Array.isArray(normalized.items)) {
      normalized.items.forEach(function (line) {
        if (line && "description" in line) {
          delete line.description;
        }
      });
    }
    return normalized;
  }

  function displayDocumentNumber(doc, settings) {
    if (!doc) {
      return "—";
    }
    if (isGenerated(doc) && doc.documentNumber) {
      return doc.documentNumber;
    }
    if (!settings) {
      return doc.documentNumber || "—";
    }
    var peek = Numbering.peekNumber(settings, doc.documentType, doc.invoiceDate);
    return "~" + peek.documentNumber;
  }

  function clearDraftDocumentNumber(working) {
    working.documentNumber = "";
    working.numberingSnapshot = null;
  }

  function emptyDocument(settings, documentType) {
    var typeId = documentType || "tax-invoice";
    return {
      id: null,
      schemaVersion: 1,
      documentType: typeId,
      documentNumber: "",
      numberingSnapshot: null,
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
      items: [],
      notes: "",
      paperSize: settings.paperSize || "A4",
      currencyCode: "INR",
      businessSnapshot: null,
      lifecycleStatus: "draft",
      generatedAt: 0,
      numberReserved: false,
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

  function validateWorkingDocument(working, settings) {
    Validation.assertValid(Validation.validateDocument(working, settings, "generate"));
  }

  async function isDocumentNumberAvailable(documentNumber, excludeId) {
    var duplicates = await StorageRepository.findInvoiceByNumber(documentNumber);
    for (var i = 0; i < duplicates.length; i += 1) {
      if (duplicates[i].id !== excludeId) {
        return false;
      }
    }
    return true;
  }

  async function assignDraftDocumentNumber(working, settings, generatedAt) {
    var peek = Numbering.peekNumber(settings, working.documentType, working.invoiceDate);
    var sequenceValue = peek.sequenceValue;
    var documentNumber = Numbering.buildDocumentNumber(
      settings,
      working.documentType,
      sequenceValue,
      working.invoiceDate,
      generatedAt
    );
    var attempts = 0;
    while (attempts < 10000) {
      if (await isDocumentNumberAvailable(documentNumber, working.id)) {
        working.documentNumber = documentNumber;
        working.numberingSnapshot = {
          pattern: settings.numbering.pattern,
          sequenceValue: sequenceValue
        };
        return;
      }
      sequenceValue += 1;
      documentNumber = Numbering.buildDocumentNumber(
        settings,
        working.documentType,
        sequenceValue,
        working.invoiceDate,
        generatedAt
      );
      attempts += 1;
    }
    throw new Error("Could not assign a draft document number.");
  }

  async function assertUniqueDocumentNumber(working) {
    var duplicates = await StorageRepository.findInvoiceByNumber(working.documentNumber);
    for (var i = 0; i < duplicates.length; i += 1) {
      if (duplicates[i].id !== working.id) {
        throw new Error("Document number already exists: " + working.documentNumber);
      }
    }
  }

  async function saveDraft(doc, settings) {
    var working = JSON.parse(JSON.stringify(doc));
    normalizeDocument(working);
    if (isGenerated(working)) {
      throw new Error("Generated invoices cannot be changed. Duplicate to edit.");
    }

    var calc = Calculations.calculateDocument(working, settings);
    applyCalculated(working, calc);
    validateWorkingDocument(working, settings);

    var isNew = !working.id || working.isNew;
    if (isNew) {
      working.id = createId();
      working.createdAt = Date.now();
      working.numberReserved = false;
    }

    working.lifecycleStatus = "draft";
    working.numberReserved = false;
    clearDraftDocumentNumber(working);

    working.businessSnapshot = Settings.snapshot(settings);
    working.updatedAt = Date.now();
    delete working.isNew;
    await StorageRepository.put("invoices", working);
    return normalizeDocument(working);
  }

  async function generateDocument(doc, settings) {
    var working = JSON.parse(JSON.stringify(doc));
    normalizeDocument(working);
    if (isGenerated(working)) {
      throw new Error("This invoice is already generated.");
    }

    var calc = Calculations.calculateDocument(working, settings);
    applyCalculated(working, calc);
    validateWorkingDocument(working, settings);

    var isNew = !working.id || working.isNew;
    if (isNew) {
      working.id = createId();
      working.createdAt = Date.now();
    }

    var generatedAt = Date.now();
    working.generatedAt = generatedAt;

    if (!working.numberReserved) {
      await assignDraftDocumentNumber(working, settings, generatedAt);
      var sequenceValue = working.numberingSnapshot.sequenceValue;
      Numbering.consumeSequenceValue(settings, working.documentType, working.invoiceDate, sequenceValue);
      working.documentNumber = Numbering.buildDocumentNumber(
        settings,
        working.documentType,
        sequenceValue,
        working.invoiceDate,
        generatedAt
      );
      working.numberingSnapshot = {
        pattern: settings.numbering.pattern,
        sequenceValue: sequenceValue,
        prefix: (settings.numbering.prefixByType || {})[working.documentType] || ""
      };
      working.numberReserved = true;
      await Settings.save(settings);
    }

    await assertUniqueDocumentNumber(working);

    working.lifecycleStatus = "generated";
    working.businessSnapshot = Settings.snapshot(settings);
    working.updatedAt = Date.now();
    delete working.isNew;
    await StorageRepository.put("invoices", working);
    return normalizeDocument(working);
  }

  async function listDocuments() {
    var rows = await StorageRepository.getAll("invoices");
    rows = rows.map(normalizeDocument);
    rows.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return rows;
  }

  async function getDocument(id) {
    var row = await StorageRepository.get("invoices", id);
    return normalizeDocument(row);
  }

  async function deleteDocument(id) {
    var row = await getDocument(id);
    if (row && isGenerated(row)) {
      throw new Error("Generated invoices cannot be deleted.");
    }
    await StorageRepository.remove("invoices", id);
  }

  function duplicateDocument(doc, settings) {
    var copy = JSON.parse(JSON.stringify(doc));
    copy.id = null;
    copy.isNew = true;
    copy.createdAt = 0;
    copy.updatedAt = 0;
    copy.lifecycleStatus = "draft";
    copy.generatedAt = 0;
    copy.numberReserved = false;
    copy.businessSnapshot = null;
    copy.invoiceDate = todayIso();
    delete copy.subtotalMinor;
    delete copy.discountMinor;
    delete copy.taxableValueMinor;
    delete copy.cgstMinor;
    delete copy.sgstMinor;
    delete copy.igstMinor;
    delete copy.taxMinor;
    delete copy.grandTotalMinor;
    clearDraftDocumentNumber(copy);
    return copy;
  }

  global.DocumentEditor = {
    emptyDocument: emptyDocument,
    applyCalculated: applyCalculated,
    saveDraft: saveDraft,
    generateDocument: generateDocument,
    listDocuments: listDocuments,
    getDocument: getDocument,
    deleteDocument: deleteDocument,
    duplicateDocument: duplicateDocument,
    normalizeDocument: normalizeDocument,
    isGenerated: isGenerated,
    displayDocumentNumber: displayDocumentNumber,
    clearDraftDocumentNumber: clearDraftDocumentNumber,
    todayIso: todayIso
  };
})(window);