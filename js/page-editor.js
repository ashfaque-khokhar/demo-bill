(function () {
  "use strict";

  var $ = AppUI.$;
  var setStatus = AppUI.setStatus;
  var confirmModal = AppUI.confirmModal;
  var showValidationFields = AppUI.showValidationFields;
  var clearValidationFields = AppUI.clearValidationFields;

  var OPEN_DOC_KEY = "billing.openDocId";
  var DRAFT_DOC_KEY = "billing.draftDocument";
  var PREVIEW_PREF_KEY = "billing.editor.previewOpen";

  var previewUserPreference = null;
  var resizeTimer = null;

  var state = {
    settings: null,
    document: null,
    logoUrl: null,
    logoDataUrl: null,
    dirty: false
  };

  var itemEditorEditingId = null;
  var itemEditorItemRef = null;

  function paperSize() {
    return (state.settings && state.settings.paperSize) || "A4";
  }

  var customerIds = {
    name: "customerName",
    mobile: "customerMobile",
    address: "customerAddress",
    email: "customerEmail",
    gstin: "customerGstin",
    state: "customerState",
    stateCode: "customerStateCode"
  };

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Could not read image."));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function loadLogo(settings) {
    state.logoUrl = "assets/logo-placeholder.svg";
    state.logoDataUrl = null;
    if (!settings.logoAssetId) {
      return;
    }
    var asset = await StorageRepository.get("assets", settings.logoAssetId);
    if (!asset || !asset.blob) {
      return;
    }
    if (state.logoUrl && state.logoUrl.indexOf("blob:") === 0) {
      URL.revokeObjectURL(state.logoUrl);
    }
    state.logoUrl = URL.createObjectURL(asset.blob);
    state.logoDataUrl = await blobToDataUrl(asset.blob);
  }

  function isWideViewport() {
    return window.matchMedia("(min-width: 1101px)").matches;
  }

  function readStoredPreviewPreference() {
    try {
      var raw = localStorage.getItem(PREVIEW_PREF_KEY);
      if (raw === "1") {
        return true;
      }
      if (raw === "0") {
        return false;
      }
    } catch (error) {
      /* ignore */
    }
    return null;
  }

  function defaultPreviewOpen() {
    return isWideViewport();
  }

  function resolvePreviewOpen() {
    if (previewUserPreference !== null) {
      return previewUserPreference;
    }
    return defaultPreviewOpen();
  }

  function applyPreviewVisibility(open) {
    var layout = $("editorLayout");
    var toggle = $("btnPreviewToggle");
    var closeBtn = $("btnPreviewClose");
    if (!layout || !toggle) {
      return;
    }
    layout.classList.toggle("preview-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Hide preview" : "Preview";
    if (closeBtn) {
      closeBtn.hidden = !open;
    }
  }

  function setPreviewOpen(open, persist) {
    applyPreviewVisibility(open);
    if (persist) {
      previewUserPreference = open;
      try {
        localStorage.setItem(PREVIEW_PREF_KEY, open ? "1" : "0");
      } catch (error) {
        /* ignore */
      }
    }
  }

  function initPreviewPanel() {
    previewUserPreference = readStoredPreviewPreference();
    applyPreviewVisibility(resolvePreviewOpen());

    var toggle = $("btnPreviewToggle");
    var closeBtn = $("btnPreviewClose");

    if (toggle) {
      toggle.addEventListener("click", function () {
        var layout = $("editorLayout");
        var open = layout && !layout.classList.contains("preview-open");
        setPreviewOpen(open, true);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setPreviewOpen(false, true);
      });
    }

    window.addEventListener("resize", function () {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(function () {
        if (previewUserPreference === null) {
          applyPreviewVisibility(defaultPreviewOpen());
        }
      }, 150);
    });
  }

  function fillDocumentTypes() {
    var select = $("documentType");
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
    DocumentTypes.getAll().forEach(function (type) {
      var opt = document.createElement("option");
      opt.value = type.id;
      opt.textContent = type.title;
      select.appendChild(opt);
    });
  }

  function isEditableDraft(doc) {
    return !!doc && !DocumentEditor.isGenerated(doc);
  }

  function applyDraftInvoiceDate(doc) {
    if (!doc || !isEditableDraft(doc)) {
      return;
    }
    doc.invoiceDate = DocumentEditor.todayIso();
  }

  function syncFormToDocument() {
    var doc = state.document;
    if (DocumentEditor.isGenerated(doc)) {
      return doc;
    }
    doc.documentType = $("documentType").value;
    if (isEditableDraft(doc) && (!doc.id || doc.isNew)) {
      applyDraftInvoiceDate(doc);
    }
    doc.paperSize = paperSize();
    doc.customer = Customers.readFromForm(customerIds);
    doc.gst.enabled = $("gstEnabled").value === "true";
    doc.gst.supplyType = $("supplyType").value;
    doc.gst.placeOfSupply = doc.customer.state || "";
    clearInvoiceDiscount(doc);
    doc.notes = $("notes").value;
    if (!Array.isArray(doc.items)) {
      doc.items = [];
    }
    return doc;
  }

  function formatCustomerPreview(name, mobile, address) {
    var parts = [name, mobile, address]
      .map(function (s) { return (s || "").trim(); })
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : "";
  }

  function syncCustomerSectionUi(setOpenFromDoc) {
    var section = $("docCustomerSection");
    var preview = $("customerPreview");
    if (!section || !preview) {
      return;
    }

    var name = $("customerName").value.trim();
    var mobile = $("customerMobile").value.trim();
    var address = $("customerAddress").value.trim();
    var allEmpty = !name && !mobile && !address;

    if (setOpenFromDoc) {
      section.open = !name;
    }

    if (section.open) {
      preview.hidden = true;
      return;
    }

    preview.textContent = allEmpty ? "Tap to add customer" : formatCustomerPreview(name, mobile, address);
    preview.hidden = false;
  }

  function syncDiscountValueInputMax(type, input) {
    if (!input) {
      return;
    }
    if (type === "percent") {
      input.max = "100";
      input.min = "0";
      input.step = "0.01";
    } else if (type === "fixed") {
      input.max = String(Validation.LIMITS.maxAmountRupees);
      input.min = "0";
      input.step = "0.01";
    } else {
      input.removeAttribute("max");
    }
  }

  function syncDiscountValueVisibility(type, input) {
    if (!input) {
      return;
    }
    input.classList.toggle("item-disc-value--hidden", type === "none");
  }

  function clearInvoiceDiscount(doc) {
    if (!doc || DocumentEditor.isGenerated(doc)) {
      return;
    }
    doc.discount = { type: "none", value: 0 };
  }

  function syncDocumentCardUi() {
    var typeId = $("documentType").value;
    var typeMeta = DocumentTypes.getById(typeId);
    var taxSection = $("docTaxSection");
    var showTax = typeMeta.showGstFields;

    if (taxSection) {
      taxSection.hidden = !showTax;
      if (!showTax) {
        taxSection.open = false;
      }
    }

    var supplyField = $("supplyTypeField");
    var gstOn = $("gstEnabled").value === "true";
    if (supplyField) {
      supplyField.classList.toggle("is-hidden", !gstOn || !showTax);
    }
  }

  function setFormControlsDisabled(disabled) {
    var editorForm = $("editorForm");
    if (editorForm) {
      editorForm.classList.toggle("editor-form--readonly", disabled);
    }

    [
      "documentType", "customerName", "customerMobile",
      "customerAddress", "customerEmail", "customerGstin", "customerState",
      "customerStateCode", "gstEnabled", "supplyType", "notes"
    ].forEach(function (id) {
      var node = $(id);
      if (node) {
        node.disabled = disabled;
      }
    });

    var customerSection = $("docCustomerSection");
    if (customerSection && disabled) {
      customerSection.open = false;
    }

    document.querySelectorAll("#itemsBody .row-actions button").forEach(function (node) {
      node.hidden = disabled;
    });
    var btnAddCenter = $("btnAddItemCenter");
    if (btnAddCenter) {
      btnAddCenter.disabled = disabled;
    }

    var btnAdd = $("btnAddItem");
    var btnSaveDraft = $("btnSaveDraft");
    var btnGenerate = $("btnGenerate");
    var notice = $("editorReadonlyNotice");
    var exportMenu = $("editorExportMenu");
    if (btnAdd) {
      btnAdd.hidden = disabled;
    }
    if (btnSaveDraft) {
      btnSaveDraft.hidden = disabled;
    }
    if (btnGenerate) {
      btnGenerate.hidden = disabled;
    }
    if (notice) {
      notice.hidden = !disabled;
    }
    if (exportMenu) {
      exportMenu.hidden = !disabled;
      if (!disabled) {
        exportMenu.open = false;
      }
    }
  }

  function applyEditorMode() {
    setFormControlsDisabled(DocumentEditor.isGenerated(state.document));
  }

  function syncDocumentToForm() {
    var doc = state.document;
    doc = DocumentEditor.normalizeDocument(doc);
    state.document = doc;
    if (isEditableDraft(doc) && (!doc.id || doc.isNew)) {
      applyDraftInvoiceDate(doc);
    }
    $("documentType").value = doc.documentType;
    Customers.writeToForm(doc.customer || Customers.emptyCustomer(), customerIds);
    $("gstEnabled").value = doc.gst && doc.gst.enabled ? "true" : "false";
    $("supplyType").value = (doc.gst && doc.gst.supplyType) || "auto";
    clearInvoiceDiscount(doc);
    $("notes").value = doc.notes || "";
    renderItemsList(doc.items || []);
    syncDocumentCardUi();
    syncCustomerSectionUi(true);
    applyEditorMode();
    refreshPreview();
  }

  function readOptionalNumber(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (!text || text === ".") {
      return 0;
    }
    var n = Number(text);
    return isFinite(n) ? n : 0;
  }

  function formatItemDiscountLabel(type, value) {
    if (type === "percent") {
      return value > 0 ? value + "%" : "—";
    }
    if (type === "fixed") {
      return value > 0 ? Money.formatINR(Money.toPaise(value)) : "—";
    }
    return "—";
  }

  function readGstFromItemEditor() {
    var sel = $("itemEditGst");
    if (!sel) {
      return 0;
    }
    if (sel.value === Items.GST_SELECT_OTHER) {
      var other = $("itemEditGstOther");
      var n = Number(other && other.value);
      return isFinite(n) ? n : 0;
    }
    return Number(sel.value) || 0;
  }

  function readLineFromItemEditor() {
    var nameEl = $("itemEditName");
    var qtyEl = $("itemEditQty");
    var unitEl = $("itemEditUnit");
    var rateEl = $("itemEditRate");
    var discTypeEl = $("itemEditDiscType");
    var discValEl = $("itemEditDiscValue");
    return {
      id: itemEditorEditingId || Items.createId(),
      catalogueItemId: itemEditorItemRef ? itemEditorItemRef.catalogueItemId || null : null,
      name: nameEl ? String(nameEl.value || "").trim() : "",
      quantity: readOptionalNumber(qtyEl ? qtyEl.value : ""),
      unit: unitEl ? String(unitEl.value || "").trim() : "",
      rateMinor: Money.toPaise(rateEl ? String(rateEl.value || "").trim() : ""),
      discountType: discTypeEl ? discTypeEl.value : "none",
      discountValue: Number(discValEl ? discValEl.value : 0) || 0,
      hsnSac: itemEditorItemRef ? itemEditorItemRef.hsnSac || "" : "",
      gstRate: readGstFromItemEditor()
    };
  }

  function previewEditorLineAmount(line) {
    var stub = {
      gst: state.document && state.document.gst ? state.document.gst : { enabled: false },
      items: [line]
    };
    var calc = Calculations.calculateDocument(stub, state.settings);
    if (calc.items && calc.items[0]) {
      return calc.items[0].lineTotalMinor;
    }
    return 0;
  }

  function updateItemEditorAmountPreview() {
    var el = $("itemEditAmount");
    if (!el) {
      return;
    }
    var line = readLineFromItemEditor();
    el.textContent = Money.formatINR(previewEditorLineAmount(line));
  }

  function syncItemEditorDiscVisibility() {
    var type = $("itemEditDiscType").value;
    syncDiscountValueInputMax(type, $("itemEditDiscValue"));
    var field = $("itemEditDiscValueField");
    if (field) {
      field.hidden = type === "none";
    }
  }

  function syncItemEditorGstOtherVisibility() {
    var isOther = $("itemEditGst").value === Items.GST_SELECT_OTHER;
    var field = $("itemEditGstOtherField");
    if (field) {
      field.hidden = !isOther;
    }
  }

  function populateItemEditorSelects() {
    var unitSel = $("itemEditUnit");
    if (unitSel && !unitSel.options.length) {
      Items.PRESET_UNITS.forEach(function (label) {
        var opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        unitSel.appendChild(opt);
      });
    }
    var gstSel = $("itemEditGst");
    if (gstSel && !gstSel.options.length) {
      Items.PRESET_GST_RATES.forEach(function (rate) {
        var opt = document.createElement("option");
        opt.value = String(rate);
        opt.textContent = rate + "%";
        gstSel.appendChild(opt);
      });
      var other = document.createElement("option");
      other.value = Items.GST_SELECT_OTHER;
      other.textContent = "Other";
      gstSel.appendChild(other);
    }
  }

  function fillItemEditorForm(item) {
    var line = item || Items.createLine({ quantity: 1 });
    var inDocument = item && (state.document.items || []).some(function (row) {
      return row.id === item.id;
    });
    itemEditorEditingId = inDocument ? item.id : null;
    itemEditorItemRef = item ? Object.assign({}, item) : null;
    $("itemEditorTitle").textContent = item ? "Edit item" : "Add item";
    $("itemEditName").value = line.name || "";
    $("itemEditQty").value = item ? String(line.quantity) : "1";
    $("itemEditUnit").value = Items.resolveUnitControl(line.unit || "Piece").value || "Piece";
    $("itemEditRate").value = item ? Money.fromPaise(line.rateMinor || 0).toFixed(2) : "";
    $("itemEditDiscType").value = line.discountType || "none";
    $("itemEditDiscValue").value = line.discountValue || "";
    var gstResolved = Items.resolveGstControl(line.gstRate);
    if (gstResolved.mode === "other") {
      $("itemEditGst").value = Items.GST_SELECT_OTHER;
      $("itemEditGstOther").value = gstResolved.value;
    } else {
      $("itemEditGst").value = String(gstResolved.value);
      $("itemEditGstOther").value = "";
    }
    syncItemEditorDiscVisibility();
    syncItemEditorGstOtherVisibility();
    updateItemEditorAmountPreview();
  }

  function openItemEditor(item) {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    populateItemEditorSelects();
    fillItemEditorForm(item);
    var backdrop = $("itemEditorBackdrop");
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    $("itemEditName").focus();
  }

  function closeItemEditor() {
    itemEditorEditingId = null;
    itemEditorItemRef = null;
    var backdrop = $("itemEditorBackdrop");
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
  }

  function validateItemEditorLine(line) {
    if (!line.name) {
      setStatus("Item name is required.", "error");
      return false;
    }
    if (!line.unit) {
      setStatus("Unit is required.", "error");
      return false;
    }
    if (!isFinite(line.quantity) || line.quantity <= 0) {
      setStatus("Quantity must be greater than zero.", "error");
      return false;
    }
    if (line.rateMinor <= 0) {
      setStatus("Rate must be greater than zero.", "error");
      return false;
    }
    return true;
  }

  function sanitizeLineFromTable(line) {
    return {
      id: line.id,
      catalogueItemId: line.catalogueItemId,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      rateMinor: line.rateMinor,
      discountType: line.discountType,
      discountValue: line.discountValue,
      hsnSac: line.hsnSac,
      gstRate: line.gstRate
    };
  }

  function saveItemFromEditor() {
    if (!state.document || DocumentEditor.isGenerated(state.document)) {
      return;
    }
    try {
      var line = sanitizeLineFromTable(readLineFromItemEditor());
      if (!validateItemEditorLine(line)) {
        return;
      }
      if (!state.document.items) {
        state.document.items = [];
      }
      var items = state.document.items;
      var updated = false;
      if (itemEditorEditingId) {
        for (var i = 0; i < items.length; i += 1) {
          if (items[i].id === itemEditorEditingId) {
            line.id = itemEditorEditingId;
            items[i] = line;
            updated = true;
            break;
          }
        }
      }
      if (!updated) {
        items.push(line);
      }
      closeItemEditor();
      state.dirty = true;
      clearValidationFields();
      renderItemsList(state.document.items);
      refreshPreview();
      setStatus(updated ? "Item updated." : "Item added.", "ok");
    } catch (error) {
      setStatus(error && error.message ? error.message : "Could not save item.", "error");
    }
  }

  function deleteItemById(itemId) {
    state.document.items = (state.document.items || []).filter(function (row) {
      return row.id !== itemId;
    });
    state.dirty = true;
    renderItemsList(state.document.items);
    refreshPreview();
  }

  function buildItemSummaryRow(item, amountMinor) {
    var tr = document.createElement("tr");
    tr.className = "items-summary-row";
    tr.setAttribute("data-id", item.id);

    function td(text, className) {
      var cell = document.createElement("td");
      if (className) {
        cell.className = className;
      }
      cell.textContent = text;
      return cell;
    }

    tr.appendChild(td(item.name || "", "item-name-cell"));
    tr.appendChild(td(String(item.quantity)));
    tr.appendChild(td(item.unit || ""));
    tr.appendChild(td(Money.formatINR(item.rateMinor || 0)));
    var discTd = document.createElement("td");
    discTd.className = "items-summary-disc";
    discTd.textContent = formatItemDiscountLabel(item.discountType, item.discountValue);
    tr.appendChild(discTd);
    tr.appendChild(td(String(item.gstRate) + "%"));
    var amountTd = document.createElement("td");
    amountTd.className = "item-amount";
    amountTd.textContent = Money.formatINR(amountMinor || 0);
    tr.appendChild(amountTd);

    var actions = document.createElement("td");
    actions.className = "item-row-actions";
    var wrap = document.createElement("div");
    wrap.className = "row-actions";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn ghost row-action-delete items-row-action";
    remove.setAttribute("aria-label", "Delete item");
    remove.title = "Delete";
    remove.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    remove.addEventListener("click", function (event) {
      event.stopPropagation();
      deleteItemById(item.id);
    });
    wrap.appendChild(remove);
    actions.appendChild(wrap);
    tr.appendChild(actions);

    tr.addEventListener("click", function () {
      if (DocumentEditor.isGenerated(state.document)) {
        return;
      }
      openItemEditor(item);
    });

    return tr;
  }

  function renderItemsList(items) {
    var meaningful = (items || []).filter(Validation.isMeaningfulLine);
    var emptyState = $("itemsEmptyState");
    var listWrap = $("itemsListWrap");
    var btnToolbarAdd = $("btnAddItem");
    if (emptyState) {
      emptyState.hidden = meaningful.length > 0;
    }
    if (listWrap) {
      listWrap.hidden = meaningful.length === 0;
    }
    if (btnToolbarAdd) {
      btnToolbarAdd.hidden = meaningful.length === 0;
    }

    var body = $("itemsBody");
    if (!body) {
      return;
    }
    while (body.firstChild) {
      body.removeChild(body.firstChild);
    }

    var calc = Calculations.calculateDocument(
      { items: meaningful, gst: state.document && state.document.gst },
      state.settings
    );
    var amountById = {};
    (calc.items || []).forEach(function (row) {
      if (row.id) {
        amountById[row.id] = row.lineTotalMinor;
      }
    });

    meaningful.forEach(function (item) {
      body.appendChild(buildItemSummaryRow(item, amountById[item.id]));
    });
  }

  function onEditorChange() {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    state.dirty = true;
    clearValidationFields();
    syncCustomerSectionUi(false);
    refreshPreview();
  }

  function refreshPreview() {
    if (state.document && isEditableDraft(state.document)) {
      state.document.documentType = $("documentType").value;
    }
    if (!DocumentEditor.isGenerated(state.document)) {
      syncFormToDocument();
    }
    var business = state.document.businessSnapshot || state.settings;
    var calc = Calculations.calculateDocument(state.document, state.settings);
    document.querySelectorAll("#itemsBody .item-amount").forEach(function (cell) {
      cell.textContent = Money.formatINR(0);
    });
    calc.items.forEach(function (item) {
      if (!item.id) {
        return;
      }
      var row = document.querySelector('#itemsBody tr[data-id="' + item.id + '"]');
      var amountCell = row && row.querySelector(".item-amount");
      if (amountCell) {
        amountCell.textContent = Money.formatINR(item.lineTotalMinor);
      }
    });

    var totals = $("totalsBox");
    while (totals.firstChild) {
      totals.removeChild(totals.firstChild);
    }
    function addRow(label, value, cls) {
      var row = document.createElement("div");
      row.className = "row" + (cls ? " " + cls : "");
      var a = document.createElement("span");
      a.textContent = label;
      var b = document.createElement("span");
      b.textContent = value;
      row.appendChild(a);
      row.appendChild(b);
      totals.appendChild(row);
    }
    addRow("Subtotal", Money.formatINR(calc.subtotalMinor));
    if (calc.discountMinor > 0) {
      addRow("Discount", "- " + Money.formatINR(calc.discountMinor));
    }
    if (state.document.gst.enabled) {
      addRow("Taxable", Money.formatINR(calc.taxableValueMinor));
      if (calc.cgstMinor) {
        addRow("CGST", Money.formatINR(calc.cgstMinor));
      }
      if (calc.sgstMinor) {
        addRow("SGST", Money.formatINR(calc.sgstMinor));
      }
      if (calc.igstMinor) {
        addRow("IGST", Money.formatINR(calc.igstMinor));
      }
    }
    addRow("Grand Total", Money.formatINR(calc.grandTotalMinor), "grand");

    $("previewPaper").className = "preview-paper " + String(paperSize()).toLowerCase();
    var displayNumber = DocumentEditor.displayDocumentNumber(state.document, state.settings);
    Preview.render($("invoicePreview"), state.document, calc, business, state.logoUrl, displayNumber);
    return calc;
  }

  async function startNewDocument(typeId) {
    state.document = DocumentEditor.emptyDocument(state.settings, typeId || "tax-invoice");
    state.dirty = false;
    syncDocumentToForm();
    setStatus("New document ready.", "info");
  }

  var customerFieldIds = [
    "customerName",
    "customerMobile",
    "customerAddress",
    "customerEmail",
    "customerGstin",
    "customerState",
    "customerStateCode"
  ];

  function openDetailsForField(fieldId) {
    var input = $(fieldId);
    if (!input) {
      return;
    }
    var details = input.closest("details.settings-section");
    if (details) {
      details.open = true;
    }
  }

  function focusValidationSections(fields) {
    if (!fields) {
      return;
    }
    var keys = Object.keys(fields);
    keys.forEach(openDetailsForField);
    if (keys.some(function (k) {
      return customerFieldIds.indexOf(k) >= 0;
    })) {
      var customerSection = $("docCustomerSection");
      if (customerSection) {
        customerSection.open = true;
      }
    }
  }

  function runDocumentValidation() {
    syncFormToDocument();
    clearValidationFields();
    var businessResult = Validation.validateBusinessSettings(state.settings);
    var docResult = Validation.validateDocument(state.document, state.settings, "generate");
    var merged = Validation.mergeResults([businessResult, docResult]);
    if (!merged.ok) {
      var message = merged.message;
      if (businessResult && !businessResult.ok) {
        message = message + " Open Settings to update your business profile.";
      }
      setStatus(message, "error");
      if (merged.fields && Object.keys(merged.fields).length) {
        showValidationFields(merged.fields);
        focusValidationSections(merged.fields);
      } else if (message.indexOf("Supplier state") >= 0) {
        var taxSec = $("docTaxSection");
        if (taxSec) {
          taxSec.open = true;
        }
      }
      return false;
    }
    return true;
  }

  async function saveDraftCurrent() {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    if (!runDocumentValidation()) {
      return;
    }
    try {
      var saved = await DocumentEditor.saveDraft(state.document, state.settings);
      state.document = saved;
      state.dirty = false;
      syncDocumentToForm();
      setStatus("Draft saved (" + DocumentEditor.displayDocumentNumber(saved, state.settings) + ").", "ok");
    } catch (error) {
      setStatus(error.message || "Save failed.", "error");
    }
  }

  async function generateCurrent() {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    if (!runDocumentValidation()) {
      return;
    }
    var ok = await confirmModal(
      "Generate invoice?",
      "After you generate, this invoice cannot be edited or deleted. Duplicate from History if you need a new copy.",
      [
        { label: "Cancel", value: false, className: "secondary" },
        { label: "Generate", value: true, className: "" }
      ]
    );
    if (!ok) {
      return;
    }
    try {
      var saved = await DocumentEditor.generateDocument(state.document, state.settings);
      state.document = saved;
      state.dirty = false;
      syncDocumentToForm();
      setStatus("Generated " + saved.documentNumber + ".", "ok");
    } catch (error) {
      setStatus(error.message || "Generate failed.", "error");
    }
  }

  async function handleLogoUpload(file) {
    if (!file) {
      return;
    }
    if (!/image\/(png|jpeg|webp)/.test(file.type)) {
      setStatus("Logo must be PNG, JPEG, or WebP.", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatus("Logo must be 2 MB or smaller.", "error");
      return;
    }
    var assetId = "logo-default";
    await StorageRepository.put("assets", {
      id: assetId,
      mimeType: file.type,
      blob: file,
      createdAt: Date.now()
    });
    state.settings.logoAssetId = assetId;
    await Settings.save(state.settings);
    await loadLogo(state.settings);
    if (state.document) {
      refreshPreview();
    }
    setStatus("Logo saved.", "ok");
  }

  async function consumeSessionHandoff() {
    var openId = sessionStorage.getItem(OPEN_DOC_KEY);
    if (openId) {
      sessionStorage.removeItem(OPEN_DOC_KEY);
      var row = await DocumentEditor.getDocument(openId);
      if (row) {
        state.document = row;
        state.dirty = false;
        syncDocumentToForm();
        setStatus(
          DocumentEditor.isGenerated(row)
            ? "Opened " + row.documentNumber + " (read only)."
            : "Opened draft " + DocumentEditor.displayDocumentNumber(row, state.settings) + ".",
          "info"
        );
        return true;
      }
      setStatus("Could not open that document.", "error");
    }

    var draftRaw = sessionStorage.getItem(DRAFT_DOC_KEY);
    if (draftRaw) {
      sessionStorage.removeItem(DRAFT_DOC_KEY);
      try {
        state.document = DocumentEditor.normalizeDocument(JSON.parse(draftRaw));
        state.dirty = true;
        syncDocumentToForm();
        setStatus("Duplicated as a new draft. Save draft or generate when ready.", "info");
        return true;
      } catch (error) {
        setStatus("Could not load duplicated document.", "error");
      }
    }
    return false;
  }

  function closeExportMenu() {
    var menu = $("editorExportMenu");
    if (menu) {
      menu.open = false;
    }
  }

  function bindItemEditor() {
    populateItemEditorSelects();
    var form = $("itemEditorForm");
    if (AppUI.bindTextLimits && form) {
      AppUI.bindTextLimits(form);
    }
    if (AppUI.bindNonNegativeDecimalInput) {
      AppUI.bindNonNegativeDecimalInput($("itemEditQty"), true);
      AppUI.bindNonNegativeDecimalInput($("itemEditRate"), true);
      AppUI.bindNonNegativeDecimalInput($("itemEditDiscValue"), true);
      AppUI.bindNonNegativeDecimalInput($("itemEditGstOther"), true);
    }
    [
      "itemEditName", "itemEditQty", "itemEditRate",
      "itemEditDiscValue", "itemEditGstOther"
    ].forEach(function (id) {
      var node = $(id);
      if (node) {
        node.addEventListener("input", updateItemEditorAmountPreview);
      }
    });
    var discType = $("itemEditDiscType");
    if (discType) {
      discType.addEventListener("change", function () {
        syncItemEditorDiscVisibility();
        updateItemEditorAmountPreview();
      });
    }
    var gstSel = $("itemEditGst");
    if (gstSel) {
      gstSel.addEventListener("change", function () {
        syncItemEditorGstOtherVisibility();
        updateItemEditorAmountPreview();
      });
    }
    var cancelBtn = $("itemEditCancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", closeItemEditor);
    }
    var saveBtn = $("itemEditSave");
    if (saveBtn) {
      saveBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        saveItemFromEditor();
      });
    }
    var addCenter = $("btnAddItemCenter");
    if (addCenter) {
      addCenter.addEventListener("click", function () {
        openItemEditor(null);
      });
    }
    var addToolbar = $("btnAddItem");
    if (addToolbar) {
      addToolbar.addEventListener("click", function () {
        openItemEditor(null);
      });
    }
    var backdrop = $("itemEditorBackdrop");
    if (backdrop) {
      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop) {
          closeItemEditor();
        }
      });
    }
  }

  function bindEvents() {
    bindItemEditor();
    var customerSection = $("docCustomerSection");
    if (customerSection) {
      customerSection.addEventListener("toggle", function () {
        syncCustomerSectionUi(false);
      });
    }

    [
      "documentType", "customerName", "customerMobile",
      "customerAddress", "customerEmail", "customerGstin", "customerState",
      "customerStateCode", "gstEnabled", "supplyType", "notes"
    ].forEach(function (id) {
      var node = $(id);
      node.addEventListener("input", onEditorChange);
      node.addEventListener("change", function () {
        if (id === "documentType") {
          if (isEditableDraft(state.document)) {
            state.document.documentType = $("documentType").value;
            if (!state.document.id || state.document.isNew) {
              applyDraftInvoiceDate(state.document);
            }
            if ($("documentType").value === "tax-invoice") {
              $("gstEnabled").value = "true";
            }
          }
          if ($("documentType").value === "tax-invoice") {
            var taxSec = $("docTaxSection");
            if (taxSec) {
              taxSec.open = true;
            }
          }
        }
        if (id === "documentType" || id === "gstEnabled") {
          syncDocumentCardUi();
        }
        onEditorChange();
      });
    });

    $("btnPickCatalogue").addEventListener("click", async function () {
      if (DocumentEditor.isGenerated(state.document)) {
        return;
      }
      state.catalogue = await Items.listCatalogue();
      if (!state.catalogue.length) {
        setStatus("Catalogue is empty. Save an item first.", "info");
        return;
      }
      var labels = state.catalogue.map(function (entry, index) {
        return (index + 1) + ". " + entry.name + " (" + Money.formatINR(entry.defaultRateMinor || 0) + ")";
      }).join("\n");
      var choice = window.prompt("Enter catalogue item number:\n" + labels, "1");
      var index = Number(choice) - 1;
      if (!isFinite(index) || index < 0 || index >= state.catalogue.length) {
        return;
      }
      openItemEditor(Items.fromCatalogue(state.catalogue[index]));
    });

    var btnSaveDraft = $("btnSaveDraft");
    var btnGenerate = $("btnGenerate");
    if (btnSaveDraft) {
      btnSaveDraft.addEventListener("click", saveDraftCurrent);
    } else {
      setStatus("Save draft control missing — hard refresh the page (Ctrl+Shift+R).", "error");
    }
    if (btnGenerate) {
      btnGenerate.addEventListener("click", generateCurrent);
    } else {
      setStatus("Generate control missing — hard refresh the page (Ctrl+Shift+R).", "error");
    }
    $("btnNew").addEventListener("click", async function () {
      if (state.dirty) {
        var ok = await confirmModal("Start new document?", "Unsaved changes will be lost.", [
          { label: "Cancel", value: false },
          { label: "Continue", value: true, className: "" }
        ]);
        if (!ok) {
          return;
        }
      }
      await startNewDocument($("documentType").value);
    });
    $("btnPng").addEventListener("click", async function () {
      closeExportMenu();
      if (!runDocumentValidation()) {
        return;
      }
      try {
        refreshPreview();
        await ExportPng.exportPng($("invoicePreview"), state.document);
        setStatus("PNG downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "PNG export failed.", "error");
      }
    });
    $("btnPdf").addEventListener("click", async function () {
      closeExportMenu();
      if (!runDocumentValidation()) {
        return;
      }
      try {
        var calc = refreshPreview();
        var business = state.document.businessSnapshot || state.settings;
        await ExportPdf.exportPdf(state.document, calc, business, state.logoDataUrl, paperSize());
        setStatus("PDF downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "PDF export failed.", "error");
      }
    });
    $("btnPrint").addEventListener("click", function () {
      closeExportMenu();
      if (!runDocumentValidation()) {
        return;
      }
      refreshPreview();
      Print.printDocument();
      setStatus("Print dialog opened.", "info");
    });
  }

  async function init() {
    try {
      fillDocumentTypes();
      bindEvents();
      initPreviewPanel();
      state.settings = await Settings.load();
      await loadLogo(state.settings);
      var handedOff = await consumeSessionHandoff();
      if (!handedOff) {
        await startNewDocument("tax-invoice");
      }
      var started = Onboarding.maybeStart(state.settings, {
        onStatus: setStatus,
        onSaved: function (settings) {
          state.settings = settings;
          refreshPreview();
        },
        onComplete: function (settings) {
          state.settings = settings;
          refreshPreview();
        },
        onLogoUpload: handleLogoUpload,
        getLogoUrl: function () {
          return state.logoUrl;
        }
      });
      if (!handedOff) {
        if (!started) {
          setStatus("Ready. Data stays in this browser — use Backup regularly.", "info");
        } else {
          setStatus("Complete setup, or skip steps to start billing.", "info");
        }
      }
    } catch (error) {
      setStatus(error.message || "Could not start the app.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
