(function () {
  "use strict";

  var $ = AppUI.$;
  var setStatus = AppUI.setStatus;
  var confirmModal = AppUI.confirmModal;

  var DRAFT_DOC_KEY = "billing.draftDocument";

  var state = {
    settings: null,
    logoUrl: "assets/logo-placeholder.svg",
    logoDataUrl: null,
    previewRow: null
  };

  async function loadLogo(settings) {
    state.logoUrl = "assets/logo-placeholder.svg";
    state.logoDataUrl = null;
    if (!settings || !settings.logoAssetId) {
      return;
    }
    var asset = await StorageRepository.get("assets", settings.logoAssetId);
    if (!asset || !asset.blob) {
      return;
    }
    if (state.logoUrl.indexOf("blob:") === 0) {
      URL.revokeObjectURL(state.logoUrl);
    }
    state.logoUrl = URL.createObjectURL(asset.blob);
    try {
      state.logoDataUrl = await DocumentShare.blobToDataUrl(asset.blob);
    } catch (e) {
      state.logoDataUrl = null;
    }
  }

  function syncPaperClass(paperEl) {
    if (!paperEl) {
      return;
    }
    var paperSize = String(DocumentOutput.paperSize(state.settings, null)).toLowerCase();
    paperEl.className = "preview-paper " + paperSize;
  }

  function syncShareAvailability() {
    var can = DocumentShare.canShareFiles();
    var modalShare = $("btnHistoryShare");
    if (modalShare) {
      modalShare.hidden = !can;
    }
  }

  function closeExportMenu(menu) {
    if (menu) {
      menu.open = false;
    }
  }

  function closeHistoryPreview() {
    var backdrop = $("historyPreviewBackdrop");
    if (!backdrop) {
      return;
    }
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("history-preview-open");
    state.previewRow = null;
    var menu = $("historyModalExportMenu");
    closeExportMenu(menu);
  }

  function openHistoryPreview(row) {
    var backdrop = $("historyPreviewBackdrop");
    var paper = $("historyPreviewPaper");
    var target = $("historyInvoicePreview");
    var title = $("historyPreviewTitle");
    if (!backdrop || !paper || !target) {
      return;
    }
    state.previewRow = row;
    syncPaperClass(paper);
    var displayNumber = DocumentEditor.displayDocumentNumber(row, state.settings);
    if (title) {
      title.textContent = displayNumber + " · " + DocumentTypes.getById(row.documentType).title;
    }
    DocumentOutput.renderDocumentPreview(target, row, state.settings, state.logoUrl);
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("history-preview-open");
    syncShareAvailability();
    var closeBtn = $("btnHistoryPreviewClose");
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  async function runRowPng(row, previewEl) {
    syncPaperClass($("historyExportPaper"));
    await DocumentOutput.exportRowPng(row, state.settings, state.logoUrl, previewEl);
    setStatus("PNG downloaded.", "ok");
  }

  async function runRowPdf(row, previewEl) {
    syncPaperClass($("historyExportPaper"));
    await DocumentOutput.exportRowPdf(row, state.settings, state.logoDataUrl, previewEl, state.logoUrl);
    setStatus("PDF downloaded.", "ok");
  }

  async function runRowShare(row, previewEl) {
    syncPaperClass($("historyExportPaper"));
    var result = await DocumentOutput.shareRowPdf(row, state.settings, state.logoDataUrl, previewEl, state.logoUrl);
    if (result === "shared") {
      setStatus("PDF shared.", "ok");
    } else if (result === "downloaded") {
      setStatus("Share unavailable — PDF downloaded instead.", "info");
    }
  }

  function runRowPrint(row, previewEl, paperId) {
    if (previewEl.id === "historyExportPreview") {
      syncPaperClass($("historyExportPaper"));
    }
    DocumentOutput.prepareRowPrint(row, state.settings, state.logoUrl, previewEl);
    Print.printInvoicePreview(paperId);
    setStatus("Print dialog opened.", "info");
  }

  function createRowExportMenu(row) {
    var details = document.createElement("details");
    details.className = "editor-action-menu history-action-menu";
    var summary = document.createElement("summary");
    summary.className = "btn secondary";
    summary.textContent = "Export";
    details.appendChild(summary);

    var panel = document.createElement("div");
    panel.className = "editor-action-menu__panel";
    panel.setAttribute("role", "menu");

    var heading = document.createElement("p");
    heading.className = "editor-action-menu__heading";
    heading.textContent = "Download & print";
    panel.appendChild(heading);

    function addItem(label, handler) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "editor-action-menu__item";
      btn.setAttribute("role", "menuitem");
      btn.textContent = label;
      btn.addEventListener("click", async function () {
        closeExportMenu(details);
        try {
          await handler();
        } catch (error) {
          setStatus(error.message || "Export failed.", "error");
        }
      });
      panel.appendChild(btn);
      return btn;
    }

    var exportPreview = $("historyExportPreview");
    addItem("PNG image", function () {
      return runRowPng(row, exportPreview);
    });
    addItem("PDF file", function () {
      return runRowPdf(row, exportPreview);
    });
    addItem("Print", function () {
      runRowPrint(row, exportPreview, "historyExportPaper");
    });

    details.appendChild(panel);
    return details;
  }

  function bindPreviewModal() {
    var backdrop = $("historyPreviewBackdrop");
    if (!backdrop) {
      return;
    }
    function onDismiss() {
      closeHistoryPreview();
    }
    $("btnHistoryPreviewClose").addEventListener("click", onDismiss);
    $("btnHistoryPreviewDismiss").addEventListener("click", onDismiss);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        onDismiss();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && backdrop.classList.contains("open")) {
        onDismiss();
      }
    });

    var modalMenu = $("historyModalExportMenu");
    var modalPreview = $("historyInvoicePreview");

    $("btnHistoryModalPng").addEventListener("click", async function () {
      closeExportMenu(modalMenu);
      if (!state.previewRow) {
        return;
      }
      try {
        await DocumentOutput.exportRowPng(state.previewRow, state.settings, state.logoUrl, modalPreview);
        setStatus("PNG downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "PNG export failed.", "error");
      }
    });
    $("btnHistoryModalPdf").addEventListener("click", async function () {
      closeExportMenu(modalMenu);
      if (!state.previewRow) {
        return;
      }
      try {
        await DocumentOutput.exportRowPdf(
          state.previewRow,
          state.settings,
          state.logoDataUrl,
          modalPreview,
          state.logoUrl
        );
        setStatus("PDF downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "PDF export failed.", "error");
      }
    });
    $("btnHistoryModalPrint").addEventListener("click", function () {
      closeExportMenu(modalMenu);
      if (!state.previewRow) {
        return;
      }
      DocumentOutput.prepareRowPrint(
        state.previewRow,
        state.settings,
        state.logoUrl,
        modalPreview
      );
      Print.printInvoicePreview("historyPreviewPaper");
      setStatus("Print dialog opened.", "info");
    });

    $("btnHistoryShare").addEventListener("click", async function () {
      if (!state.previewRow) {
        return;
      }
      try {
        var result = await DocumentOutput.shareRowPdf(
          state.previewRow,
          state.settings,
          state.logoDataUrl,
          modalPreview,
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

  function matchesHistoryFilters(row, query, date, status) {
    if (status === "draft" && DocumentEditor.isGenerated(row)) {
      return false;
    }
    if (status === "generated" && !DocumentEditor.isGenerated(row)) {
      return false;
    }
    if (date && row.invoiceDate !== date) {
      return false;
    }
    if (!query) {
      return true;
    }
    var displayNo = DocumentEditor.displayDocumentNumber(row, state.settings);
    var statusHay = DocumentEditor.isGenerated(row) ? "generated" : "draft";
    var hay = (displayNo + " " + row.documentNumber + " " + statusHay + " " + ((row.customer && row.customer.name) || "")).toLowerCase();
    return hay.indexOf(query) >= 0;
  }

  async function refreshHistory() {
    var query = ($("historySearch").value || "").trim().toLowerCase();
    var date = $("historyDate").value;
    var status = ($("historyStatus") && $("historyStatus").value) || "all";
    var rows = await DocumentEditor.listDocuments();
    var list = $("historyList");
    var summary = $("historySummary");
    var draftTotal = 0;
    var generatedTotal = 0;
    rows.forEach(function (row) {
      if (DocumentEditor.isGenerated(row)) {
        generatedTotal += 1;
      } else {
        draftTotal += 1;
      }
    });
    var visible = rows.filter(function (row) {
      return matchesHistoryFilters(row, query, date, status);
    });
    if (summary) {
      summary.textContent =
        rows.length === 0
          ? ""
          : draftTotal + " draft" + (draftTotal === 1 ? "" : "s") +
            " · " + generatedTotal + " generated" +
            (visible.length !== rows.length ? " · showing " + visible.length : "");
    }
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    var canShare = DocumentShare.canShareFiles();
    var exportPreview = $("historyExportPreview");

    visible.forEach(function (row) {
      var item = document.createElement("div");
      item.className = "history-item";
      var info = document.createElement("div");
      var strong = document.createElement("strong");
      var statusChip = document.createElement("span");
      var isGenerated = DocumentEditor.isGenerated(row);
      statusChip.className = "history-status " + (isGenerated ? "history-status--generated" : "history-status--draft");
      statusChip.textContent = isGenerated ? "Generated" : "Draft";
      var listNumber = DocumentEditor.displayDocumentNumber(row, state.settings);
      strong.appendChild(document.createTextNode(listNumber + " · " + DocumentTypes.getById(row.documentType).title + " "));
      strong.appendChild(statusChip);
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

      actions.appendChild(makeBtn("Open", function () {
        openHistoryPreview(row);
      }));
      actions.appendChild(createRowExportMenu(row));
      if (canShare) {
        actions.appendChild(makeBtn("Share", async function () {
          try {
            var result = await DocumentOutput.shareRowPdf(
              row,
              state.settings,
              state.logoDataUrl,
              exportPreview,
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
        }));
      }
      actions.appendChild(makeBtn("Duplicate", function () {
        var draft = DocumentEditor.duplicateDocument(row, state.settings);
        sessionStorage.setItem(DRAFT_DOC_KEY, JSON.stringify(draft));
        window.location.href = "index.html";
      }));
      if (!DocumentEditor.isGenerated(row)) {
        actions.appendChild(makeBtn("Delete", async function () {
          var ok = await confirmModal(
            "Delete document?",
            "Delete " + DocumentEditor.displayDocumentNumber(row, state.settings) + "? This cannot be undone.",
            [
            { label: "Cancel", value: false, className: "secondary" },
            { label: "Delete", value: true, className: "danger" }
          ]);
          if (!ok) {
            return;
          }
          try {
            await DocumentEditor.deleteDocument(row.id);
            setStatus("Deleted " + listNumber + ".", "ok");
            refreshHistory();
          } catch (error) {
            setStatus(error.message || "Delete failed.", "error");
          }
        }));
      }

      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });

    if (!list.firstChild) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent =
        rows.length === 0
          ? "No saved invoices yet — save a draft or generate from the editor."
          : "No invoices match your filters.";
      list.appendChild(empty);
    }
  }

  function bindEvents() {
    $("historySearch").addEventListener("input", refreshHistory);
    $("historyDate").addEventListener("change", refreshHistory);
    var statusEl = $("historyStatus");
    if (statusEl) {
      statusEl.addEventListener("change", refreshHistory);
    }
  }

  async function init() {
    try {
      bindEvents();
      bindPreviewModal();
      syncPaperClass($("historyExportPaper"));
      state.settings = await Settings.load();
      await loadLogo(state.settings);
      syncShareAvailability();
      await refreshHistory();
      setStatus("Preview, export, share, duplicate, or delete saved invoices.", "info");
    } catch (error) {
      setStatus(error.message || "Could not load history.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();