(function () {
  "use strict";

  var state = {
    settings: null,
    document: null,
    logoUrl: null,
    logoDataUrl: null,
    catalogue: [],
    dirty: false
  };

  var customerIds = {
    name: "customerName",
    mobile: "customerMobile",
    address: "customerAddress",
    email: "customerEmail",
    gstin: "customerGstin",
    state: "customerState",
    stateCode: "customerStateCode"
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type) {
    var node = $("status");
    node.textContent = message || "";
    node.className = "status-bar no-print " + (type || "info");
  }

  function setNavActive(name) {
    document.querySelectorAll(".nav-drawer-link[data-panel]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-panel") === name);
    });
  }

  function openNavDrawer() {
    var drawer = $("navDrawer");
    var backdrop = $("navDrawerBackdrop");
    var toggle = $("btnNavToggle");
    if (!drawer || !backdrop || !toggle) return;
    drawer.classList.add("open");
    backdrop.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    var first = drawer.querySelector(".nav-drawer-link");
    if (first) first.focus();
  }

  function closeNavDrawer() {
    var drawer = $("navDrawer");
    var backdrop = $("navDrawerBackdrop");
    var toggle = $("btnNavToggle");
    if (!drawer || !backdrop || !toggle) return;
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    toggle.focus();
  }

  function showPanel(name) {
    ["editor", "settings", "history", "backup"].forEach(function (key) {
      var panel = $("panel-" + key);
      if (panel) {
        panel.classList.toggle("active", key === name);
      }
    });
    setNavActive(name);
    if (name === "history") {
      refreshHistory();
    }
    if (name === "backup") {
      refreshBackupHint();
    }
    if (name === "settings") {
      fillSettingsForm();
      renderCatalogue();
    }
  }

  function confirmModal(title, message, actions) {
    return new Promise(function (resolve) {
      var backdrop = $("modalBackdrop");
      $("modalTitle").textContent = title;
      $("modalMessage").textContent = message;
      var actionsEl = $("modalActions");
      while (actionsEl.firstChild) {
        actionsEl.removeChild(actionsEl.firstChild);
      }
      actions.forEach(function (action) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn " + (action.className || "secondary");
        btn.textContent = action.label;
        btn.addEventListener("click", function () {
          backdrop.classList.remove("open");
          resolve(action.value);
        });
        actionsEl.appendChild(btn);
      });
      backdrop.classList.add("open");
    });
  }

  async function loadLogo(settings) {
    state.logoUrl = "assets/logo-placeholder.svg";
    state.logoDataUrl = null;
    if (!settings.logoAssetId) {
      $("logoPreview").src = state.logoUrl;
      return;
    }
    var asset = await StorageRepository.get("assets", settings.logoAssetId);
    if (!asset || !asset.blob) {
      $("logoPreview").src = state.logoUrl;
      return;
    }
    if (state.logoUrl && state.logoUrl.indexOf("blob:") === 0) {
      URL.revokeObjectURL(state.logoUrl);
    }
    state.logoUrl = URL.createObjectURL(asset.blob);
    $("logoPreview").src = state.logoUrl;
    state.logoDataUrl = await blobToDataUrl(asset.blob);
  }

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

  function fillSettingsForm() {
    var s = state.settings;
    $("businessName").value = s.businessName || "";
    $("businessMobile").value = s.mobile || "";
    $("businessAddress").value = s.address || "";
    $("businessEmail").value = s.email || "";
    $("businessWebsite").value = s.website || "";
    $("businessGstin").value = s.gstin || "";
    $("supplierState").value = s.supplierState || "";
    $("supplierStateCode").value = s.supplierStateCode || "";
    $("upiId").value = s.upiId || "";
    $("bankDetails").value = s.bankDetails || "";
    $("disclaimer").value = s.disclaimer || "";
    $("logoWidth").value = s.logoWidth || 120;
    $("logoHeight").value = s.logoHeight || 48;
    $("logoAlignment").value = s.logoAlignment || "left";
    $("numberPattern").value = s.numbering.pattern || "{PREFIX}/{YYYY}/{SEQ}";
    $("sequencePadding").value = s.numbering.sequencePadding || 4;
    $("sequenceStart").value = s.numbering.sequenceStart || 1;
    $("resetRule").value = s.numbering.resetRule || "never";
    $("hItem").value = s.headings.item;
    $("hQty").value = s.headings.quantity;
    $("hUnit").value = s.headings.unit;
    $("hRate").value = s.headings.rate;
    $("hDiscount").value = s.headings.discount;
    $("hTax").value = s.headings.tax;
    $("hAmount").value = s.headings.amount;
    $("hSubtotal").value = s.headings.subtotal;
    $("hGrand").value = s.headings.grandTotal;
  }

  function readSettingsForm() {
    var s = state.settings;
    s.businessName = $("businessName").value.trim();
    s.mobile = $("businessMobile").value.trim();
    s.address = $("businessAddress").value.trim();
    s.email = $("businessEmail").value.trim();
    s.website = $("businessWebsite").value.trim();
    s.gstin = $("businessGstin").value.trim();
    s.supplierState = $("supplierState").value.trim();
    s.supplierStateCode = $("supplierStateCode").value.trim();
    s.upiId = $("upiId").value.trim();
    s.bankDetails = $("bankDetails").value.trim();
    s.disclaimer = $("disclaimer").value;
    s.logoWidth = Number($("logoWidth").value) || 120;
    s.logoHeight = Number($("logoHeight").value) || 48;
    s.logoAlignment = $("logoAlignment").value;
    s.numbering.pattern = $("numberPattern").value.trim() || "{PREFIX}/{YYYY}/{SEQ}";
    s.numbering.sequencePadding = Number($("sequencePadding").value) || 4;
    s.numbering.sequenceStart = Number($("sequenceStart").value) || 1;
    s.numbering.resetRule = $("resetRule").value;
    s.headings.item = $("hItem").value.trim() || "Description";
    s.headings.quantity = $("hQty").value.trim() || "Qty";
    s.headings.unit = $("hUnit").value.trim() || "Unit";
    s.headings.rate = $("hRate").value.trim() || "Rate";
    s.headings.discount = $("hDiscount").value.trim() || "Discount";
    s.headings.tax = $("hTax").value.trim() || "Tax";
    s.headings.amount = $("hAmount").value.trim() || "Amount";
    s.headings.subtotal = $("hSubtotal").value.trim() || "Subtotal";
    s.headings.grandTotal = $("hGrand").value.trim() || "Grand Total";
    return s;
  }

  function syncFormToDocument() {
    var doc = state.document;
    doc.documentType = $("documentType").value;
    doc.invoiceDate = $("invoiceDate").value || DocumentEditor.todayIso();
    doc.paperSize = $("paperSize").value;
    doc.customer = Customers.readFromForm(customerIds);
    doc.gst.enabled = $("gstEnabled").value === "true";
    doc.gst.supplyType = $("supplyType").value;
    doc.gst.placeOfSupply = doc.customer.state || "";
    doc.discount.type = $("invoiceDiscountType").value;
    doc.discount.value = Number($("invoiceDiscountValue").value) || 0;
    doc.notes = $("notes").value;
    doc.items = readItemsFromTable();
    return doc;
  }

  function syncDocumentToForm() {
    var doc = state.document;
    $("documentType").value = doc.documentType;
    $("documentNumber").value = doc.documentNumber || "";
    $("invoiceDate").value = doc.invoiceDate || DocumentEditor.todayIso();
    $("paperSize").value = doc.paperSize || "A4";
    Customers.writeToForm(doc.customer || Customers.emptyCustomer(), customerIds);
    $("gstEnabled").value = doc.gst && doc.gst.enabled ? "true" : "false";
    $("supplyType").value = (doc.gst && doc.gst.supplyType) || "auto";
    $("invoiceDiscountType").value = (doc.discount && doc.discount.type) || "none";
    $("invoiceDiscountValue").value = (doc.discount && doc.discount.value) || 0;
    $("notes").value = doc.notes || "";
    renderItemsTable(doc.items || []);
    refreshPreview();
  }

  function readItemsFromTable() {
    var rows = Array.prototype.slice.call(document.querySelectorAll("#itemsBody tr"));
    return rows.map(function (tr) {
      var discountType = tr.querySelector(".item-disc-type").value;
      var discountValue = Number(tr.querySelector(".item-disc-value").value) || 0;
      return {
        id: tr.getAttribute("data-id"),
        catalogueItemId: tr.getAttribute("data-catalogue-id") || null,
        name: tr.querySelector(".item-name").value.trim(),
        description: tr.querySelector(".item-desc").value.trim(),
        quantity: Number(tr.querySelector(".item-qty").value) || 0,
        unit: tr.querySelector(".item-unit").value.trim() || "Piece",
        rateMinor: Money.toPaise(tr.querySelector(".item-rate").value),
        discountType: discountType,
        discountValue: discountValue,
        hsnSac: tr.querySelector(".item-hsn").value.trim(),
        gstRate: Number(tr.querySelector(".item-gst").value) || 0
      };
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

    function cellInput(className, value, type) {
      var td = document.createElement("td");
      var input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") {
        input.type = type || "text";
      }
      input.className = className;
      input.value = value == null ? "" : value;
      input.addEventListener("input", onEditorChange);
      td.appendChild(input);
      return td;
    }

    var nameTd = document.createElement("td");
    var name = document.createElement("input");
    name.type = "text";
    name.className = "item-name";
    name.placeholder = "Name";
    name.value = item.name || "";
    name.addEventListener("input", onEditorChange);
    var desc = document.createElement("input");
    desc.type = "text";
    desc.className = "item-desc";
    desc.placeholder = "Description";
    desc.value = item.description || "";
    desc.addEventListener("input", onEditorChange);
    nameTd.appendChild(name);
    nameTd.appendChild(desc);
    tr.appendChild(nameTd);

    tr.appendChild(cellInput("item-qty", item.quantity, "number"));
    tr.appendChild(cellInput("item-unit", item.unit || "Piece", "text"));
    tr.appendChild(cellInput("item-rate", Money.fromPaise(item.rateMinor || 0).toFixed(2), "number"));

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
    discType.addEventListener("change", onEditorChange);
    var discValue = document.createElement("input");
    discValue.type = "number";
    discValue.className = "item-disc-value";
    discValue.value = item.discountValue || 0;
    discValue.addEventListener("input", onEditorChange);
    discTd.appendChild(discType);
    discTd.appendChild(discValue);
    tr.appendChild(discTd);

    tr.appendChild(cellInput("item-gst", item.gstRate || 0, "number"));
    tr.appendChild(cellInput("item-hsn", item.hsnSac || "", "text"));

    var amountTd = document.createElement("td");
    amountTd.className = "item-amount";
    amountTd.textContent = Money.formatINR(0);
    tr.appendChild(amountTd);

    var actions = document.createElement("td");
    var wrap = document.createElement("div");
    wrap.className = "row-actions";
    var dup = document.createElement("button");
    dup.type = "button";
    dup.className = "btn ghost";
    dup.textContent = "Copy";
    dup.addEventListener("click", function () {
      syncFormToDocument();
      var copy = Items.createLine(Object.assign({}, item, { id: Items.createId() }));
      state.document.items.push(copy);
      renderItemsTable(state.document.items);
      refreshPreview();
    });
    var saveCat = document.createElement("button");
    saveCat.type = "button";
    saveCat.className = "btn ghost";
    saveCat.textContent = "Save";
    saveCat.title = "Save to catalogue";
    saveCat.addEventListener("click", function () {
      saveLineToCatalogue(tr);
    });
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn ghost";
    remove.textContent = "Del";
    remove.addEventListener("click", function () {
      tr.remove();
      onEditorChange();
    });
    wrap.appendChild(dup);
    wrap.appendChild(saveCat);
    wrap.appendChild(remove);
    actions.appendChild(wrap);
    tr.appendChild(actions);
    return tr;
  }

  async function saveLineToCatalogue(tr) {
    var name = tr.querySelector(".item-name").value.trim();
    if (!name) {
      setStatus("Item name is required to save to catalogue.", "error");
      return;
    }
    await Items.saveCatalogueItem({
      name: name,
      description: tr.querySelector(".item-desc").value.trim(),
      unit: tr.querySelector(".item-unit").value.trim() || "Piece",
      defaultRateMinor: Money.toPaise(tr.querySelector(".item-rate").value),
      defaultTaxRate: Number(tr.querySelector(".item-gst").value) || 0,
      hsnSac: tr.querySelector(".item-hsn").value.trim()
    });
    state.catalogue = await Items.listCatalogue();
    setStatus("Catalogue item saved.", "ok");
  }

  function onEditorChange() {
    state.dirty = true;
    refreshPreview();
  }

  function refreshPreview() {
    syncFormToDocument();
    var business = state.document.businessSnapshot || state.settings;
    var calc = Calculations.calculateDocument(state.document, state.settings);
    var rows = document.querySelectorAll("#itemsBody tr");
    calc.items.forEach(function (item, index) {
      if (rows[index]) {
        rows[index].querySelector(".item-amount").textContent = Money.formatINR(item.lineTotalMinor);
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

    $("documentNumber").value = state.document.documentNumber || "";
    $("previewPaper").className = "preview-paper " + String(state.document.paperSize || "A4").toLowerCase();
    Preview.render($("invoicePreview"), state.document, calc, business, state.logoUrl);
    return calc;
  }

  async function startNewDocument(typeId) {
    state.document = DocumentEditor.emptyDocument(state.settings, typeId || "tax-invoice");
    state.dirty = false;
    syncDocumentToForm();
    setStatus("New document ready.", "info");
  }

  async function saveCurrent() {
    syncFormToDocument();
    if (!state.settings.businessName || !state.settings.mobile || !state.settings.address) {
      setStatus("Complete required business settings before saving.", "error");
      showPanel("settings");
      return;
    }
    try {
      var saved = await DocumentEditor.saveDocument(state.document, state.settings);
      state.document = saved;
      state.dirty = false;
      syncDocumentToForm();
      setStatus("Saved " + saved.documentNumber + ".", "ok");
    } catch (error) {
      setStatus(error.message || "Save failed.", "error");
    }
  }

  async function refreshHistory() {
    var query = ($("historySearch").value || "").trim().toLowerCase();
    var date = $("historyDate").value;
    var rows = await DocumentEditor.listDocuments();
    var list = $("historyList");
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    rows.filter(function (row) {
      if (date && row.invoiceDate !== date) {
        return false;
      }
      if (!query) {
        return true;
      }
      var hay = (row.documentNumber + " " + ((row.customer && row.customer.name) || "")).toLowerCase();
      return hay.indexOf(query) >= 0;
    }).forEach(function (row) {
      var item = document.createElement("div");
      item.className = "history-item";
      var info = document.createElement("div");
      var strong = document.createElement("strong");
      strong.textContent = row.documentNumber + " · " + DocumentTypes.getById(row.documentType).title;
      var span = document.createElement("span");
      span.textContent = ((row.customer && row.customer.name) || "No customer") +
        " · " + Preview.formatDate(row.invoiceDate) +
        " · " + Money.formatINR(row.grandTotalMinor || 0);
      info.appendChild(strong);
      info.appendChild(span);
      var actions = document.createElement("div");
      actions.className = "history-actions";

      function makeBtn(label, handler) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn secondary";
        btn.textContent = label;
        btn.addEventListener("click", handler);
        return btn;
      }

      actions.appendChild(makeBtn("Open", async function () {
        state.document = row;
        state.dirty = false;
        syncDocumentToForm();
        showPanel("editor");
        setStatus("Opened " + row.documentNumber + ".", "info");
      }));
      actions.appendChild(makeBtn("Duplicate", async function () {
        state.document = DocumentEditor.duplicateDocument(row, state.settings);
        state.dirty = true;
        syncDocumentToForm();
        showPanel("editor");
        setStatus("Duplicated as a new document. Save to issue a number.", "info");
      }));
      actions.appendChild(makeBtn("Delete", async function () {
        var ok = await confirmModal("Delete document?", "Delete " + row.documentNumber + "? This cannot be undone.", [
          { label: "Cancel", value: false, className: "secondary" },
          { label: "Delete", value: true, className: "danger" }
        ]);
        if (!ok) {
          return;
        }
        await DocumentEditor.deleteDocument(row.id);
        setStatus("Deleted " + row.documentNumber + ".", "ok");
        refreshHistory();
      }));

      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });

    if (!list.firstChild) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No saved documents yet.";
      list.appendChild(empty);
    }
  }

  async function renderCatalogue() {
    state.catalogue = await Items.listCatalogue();
    var list = $("catalogueList");
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    state.catalogue.forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "history-item";
      var info = document.createElement("div");
      var strong = document.createElement("strong");
      strong.textContent = entry.name;
      var span = document.createElement("span");
      span.textContent = (entry.unit || "Piece") + " · " + Money.formatINR(entry.defaultRateMinor || 0);
      info.appendChild(strong);
      info.appendChild(span);
      var actions = document.createElement("div");
      actions.className = "history-actions";
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn secondary";
      del.textContent = "Delete";
      del.addEventListener("click", async function () {
        await Items.deleteCatalogueItem(entry.id);
        renderCatalogue();
      });
      actions.appendChild(del);
      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });
    if (!list.firstChild) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No catalogue items yet.";
      list.appendChild(empty);
    }
  }

  function refreshBackupHint() {
    var at = BackupRestore.lastBackupHint();
    $("lastBackupHint").textContent = at
      ? ("Last backup downloaded from this browser: " + at)
      : "No backup recorded yet in this browser.";
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
    refreshPreview();
    setStatus("Logo saved.", "ok");
  }

  function bindEvents() {
    var toggle = $("btnNavToggle");
    var closeBtn = $("btnNavClose");
    var backdrop = $("navDrawerBackdrop");

    if (toggle) {
      toggle.addEventListener("click", function () {
        if (document.body.classList.contains("nav-open")) {
          closeNavDrawer();
        } else {
          openNavDrawer();
        }
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", closeNavDrawer);
    }
    if (backdrop) {
      backdrop.addEventListener("click", closeNavDrawer);
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        closeNavDrawer();
      }
    });

    document.querySelectorAll("[data-panel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showPanel(btn.getAttribute("data-panel"));
        if (btn.classList.contains("nav-drawer-link")) {
          closeNavDrawer();
        }
      });
    });

    [
      "documentType", "invoiceDate", "paperSize", "customerName", "customerMobile",
      "customerAddress", "customerEmail", "customerGstin", "customerState",
      "customerStateCode", "gstEnabled", "supplyType", "invoiceDiscountType",
      "invoiceDiscountValue", "notes"
    ].forEach(function (id) {
      var node = $(id);
      node.addEventListener("input", onEditorChange);
      node.addEventListener("change", function () {
        if (id === "documentType" && state.document && state.document.isNew !== false && !state.document.id) {
          var peek = Numbering.peekNumber(state.settings, $("documentType").value, $("invoiceDate").value);
          state.document.documentNumber = peek.documentNumber;
          state.document.numberingSnapshot = {
            pattern: state.settings.numbering.pattern,
            sequenceValue: peek.sequenceValue
          };
          if ($("documentType").value === "tax-invoice") {
            $("gstEnabled").value = "true";
          }
        }
        onEditorChange();
      });
    });

    $("btnAddItem").addEventListener("click", function () {
      syncFormToDocument();
      state.document.items.push(Items.createLine());
      renderItemsTable(state.document.items);
      refreshPreview();
    });

    $("btnPickCatalogue").addEventListener("click", async function () {
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
      refreshPreview();
    });

    $("btnSave").addEventListener("click", saveCurrent);
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
    $("btnDuplicate").addEventListener("click", function () {
      syncFormToDocument();
      state.document = DocumentEditor.duplicateDocument(state.document, state.settings);
      syncDocumentToForm();
      setStatus("Duplicated as a new document. Save to issue a number.", "info");
    });
    $("btnPng").addEventListener("click", async function () {
      try {
        refreshPreview();
        await ExportPng.exportPng($("invoicePreview"), state.document);
        setStatus("PNG downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "PNG export failed.", "error");
      }
    });
    $("btnPdf").addEventListener("click", async function () {
      try {
        var calc = refreshPreview();
        var business = state.document.businessSnapshot || state.settings;
        await ExportPdf.exportPdf(state.document, calc, business, state.logoDataUrl, state.document.paperSize);
        setStatus("PDF downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "PDF export failed.", "error");
      }
    });
    $("btnPrint").addEventListener("click", function () {
      refreshPreview();
      Print.printDocument();
      setStatus("Print dialog opened.", "info");
    });

    $("btnSaveSettings").addEventListener("click", async function () {
      try {
        readSettingsForm();
        if (!state.settings.businessName || !state.settings.mobile || !state.settings.address) {
          setStatus("Business name, mobile, and address are required.", "error");
          return;
        }
        await Settings.save(state.settings);
        if (state.document && (!state.document.id || state.document.isNew)) {
          var peek = Numbering.peekNumber(state.settings, state.document.documentType, state.document.invoiceDate);
          state.document.documentNumber = peek.documentNumber;
        }
        refreshPreview();
        setStatus("Settings saved.", "ok");
      } catch (error) {
        setStatus(error.message || "Could not save settings.", "error");
      }
    });

    $("logoFile").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      handleLogoUpload(file);
    });
    $("btnClearLogo").addEventListener("click", async function () {
      state.settings.logoAssetId = null;
      await Settings.save(state.settings);
      await loadLogo(state.settings);
      refreshPreview();
      setStatus("Logo cleared.", "ok");
    });

    $("btnAddCatalogue").addEventListener("click", async function () {
      var name = window.prompt("Catalogue item name");
      if (!name) {
        return;
      }
      var rate = window.prompt("Default rate (₹)", "0");
      await Items.saveCatalogueItem({
        name: name.trim(),
        defaultRateMinor: Money.toPaise(rate),
        unit: "Piece",
        defaultTaxRate: 0
      });
      renderCatalogue();
      setStatus("Catalogue item added.", "ok");
    });

    $("historySearch").addEventListener("input", refreshHistory);
    $("historyDate").addEventListener("change", refreshHistory);

    $("btnExportBackup").addEventListener("click", async function () {
      try {
        var backup = await BackupRestore.createBackup();
        BackupRestore.downloadBackup(backup);
        refreshBackupHint();
        setStatus("Backup downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "Backup failed.", "error");
      }
    });

    $("backupFile").addEventListener("change", async function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      try {
        var text = await file.text();
        var raw = JSON.parse(text);
        BackupRestore.validateBackup(raw);
        var mode = await confirmModal(
          "Import backup",
          "Replace all local data, or merge into existing records?",
          [
            { label: "Cancel", value: "", className: "secondary" },
            { label: "Merge", value: "merge", className: "secondary" },
            { label: "Replace", value: "replace", className: "danger" }
          ]
        );
        if (!mode) {
          event.target.value = "";
          return;
        }
        await BackupRestore.importBackup(raw, mode);
        state.settings = await Settings.load();
        await loadLogo(state.settings);
        await startNewDocument("tax-invoice");
        setStatus("Backup imported (" + mode + ").", "ok");
        showPanel("history");
      } catch (error) {
        setStatus(error.message || "Import failed.", "error");
      }
      event.target.value = "";
    });
  }

  async function init() {
    try {
      fillDocumentTypes();
      bindEvents();
      state.settings = await Settings.load();
      await loadLogo(state.settings);
      state.catalogue = await Items.listCatalogue();
      await startNewDocument("tax-invoice");
      var started = Onboarding.maybeStart(state.settings, {
        onStatus: setStatus,
        onSaved: function (settings) {
          state.settings = settings;
          fillSettingsForm();
          refreshPreview();
        },
        onComplete: function (settings) {
          state.settings = settings;
          fillSettingsForm();
          refreshPreview();
        },
        onLogoUpload: handleLogoUpload,
        getLogoUrl: function () {
          return state.logoUrl;
        }
      });
      if (!started) {
        setStatus("Ready. Data stays in this browser — use Backup regularly.", "info");
      } else {
        setStatus("Complete setup, or skip steps to start billing.", "info");
      }
    } catch (error) {
      setStatus(error.message || "Could not start the app.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
