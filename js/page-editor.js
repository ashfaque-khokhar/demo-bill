(function () {
  "use strict";

  var $ = AppUI.$;
  var setStatus = AppUI.setStatus;
  var confirmModal = AppUI.confirmModal;
  var showValidationFields = AppUI.showValidationFields;
  var clearValidationFields = AppUI.clearValidationFields;

  var OPEN_DOC_KEY = "billing.openDocId";
  var DRAFT_DOC_KEY = "billing.draftDocument";
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

  function closeEditorPreviewModal() {
    var backdrop = $("previewModalBackdrop");
    var toggle = $("btnPreviewToggle");
    if (!backdrop) {
      return;
    }
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  function openEditorPreviewModal() {
    var backdrop = $("previewModalBackdrop");
    var toggle = $("btnPreviewToggle");
    if (!backdrop) {
      return;
    }
    refreshPreview();
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
    }
    var closeBtn = $("btnPreviewModalClose");
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function initPreviewPanel() {
    var toggle = $("btnPreviewToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var backdrop = $("previewModalBackdrop");
        if (backdrop && backdrop.classList.contains("open")) {
          closeEditorPreviewModal();
        } else {
          openEditorPreviewModal();
        }
      });
    }
    var backdrop = $("previewModalBackdrop");
    if (!backdrop) {
      return;
    }
    function onDismiss() {
      closeEditorPreviewModal();
    }
    if ($("btnPreviewModalClose")) {
      $("btnPreviewModalClose").addEventListener("click", onDismiss);
    }
    if ($("btnPreviewModalDismiss")) {
      $("btnPreviewModalDismiss").addEventListener("click", onDismiss);
    }
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        onDismiss();
      }
    });
  }

  function formatDocumentTypeLabel(title) {
    return String(title || "")
      .toLowerCase()
      .replace(/\b\w/g, function (ch) {
        return ch.toUpperCase();
      });
  }

  function syncDocumentTypeChips() {
    var select = $("documentType");
    if (!select) {
      return;
    }
    var current = select.value;
    document.querySelectorAll(".document-type-chip").forEach(function (btn) {
      var on = btn.getAttribute("data-type-id") === current;
      btn.classList.toggle("document-type-chip--active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function fillDocumentTypes() {
    var select = $("documentType");
    var chips = $("documentTypeChips");
    if (!select || !chips) {
      return;
    }
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
    while (chips.firstChild) {
      chips.removeChild(chips.firstChild);
    }
    DocumentTypes.getAll().forEach(function (type) {
      var opt = document.createElement("option");
      opt.value = type.id;
      opt.textContent = type.title;
      select.appendChild(opt);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "document-type-chip";
      btn.setAttribute("role", "radio");
      btn.setAttribute("data-type-id", type.id);
      btn.setAttribute("aria-checked", "false");
      btn.textContent = formatDocumentTypeLabel(type.title);
      btn.addEventListener("click", function () {
        if (DocumentEditor.isGenerated(state.document)) {
          return;
        }
        select.value = type.id;
        syncDocumentTypeChips();
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      chips.appendChild(btn);
    });
    syncDocumentTypeChips();
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
    doc.items = getItemsForDocument();
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
    document.querySelectorAll(".document-type-chip").forEach(function (btn) {
      btn.disabled = disabled;
    });

    var customerSection = $("docCustomerSection");
    if (customerSection && disabled) {
      customerSection.open = false;
    }

    ["btnAddItem", "btnAddItemHeader", "btnItemModalSave", "btnItemModalCancel", "btnItemModalClose"].forEach(function (id) {
      var ctrl = $(id);
      if (ctrl) {
        ctrl.disabled = disabled;
      }
    });
    document.querySelectorAll("#itemsList .items-list__actions button").forEach(function (node) {
      node.disabled = disabled;
    });
    document.querySelectorAll("#itemModalBackdrop input, #itemModalBackdrop select").forEach(function (node) {
      node.disabled = disabled;
    });

    var btnAdd = $("btnAddItem");
    var btnAddHeader = $("btnAddItemHeader");
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
    syncShareAvailability();
  }

  function syncShareAvailability() {
    var shareBtn = $("btnSharePdf");
    if (!shareBtn) {
      return;
    }
    var generated = DocumentEditor.isGenerated(state.document);
    shareBtn.hidden = !(generated && DocumentShare.canShareFiles());
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
    syncDocumentTypeChips();
    Customers.writeToForm(doc.customer || Customers.emptyCustomer(), customerIds);
    $("gstEnabled").value = doc.gst && doc.gst.enabled ? "true" : "false";
    $("supplyType").value = (doc.gst && doc.gst.supplyType) || "auto";
    clearInvoiceDiscount(doc);
    $("notes").value = doc.notes || "";
    renderItemsList();
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

  var itemModalEditId = null;
  var itemModalHsnSac = "";
  var itemModalCatalogueId = null;

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

  function getItemsForDocument() {
    var items = state.document && Array.isArray(state.document.items) ? state.document.items : [];
    return items.filter(function (line) {
      return Validation.isMeaningfulLine(line);
    }).map(sanitizeLineFromTable);
  }

  function formatItemDiscountLabel(line) {
    if (!line || line.discountType === "none" || !(Number(line.discountValue) > 0)) {
      return "No discount";
    }
    if (line.discountType === "percent") {
      return line.discountValue + "% off";
    }
    return Money.formatINR(Money.toPaise(line.discountValue)) + " off";
  }

  function formatItemMeta(line) {
    var qty = readOptionalNumber(line.quantity);
    var parts = [
      qty + " " + (line.unit || ""),
      Money.formatINR(line.rateMinor || 0) + " / unit",
      formatItemDiscountLabel(line),
      "GST " + (Number(line.gstRate) || 0) + "%"
    ];
    return parts.join(" · ");
  }

  function updateItemsPanelVisibility() {
    var items = state.document && state.document.items ? state.document.items : [];
    var meaningful = items.filter(function (line) {
      return Validation.isMeaningfulLine(line);
    });
    var empty = $("itemsEmpty");
    var list = $("itemsList");
    var meta = $("itemsCardMeta");
    var headerAdd = $("btnAddItemHeader");
    var hasItems = meaningful.length > 0;
    var readonly = DocumentEditor.isGenerated(state.document);
    if (empty) {
      empty.hidden = hasItems;
    }
    if (list) {
      list.hidden = !hasItems;
    }
    if (meta) {
      meta.textContent = hasItems
        ? meaningful.length + (meaningful.length === 1 ? " item" : " items")
        : "Add products or services";
    }
    if (headerAdd) {
      headerAdd.hidden = !hasItems || readonly;
    }
  }

  function renderItemsList(calc) {
    var list = $("itemsList");
    if (!list) {
      return;
    }
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    var items = state.document && state.document.items ? state.document.items : [];
    var amounts = {};
    if (calc && calc.items) {
      calc.items.forEach(function (row) {
        if (row.id) {
          amounts[row.id] = row.lineTotalMinor;
        }
      });
    }
    items.forEach(function (line) {
      if (!Validation.isMeaningfulLine(line)) {
        return;
      }
      var li = document.createElement("li");
      li.className = "items-list__row";
      li.setAttribute("data-id", line.id);
      var main = document.createElement("div");
      main.className = "items-list__main";
      var name = document.createElement("p");
      name.className = "items-list__name";
      name.textContent = line.name || "Item";
      var meta = document.createElement("p");
      meta.className = "items-list__meta";
      meta.textContent = formatItemMeta(line);
      main.appendChild(name);
      main.appendChild(meta);
      var amount = document.createElement("span");
      amount.className = "items-list__amount";
      amount.textContent = Money.formatINR(amounts[line.id] != null ? amounts[line.id] : 0);
      var actions = document.createElement("div");
      actions.className = "items-list__actions";
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn ghost";
      editBtn.setAttribute("aria-label", "Edit item");
      editBtn.title = "Edit";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function () {
        openItemModal(line);
      });
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn ghost row-action-delete";
      delBtn.setAttribute("aria-label", "Delete item");
      delBtn.title = "Delete";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", function () {
        removeDocumentItem(line.id);
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      li.appendChild(main);
      li.appendChild(amount);
      li.appendChild(actions);
      list.appendChild(li);
    });
    updateItemsPanelVisibility();
  }

  function fillItemModalSelects() {
    var unitSel = $("itemModalUnit");
    var gstSel = $("itemModalGst");
    if (unitSel && !unitSel.options.length) {
      Items.PRESET_UNITS.forEach(function (label) {
        var opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        unitSel.appendChild(opt);
      });
    }
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

  function syncItemModalGstOtherVisibility() {
    var gstSel = $("itemModalGst");
    var wrap = document.querySelector(".item-modal-gst-other-wrap");
    if (!gstSel || !wrap) {
      return;
    }
    wrap.classList.toggle("item-modal-gst-other-wrap--hidden", gstSel.value !== Items.GST_SELECT_OTHER);
  }

  function syncItemModalDiscValueVisibility() {
    var type = $("itemModalDiscType");
    var wrap = document.querySelector(".item-modal-disc-value-wrap");
    if (!type || !wrap) {
      return;
    }
    wrap.classList.toggle("item-modal-disc-value-wrap--hidden", type.value === "none");
  }

  function readGstFromItemModal() {
    var sel = $("itemModalGst");
    if (!sel || !sel.value) {
      return 0;
    }
    if (sel.value === Items.GST_SELECT_OTHER) {
      var other = $("itemModalGstOther");
      var n = Number(other && other.value);
      return isFinite(n) ? n : 0;
    }
    return Number(sel.value) || 0;
  }

  function readItemDraftFromModal() {
    return {
      name: $("itemModalName").value.trim(),
      quantity: readOptionalNumber($("itemModalQty").value),
      unit: $("itemModalUnit").value,
      rateMinor: Money.toPaise($("itemModalRate").value),
      discountType: $("itemModalDiscType").value,
      discountValue: Number($("itemModalDiscValue").value) || 0,
      gstRate: readGstFromItemModal()
    };
  }

  function updateItemModalAmount() {
    var draft = readItemDraftFromModal();
    var gross = Calculations.lineGrossMinor(draft);
    var disc = Calculations.applyDiscount(gross, draft.discountType, draft.discountValue);
    var after = Math.max(0, gross - disc);
    var tax = 0;
    if (state.document && state.document.gst && state.document.gst.enabled && draft.gstRate > 0) {
      tax = Money.roundPaise((after * draft.gstRate) / 100);
    }
    $("itemModalAmount").textContent = Money.formatINR(after + tax);
  }

  function setItemModalGstValue(rate) {
    var gstSel = $("itemModalGst");
    var gstOther = $("itemModalGstOther");
    if (!gstSel) {
      return;
    }
    var resolved = Items.resolveGstControl(rate);
    if (resolved.mode === "preset") {
      gstSel.value = String(resolved.value);
      if (gstOther) {
        gstOther.value = "";
      }
    } else {
      gstSel.value = Items.GST_SELECT_OTHER;
      if (gstOther) {
        gstOther.value = resolved.value;
      }
    }
    syncItemModalGstOtherVisibility();
  }

  function openItemModal(item) {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    fillItemModalSelects();
    var isEdit = false;
    if (item && item.id && state.document.items) {
      isEdit = state.document.items.some(function (line) {
        return line.id === item.id;
      });
    }
    itemModalEditId = isEdit ? item.id : null;
    itemModalHsnSac = item && item.hsnSac ? item.hsnSac : "";
    itemModalCatalogueId = item && item.catalogueItemId ? item.catalogueItemId : null;
    $("itemModalTitle").textContent = isEdit ? "Edit item" : "Add item";
    $("itemModalName").value = item && item.name ? item.name : "";
    $("itemModalQty").value = item && item.quantity ? String(item.quantity) : "";
    $("itemModalUnit").value = Items.resolveUnitControl(item && item.unit ? item.unit : "Piece").value;
    $("itemModalRate").value = item && item.rateMinor
      ? Money.fromPaise(item.rateMinor).toFixed(2)
      : "";
    $("itemModalDiscType").value = (item && item.discountType) || "none";
    $("itemModalDiscValue").value = item && item.discountValue ? item.discountValue : "";
    syncDiscountValueInputMax($("itemModalDiscType").value, $("itemModalDiscValue"));
    syncItemModalDiscValueVisibility();
    setItemModalGstValue(item && isFinite(item.gstRate) ? item.gstRate : 0);
    if (AppUI.bindTextLimits) {
      AppUI.bindTextLimits($("itemModalBackdrop"));
    }
    updateItemModalAmount();
    var backdrop = $("itemModalBackdrop");
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    $("itemModalName").focus();
  }

  function closeItemModal() {
    var backdrop = $("itemModalBackdrop");
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    itemModalEditId = null;
    itemModalHsnSac = "";
    itemModalCatalogueId = null;
  }

  function removeDocumentItem(id) {
    if (DocumentEditor.isGenerated(state.document)) {
      return;
    }
    if (!state.document.items) {
      state.document.items = [];
    }
    state.document.items = state.document.items.filter(function (line) {
      return line.id !== id;
    });
    onEditorChange();
  }

  function validateItemModalDraft(draft) {
    if (!draft.name) {
      setStatus("Enter item name.", "error");
      $("itemModalName").focus();
      return false;
    }
    if (!draft.unit) {
      setStatus("Select unit.", "error");
      return false;
    }
    if (!isFinite(draft.quantity) || draft.quantity <= 0) {
      setStatus("Enter quantity greater than zero.", "error");
      $("itemModalQty").focus();
      return false;
    }
    if (!draft.rateMinor || draft.rateMinor <= 0) {
      setStatus("Enter rate greater than zero.", "error");
      $("itemModalRate").focus();
      return false;
    }
    return true;
  }

  function saveItemFromModal() {
    var draft = readItemDraftFromModal();
    if (!validateItemModalDraft(draft)) {
      return;
    }
    var line = sanitizeLineFromTable({
      id: itemModalEditId || Items.createId(),
      catalogueItemId: itemModalCatalogueId,
      name: draft.name,
      quantity: draft.quantity,
      unit: draft.unit,
      rateMinor: draft.rateMinor,
      discountType: draft.discountType,
      discountValue: draft.discountValue,
      hsnSac: itemModalHsnSac,
      gstRate: draft.gstRate
    });
    if (!state.document.items) {
      state.document.items = [];
    }
    if (itemModalEditId) {
      state.document.items = state.document.items.map(function (existing) {
        return existing.id === itemModalEditId ? line : existing;
      });
    } else {
      state.document.items.push(line);
    }
    closeItemModal();
    onEditorChange();
  }

  function bindItemModalEvents() {
    fillItemModalSelects();
    ["itemModalName", "itemModalQty", "itemModalRate", "itemModalDiscValue", "itemModalGstOther"].forEach(function (id) {
      var node = $(id);
      if (node) {
        node.addEventListener("input", updateItemModalAmount);
      }
    });
    ["itemModalUnit", "itemModalDiscType", "itemModalGst"].forEach(function (id) {
      var node = $(id);
      if (node) {
        node.addEventListener("change", function () {
          if (id === "itemModalDiscType") {
            syncDiscountValueInputMax($("itemModalDiscType").value, $("itemModalDiscValue"));
            syncItemModalDiscValueVisibility();
          }
          if (id === "itemModalGst") {
            syncItemModalGstOtherVisibility();
          }
          updateItemModalAmount();
        });
      }
    });
    var discValue = $("itemModalDiscValue");
    if (discValue && AppUI.bindNonNegativeDecimalInput) {
      AppUI.bindNonNegativeDecimalInput(discValue, true);
    }
    if ($("itemModalQty") && AppUI.bindNonNegativeDecimalInput) {
      AppUI.bindNonNegativeDecimalInput($("itemModalQty"), true);
    }
    if ($("itemModalRate") && AppUI.bindNonNegativeDecimalInput) {
      AppUI.bindNonNegativeDecimalInput($("itemModalRate"), true);
    }
    syncItemModalDiscValueVisibility();
    syncItemModalGstOtherVisibility();
    $("btnItemModalCancel").addEventListener("click", closeItemModal);
    $("btnItemModalClose").addEventListener("click", closeItemModal);
    $("btnItemModalSave").addEventListener("click", saveItemFromModal);
    $("itemModalBackdrop").addEventListener("click", function (event) {
      if (event.target === $("itemModalBackdrop")) {
        closeItemModal();
      }
    });
  }

  function openAddItemModal() {
    openItemModal(null);
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
    renderItemsList(calc);

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

    $("btnAddItem").addEventListener("click", openAddItemModal);
    var btnAddHeader = $("btnAddItemHeader");
    if (btnAddHeader) {
      btnAddHeader.addEventListener("click", openAddItemModal);
    }

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
    $("btnSharePdf").addEventListener("click", async function () {
      closeExportMenu();
      if (!runDocumentValidation()) {
        return;
      }
      try {
        refreshPreview();
        var result = await DocumentOutput.shareRowPdf(
          state.document,
          state.settings,
          state.logoDataUrl,
          $("invoicePreview"),
          state.logoUrl
        );
        if (result === "shared") {
          setStatus("PDF shared.", "ok");
        } else if (result === "downloaded") {
          setStatus("Share unavailable — PDF downloaded instead.", "info");
        }
      } catch (error) {
        setStatus(error.message || "Share failed.", "error");
      }
    });
  }

  async function init() {
    try {
      fillDocumentTypes();
      bindItemModalEvents();
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
