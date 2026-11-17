(function (global) {
  "use strict";

  function paperSize(settings, row) {
    if (row && row.paperSize) {
      return row.paperSize;
    }
    return (settings && settings.paperSize) || "A4";
  }

  function renderDocumentPreview(targetEl, row, settings, logoUrl, paperEl) {
    if (!targetEl) {
      throw new Error("Preview target is missing.");
    }
    var pid = paperSize(settings, row);
    if (paperEl) {
      PaperSizes.applyToPaperEl(paperEl, pid);
    }
    var business = row.businessSnapshot || settings;
    var calc = Calculations.calculateDocument(row, settings);
    var displayNumber = DocumentEditor.displayDocumentNumber(row, settings);
    Preview.render(targetEl, row, calc, business, logoUrl, displayNumber, PaperSizes.layoutScale(pid));
    return calc;
  }

  function renderForExport(targetEl, row, settings, logoUrl, paperEl) {
    var calc = renderDocumentPreview(targetEl, row, settings, logoUrl, paperEl);
    Preview.prepareForExport(targetEl, row);
    return calc;
  }

  function prepareRowPrint(row, settings, logoUrl, previewEl) {
    return renderForExport(previewEl, row, settings, logoUrl);
  }

  function exportRowPng(row, settings, logoUrl, previewEl, logoDataUrl, paperEl) {
    renderForExport(previewEl, row, settings, logoUrl, paperEl);
    var pid = paperSize(settings, row);
    return ExportPng.exportPng(previewEl, row, logoDataUrl, pid);
  }

  async function exportRowPdf(row, settings, logoDataUrl, previewEl, logoUrl, paperEl) {
    renderForExport(previewEl, row, settings, logoUrl || "assets/logo-placeholder.svg", paperEl);
    var calc = Calculations.calculateDocument(row, settings);
    var business = row.businessSnapshot || settings;
    await ExportPdf.exportPdf(row, calc, business, logoDataUrl, paperSize(settings, row));
  }

  async function shareRowPdf(row, settings, logoDataUrl, previewEl, logoUrl, paperEl) {
    renderForExport(previewEl, row, settings, logoUrl || "assets/logo-placeholder.svg", paperEl);
    var calc = Calculations.calculateDocument(row, settings);
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
    renderForExport: renderForExport,
    prepareRowPrint: prepareRowPrint,
    exportRowPng: exportRowPng,
    exportRowPdf: exportRowPdf,
    shareRowPdf: shareRowPdf,
    calcForRow: calcForRow
  };
})(window);