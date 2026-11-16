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
    catalogue: [],
    dirty: false
  };

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
    doc.items = readItemsFromTable();
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

    document.querySelectorAll("#itemsBody input, #itemsBody select, #itemsBody textarea").forEach(function (node) {
      node.disabled = disabled;
    });
    document.querySelectorAll("#itemsBody .row-actions button").forEach(function (node) {
      node.hidden = disabled;
    });

    var btnAdd = $("btnAddItem");
    var btnPick = $("btnPickCatalogue");
    var btnSaveDraft = $("btnSaveDraft");
    var btnGenerate = $("btnGenerate");
    var notice = $("editorReadonlyNotice");
    var exportMenu = $("editorExportMenu");
    if (btnAdd) {
      btnAdd.hidden = disabled;
    }
    if (btnPick) {
      btnPick.hidden = disabled;
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
    renderItemsTable(doc.items || []);
    ensureTrailingEmptyRow();
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

  function isRowBlank(tr) {
    if (!tr) {
      return true;
    }
    var nameEl = tr.querySelector(".item-name");
    if (nameEl && nameEl.value.trim()) {
      return false;
    }
    var qtyEl = tr.querySelector(".item-qty");
    if (qtyEl && qtyEl.value.trim()) {
      return false;
    }
    var unitSel = tr.querySelector(".item-unit");
    if (unitSel && unitSel.value) {
      return false;
    }
    var rateEl = tr.querySelector(".item-rate");
    if (rateEl && rateEl.value.trim()) {
      return false;
    }
    var discType = tr.querySelector(".item-disc-type");
    if (discType && discType.value && discType.value !== "none") {
      return false;
    }
    var discValue = tr.querySelector(".item-disc-value");
    if (discValue && discValue.value.trim() && readOptionalNumber(discValue.value) > 0) {
      return false;
    }
    var gstSel = tr.querySelector(".item-gst");
    if (gstSel && gstSel.value) {
      return false;
    }
    var hsnEl = tr.querySelector(".item-hsn");
    if (hsnEl && hsnEl.value.trim()) {
      return false;
    }
    return true;
  }

  function isRowComplete(tr) {
    if (!tr) {
      return false;
    }
    var nameEl = tr.querySelector(".item-name");
    if (!nameEl || !nameEl.value.trim()) {
      return false;
    }
    if (!Items.readUnitFromRow(tr)) {
      return false;
    }
    var qty = readOptionalNumber(tr.querySelector(".item-qty") && tr.querySelector(".item-qty").value);
    if (!isFinite(qty) || qty <= 0) {
      return false;
    }
    var rateInput = tr.querySelector(".item-rate") ? tr.querySelector(".item-rate").value.trim() : "";
    if (!rateInput || Money.toPaise(rateInput) <= 0) {
      return false;
    }
    return true;
  }

  function focusRowName(tr) {
    var nameField = tr && tr.querySelector(".item-name");
    if (nameField) {
      nameField.focus();
    }
  }

  function appendEmptyItemRow() {
    var body = $("itemsBody");
    if (!body) {
      return;
    }
    body.appendChild(buildItemRow(Items.createLine({ displayEmpty: true })));
  }

  function ensureTrailingEmptyRow() {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    var rows = document.querySelectorAll("#itemsBody tr");
    if (!rows.length) {
      appendEmptyItemRow();
      return;
    }
    if (isRowComplete(rows[rows.length - 1])) {
      appendEmptyItemRow();
    }
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

  function readItemsFromTable() {
    var rows = Array.prototype.slice.call(document.querySelectorAll("#itemsBody tr"));
    return rows.map(function (tr) {
      var discountType = tr.querySelector(".item-disc-type").value;
      var discountValue = Number(tr.querySelector(".item-disc-value").value) || 0;
      return sanitizeLineFromTable({
        id: tr.getAttribute("data-id"),
        catalogueItemId: tr.getAttribute("data-catalogue-id") || null,
        name: tr.querySelector(".item-name").value.trim(),
        quantity: readOptionalNumber(tr.querySelector(".item-qty").value),
        unit: Items.readUnitFromRow(tr),
        rateInput: tr.querySelector(".item-rate").value.trim(),
        rateMinor: Money.toPaise(tr.querySelector(".item-rate").value),
        discountType: discountType,
        discountValue: discountValue,
        hsnSac: tr.querySelector(".item-hsn").value.trim(),
        gstRate: Items.readGstFromRow(tr)
      });
    }).filter(function (line) {
      return Validation.isMeaningfulLine(line);
    });
  }

  function renderItemsTable(items) {
    var body = $("itemsBody");
    while (body.firstChild) {
      body.removeChild(body.firstChild);
    }
    items.forEach(function (item) {
      body.appendChild(buildItemRow(item));
    });
  }

  function buildItemRow(item) {
    var tr = document.createElement("tr");
    tr.setAttribute("data-id", item.id);
    if (item.catalogueItemId) {
      tr.setAttribute("data-catalogue-id", item.catalogueItemId);
    }
    var displayEmpty = !!item.displayEmpty;

    function cellInput(className, value, type, placeholder, textLimitKey) {
      var td = document.createElement("td");
      var input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") {
        input.type = type || "text";
      }
      input.className = className;
      if (textLimitKey) {
        input.setAttribute("data-text-limit", textLimitKey);
      }
      if (className === "item-rate") {
        if (AppUI.bindNonNegativeDecimalInput) {
          AppUI.bindNonNegativeDecimalInput(input, true);
        }
      }
      if (className === "item-qty") {
        input.min = "0";
        if (AppUI.bindNonNegativeDecimalInput) {
          AppUI.bindNonNegativeDecimalInput(input, true);
        }
      }
      if (className === "item-gst") {
        input.min = "0";
        input.max = "100";
        if (AppUI.bindNonNegativeDecimalInput) {
          AppUI.bindNonNegativeDecimalInput(input, true);
        }
      }
      if (displayEmpty) {
        input.value = "";
        if (placeholder != null) {
          input.placeholder = placeholder;
        }
      } else {
        input.value = value == null ? "" : value;
      }
      input.addEventListener("input", onEditorChange);
      td.appendChild(input);
      return td;
    }

    var nameTd = document.createElement("td");
    nameTd.className = "item-name-cell";
    var name = document.createElement("input");
    name.type = "text";
    name.className = "item-name";
    name.setAttribute("data-text-limit", "lineItemName");
    name.placeholder = "Name";
    name.value = item.name || "";
    name.addEventListener("input", onEditorChange);
    nameTd.appendChild(name);
    tr.appendChild(nameTd);

    tr.appendChild(cellInput("item-qty", item.quantity, "text", "1", "lineItemQuantity"));

    var unitTd = document.createElement("td");
    unitTd.className = "item-unit-cell";
    var unitResolved = Items.resolveUnitControl(displayEmpty ? "" : item.unit || "");
    var unitSelect = document.createElement("select");
    unitSelect.className = "item-unit";
    if (unitResolved.mode === "empty") {
      var unitPlaceholder = document.createElement("option");
      unitPlaceholder.value = "";
      unitPlaceholder.textContent = "Unit";
      unitPlaceholder.disabled = true;
      unitPlaceholder.selected = true;
      unitSelect.appendChild(unitPlaceholder);
    }
    Items.PRESET_UNITS.forEach(function (label) {
      var opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;
      unitSelect.appendChild(opt);
    });
    var unitOtherOpt = document.createElement("option");
    unitOtherOpt.value = Items.UNIT_SELECT_OTHER;
    unitOtherOpt.textContent = "Other";
    unitSelect.appendChild(unitOtherOpt);
    var unitOther = document.createElement("input");
    unitOther.type = "text";
    unitOther.className = "item-unit-other item-unit-other--hidden";
    unitOther.placeholder = "Unit";
    unitOther.setAttribute("data-text-limit", "lineItemUnit");
    if (unitResolved.mode === "preset") {
      unitSelect.value = unitResolved.value;
    } else if (unitResolved.mode === "other") {
      unitSelect.value = Items.UNIT_SELECT_OTHER;
      unitOther.value = unitResolved.value;
      unitOther.classList.remove("item-unit-other--hidden");
    }
    function syncUnitOtherVisibility() {
      var isOther = unitSelect.value === Items.UNIT_SELECT_OTHER;
      unitOther.classList.toggle("item-unit-other--hidden", !isOther);
    }
    unitSelect.addEventListener("change", function () {
      syncUnitOtherVisibility();
      if (unitSelect.value === Items.UNIT_SELECT_OTHER) {
        unitOther.focus();
      }
      onEditorChange();
    });
    unitOther.addEventListener("input", onEditorChange);
    unitTd.appendChild(unitSelect);
    unitTd.appendChild(unitOther);
    tr.appendChild(unitTd);

    tr.appendChild(cellInput(
      "item-rate",
      Money.fromPaise(item.rateMinor || 0).toFixed(2),
      "text",
      "0.00",
      "lineItemRate"
    ));

    var discTd = document.createElement("td");
    var discType = document.createElement("select");
    discType.className = "item-disc-type";
    [["none", "None"], ["percent", "%"], ["fixed", "₹"]].forEach(function (pair) {
      var opt = document.createElement("option");
      opt.value = pair[0];
      opt.textContent = pair[1];
      discType.appendChild(opt);
    });
    discType.value = item.discountType || "none";
    var discValue = document.createElement("input");
    discValue.type = "number";
    discValue.className = "item-disc-value";
    if (displayEmpty) {
      discValue.value = "";
      discValue.placeholder = "0";
    } else {
      discValue.value = item.discountValue || 0;
    }
    discValue.addEventListener("input", onEditorChange);
    if (AppUI.bindNonNegativeDecimalInput) {
      AppUI.bindNonNegativeDecimalInput(discValue, true);
    }
    syncDiscountValueInputMax(discType.value, discValue);
    discType.addEventListener("change", function () {
      syncDiscountValueInputMax(discType.value, discValue);
      onEditorChange();
    });
    discTd.className = "item-disc-cell";
    discTd.appendChild(discType);
    discTd.appendChild(discValue);
    tr.appendChild(discTd);

    var gstTd = document.createElement("td");
    gstTd.className = "item-gst-cell";
    var gstResolved = displayEmpty
      ? { mode: "empty", value: 0 }
      : Items.resolveGstControl(item.gstRate);
    var gstSelect = document.createElement("select");
    gstSelect.className = "item-gst";
    if (displayEmpty) {
      var gstPlaceholder = document.createElement("option");
      gstPlaceholder.value = "";
      gstPlaceholder.textContent = "0";
      gstPlaceholder.disabled = true;
      gstPlaceholder.selected = true;
      gstSelect.appendChild(gstPlaceholder);
    }
    Items.PRESET_GST_RATES.forEach(function (rate) {
      var opt = document.createElement("option");
      opt.value = String(rate);
      opt.textContent = rate + "%";
      gstSelect.appendChild(opt);
    });
    var gstOtherOpt = document.createElement("option");
    gstOtherOpt.value = Items.GST_SELECT_OTHER;
    gstOtherOpt.textContent = "Other";
    gstSelect.appendChild(gstOtherOpt);
    var gstOther = document.createElement("input");
    gstOther.type = "number";
    gstOther.className = "item-gst-other item-gst-other--hidden";
    gstOther.min = "0";
    gstOther.max = "100";
    gstOther.step = "any";
    gstOther.placeholder = "0";
    if (gstResolved.mode === "preset") {
      gstSelect.value = String(gstResolved.value);
    } else if (gstResolved.mode === "other") {
      gstSelect.value = Items.GST_SELECT_OTHER;
      gstOther.value = gstResolved.value;
      gstOther.classList.remove("item-gst-other--hidden");
    }
    function syncGstOtherVisibility() {
      var isOther = gstSelect.value === Items.GST_SELECT_OTHER;
      gstOther.classList.toggle("item-gst-other--hidden", !isOther);
    }
    gstSelect.addEventListener("change", function () {
      syncGstOtherVisibility();
      onEditorChange();
    });
    gstOther.addEventListener("input", onEditorChange);
    gstTd.appendChild(gstSelect);
    gstTd.appendChild(gstOther);
    tr.appendChild(gstTd);

    tr.appendChild(cellInput("item-hsn", item.hsnSac || "", "text", null, "hsnSac"));

    var amountTd = document.createElement("td");
    amountTd.className = "item-amount";
    amountTd.textContent = Money.formatINR(0);
    tr.appendChild(amountTd);

    var actions = document.createElement("td");
    actions.className = "item-row-actions";
    var wrap = document.createElement("div");
    wrap.className = "row-actions";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn ghost row-action-delete";
    remove.setAttribute("aria-label", "Delete row");
    remove.title = "Delete row";
    remove.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    remove.addEventListener("click", function () {
      var bodyRows = document.querySelectorAll("#itemsBody tr");
      if (bodyRows.length <= 1) {
        setStatus("Keep at least one line item row.", "info");
        return;
      }
      tr.remove();
      onEditorChange();
    });
    wrap.appendChild(remove);
    actions.appendChild(wrap);
    tr.appendChild(actions);
    if (AppUI.bindTextLimits) {
      AppUI.bindTextLimits(tr);
    }
    return tr;
  }

  function onEditorChange() {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    state.dirty = true;
    clearValidationFields();
    syncCustomerSectionUi(false);
    ensureTrailingEmptyRow();
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

  function bindEvents() {
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

    $("btnAddItem").addEventListener("click", function () {
      if (DocumentEditor.isGenerated(state.document)) {
        return;
      }
      var itemRows = document.querySelectorAll("#itemsBody tr");
      var lastRow = itemRows[itemRows.length - 1];
      if (lastRow && isRowBlank(lastRow)) {
        focusRowName(lastRow);
        return;
      }
      if (lastRow && !isRowComplete(lastRow)) {
        setStatus("Complete name, unit, qty, and rate on this row first.", "info");
        return;
      }
      appendEmptyItemRow();
      itemRows = document.querySelectorAll("#itemsBody tr");
      focusRowName(itemRows[itemRows.length - 1]);
      refreshPreview();
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
      syncFormToDocument();
      state.document.items.push(Items.fromCatalogue(state.catalogue[index]));
      renderItemsTable(state.document.items);
      ensureTrailingEmptyRow();
      refreshPreview();
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
      state.catalogue = await Items.listCatalogue();
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
