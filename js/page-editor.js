(function () {
  "use strict";

  var $ = AppUI.$;
  var setStatus = AppUI.setStatus;
  var confirmModal = AppUI.confirmModal;

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
    toggle.textContent = open ? "Hide preview" : "Show invoice preview";
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
      window.location.href = "settings.html";
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
        setStatus("Opened " + row.documentNumber + ".", "info");
        return true;
      }
      setStatus("Could not open that document.", "error");
    }

    var draftRaw = sessionStorage.getItem(DRAFT_DOC_KEY);
    if (draftRaw) {
      sessionStorage.removeItem(DRAFT_DOC_KEY);
      try {
        state.document = JSON.parse(draftRaw);
        state.dirty = true;
        syncDocumentToForm();
        setStatus("Duplicated as a new document. Save to issue a number.", "info");
        return true;
      } catch (error) {
        setStatus("Could not load duplicated document.", "error");
      }
    }
    return false;
  }

  function bindEvents() {
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
