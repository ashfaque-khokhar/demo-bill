(function (global) {
  "use strict";

  var BASE_WIDTH_MM = 210;
  var PX_PER_MM = 96 / 25.4;
  var PREVIEW_PADDING_BASE_PX = 24;

  var SIZES = [
    {
      id: "A4",
      title: "A4",
      subtitle: "210 × 297 mm — standard invoice / GST",
      pdfFormat: "a4",
      widthMm: 210,
      heightMm: 297
    },
    {
      id: "A5",
      title: "A5",
      subtitle: "148 × 210 mm — compact bill / challan",
      pdfFormat: "a5",
      widthMm: 148,
      heightMm: 210
    },
    {
      id: "A3",
      title: "A3",
      subtitle: "297 × 420 mm — ledger / large statement",
      pdfFormat: "a3",
      widthMm: 297,
      heightMm: 420
    },
    {
      id: "LEGAL",
      title: "Legal",
      subtitle: "216 × 356 mm — 8.5 × 14 in legal",
      pdfFormat: [216, 356],
      widthMm: 216,
      heightMm: 356
    },
    {
      id: "FOOLSCAP",
      title: "Foolscap",
      subtitle: "216 × 330 mm — 8.5 × 13 in foolscap",
      pdfFormat: [216, 330],
      widthMm: 216,
      heightMm: 330
    }
  ];

  var byId = {};
  SIZES.forEach(function (size) {
    byId[size.id] = size;
  });

  function getAll() {
    return SIZES.slice();
  }

  function getById(id) {
    return byId[id] || byId.A4;
  }

  function layoutScale(id) {
    return getById(id).widthMm / BASE_WIDTH_MM;
  }

  function previewWidthPx(id) {
    return Math.round(getById(id).widthMm * PX_PER_MM);
  }

  function previewMinHeightPx(id) {
    var meta = getById(id);
    var w = previewWidthPx(id);
    return Math.round((w * meta.heightMm) / meta.widthMm);
  }

  function previewPaddingPx(id) {
    return Math.round(PREVIEW_PADDING_BASE_PX * layoutScale(id));
  }

  function previewContentWidthPx(id) {
    var pad = previewPaddingPx(id);
    return Math.max(200, previewWidthPx(id) - pad * 2);
  }

  function previewContentMinHeightPx(id) {
    var pad = previewPaddingPx(id);
    return Math.max(120, previewMinHeightPx(id) - pad * 2);
  }

  function printPageSize(id) {
    var meta = getById(id);
    return meta.widthMm + "mm " + meta.heightMm + "mm";
  }

  function printMarginMm(id) {
    return 12 * layoutScale(id);
  }

  function cssClass(id) {
    return String(getById(id).id).toLowerCase();
  }

  function applyToPaperEl(el, id) {
    if (!el) {
      return;
    }
    var paperId = getById(id).id;
    var scale = layoutScale(paperId);
    el.className = "preview-paper " + cssClass(paperId);
    el.style.setProperty("--inv-scale", String(scale));
    el.style.setProperty("--paper-width-px", previewWidthPx(paperId) + "px");
    el.style.setProperty("--paper-min-height-px", previewMinHeightPx(paperId) + "px");
    el.style.setProperty("--paper-padding-px", previewPaddingPx(paperId) + "px");
    el.setAttribute("data-paper-id", paperId);
  }

  function pdfPageDimensions(id) {
    var meta = getById(id);
    return {
      format: meta.pdfFormat,
      width: meta.widthMm,
      height: meta.heightMm
    };
  }

  function populateSelect(selectEl, selectedId) {
    if (!selectEl) {
      return;
    }
    while (selectEl.firstChild) {
      selectEl.removeChild(selectEl.firstChild);
    }
    var current = selectedId || "A4";
    SIZES.forEach(function (size) {
      var opt = document.createElement("option");
      opt.value = size.id;
      opt.textContent = size.title + " (" + size.subtitle + ")";
      selectEl.appendChild(opt);
    });
    selectEl.value = getById(current).id;
  }

  global.PaperSizes = {
    getAll: getAll,
    getById: getById,
    layoutScale: layoutScale,
    previewWidthPx: previewWidthPx,
    previewMinHeightPx: previewMinHeightPx,
    previewPaddingPx: previewPaddingPx,
    previewContentWidthPx: previewContentWidthPx,
    previewContentMinHeightPx: previewContentMinHeightPx,
    printPageSize: printPageSize,
    printMarginMm: printMarginMm,
    applyToPaperEl: applyToPaperEl,
    pdfPageDimensions: pdfPageDimensions,
    populateSelect: populateSelect
  };
})(window);