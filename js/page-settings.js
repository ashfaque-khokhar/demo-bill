(function () {
  "use strict";

  var $ = AppUI.$;
  var setStatus = AppUI.setStatus;

  var state = {
    settings: null,
    logoUrl: null
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
    await blobToDataUrl(asset.blob);
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
    $("paperSize").value = s.paperSize || "A4";
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
    s.paperSize = $("paperSize").value;
    return s;
  }

  async function renderCatalogue() {
    var catalogue = await Items.listCatalogue();
    var list = $("catalogueList");
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    catalogue.forEach(function (entry) {
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
    setStatus("Logo saved.", "ok");
  }

  function bindSectionNav() {
    document.querySelectorAll('.settings-nav a[href^="#settings-"]').forEach(function (link) {
      link.addEventListener("click", function (event) {
        var href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "#") {
          return;
        }
        var section = document.getElementById(href.slice(1));
        if (!section || section.tagName !== "DETAILS") {
          return;
        }
        event.preventDefault();
        section.open = true;
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function bindAccordionTools() {
    var sections = document.querySelectorAll("details.settings-section");
    var expandBtn = document.getElementById("btnExpandAllSections");
    var collapseBtn = document.getElementById("btnCollapseAllSections");
    if (expandBtn) {
      expandBtn.addEventListener("click", function () {
        sections.forEach(function (el) {
          el.open = true;
        });
      });
    }
    if (collapseBtn) {
      collapseBtn.addEventListener("click", function () {
        sections.forEach(function (el) {
          el.open = false;
        });
      });
    }
  }

  function bindEvents() {
    bindSectionNav();
    bindAccordionTools();
    $("btnSaveSettings").addEventListener("click", async function () {
      try {
        readSettingsForm();
        if (!state.settings.businessName || !state.settings.mobile || !state.settings.address) {
          setStatus("Business name, mobile, and address are required.", "error");
          return;
        }
        await Settings.save(state.settings);
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
  }

  async function init() {
    try {
      bindEvents();
      if (window.Theme) {
        window.Theme.bindSelect("themeMode");
      }
      state.settings = await Settings.load();
      await loadLogo(state.settings);
      fillSettingsForm();
      await renderCatalogue();
      setStatus("Edit business details, logo, numbering, and catalogue.", "info");
    } catch (error) {
      setStatus(error.message || "Could not load settings.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
