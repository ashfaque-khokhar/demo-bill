(function (global) {
  "use strict";

  function paperSize(settings, row) {
    if (row && row.paperSize) {
      return row.paperSize;
    }
    return (settings && settings.paperSize) || "A4";
  }

  function renderDocumentPreview(targetEl, row, settings, logoUrl) {
    if (!targetEl) {
      throw new Error("Preview target is missing.");
    }
    var business = row.businessSnapshot || settings;
    var calc = Calculations.calculateDocument(row, settings);
    var displayNumber = DocumentEditor.displayDocumentNumber(row, settings);
    Preview.render(targetEl, row, calc, business, logoUrl, displayNumber);
    return calc;
  }

  function exportRowPng(row, settings, logoUrl, previewEl) {
    renderDocumentPreview(previewEl, row, settings, logoUrl);
    return ExportPng.exportPng(previewEl, row);
  }

  async function exportRowPdf(row, settings, logoDataUrl, previewEl, logoUrl) {
    var calc = renderDocumentPreview(previewEl, row, settings, logoUrl || "assets/logo-placeholder.svg");
    var business = row.businessSnapshot || settings;
    await ExportPdf.exportPdf(row, calc, business, logoDataUrl, paperSize(settings, row));
  }

  async function shareRowPdf(row, settings, logoDataUrl, previewEl, logoUrl) {
    var calc = renderDocumentPreview(previewEl, row, settings, logoUrl || "assets/logo-placeholder.svg");
    var business = row.businessSnapshot || settings;
    var blob = await ExportPdf.buildPdfBlob(row, calc, business, logoDataUrl, paperSize(settings, row));
    return DocumentShare.sharePdfBlob(blob, row);
  }

  function calcForRow(row, settings) {
    return Calculations.calculateDocument(row, settings);
  }

  global.DocumentOutput = {
    paperSize: paperSize,
    renderDocumentPreview: renderDocumentPreview,
    exportRowPng: exportRowPng,
    exportRowPdf: exportRowPdf,
    shareRowPdf: shareRowPdf,
    calcForRow: calcForRow
  };
})(window);