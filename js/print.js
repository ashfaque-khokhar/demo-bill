(function (global) {
  "use strict";

  var PRINT_CLASS = "is-printing-invoice";
  var STYLE_ID = "print-paper-size";

  function clearPrintPaperSize() {
    var node = document.getElementById(STYLE_ID);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function setPrintPaperSize(paperId) {
    clearPrintPaperSize();
    if (!paperId || !global.PaperSizes) {
      return;
    }
    var size = PaperSizes.printPageSize(paperId);
    var margin = PaperSizes.printMarginMm(paperId);
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "@media print { @page { size: " + size + "; margin: " + margin + "mm; } }";
    document.head.appendChild(style);
  }

  function printDocument() {
    global.print();
  }

  function printInvoicePreview(paperRootId, paperId) {
    var paper = document.getElementById(paperRootId);
    if (!paper) {
      printDocument();
      return;
    }
    setPrintPaperSize(paperId || paper.getAttribute("data-paper-id") || "A4");
    document.body.classList.add(PRINT_CLASS);
    document.body.setAttribute("data-print-target", paperRootId);

    function cleanup() {
      document.body.classList.remove(PRINT_CLASS);
      document.body.removeAttribute("data-print-target");
      clearPrintPaperSize();
      global.removeEventListener("afterprint", cleanup);
    }

    global.addEventListener("afterprint", cleanup);
    global.print();
  }

  global.Print = {
    printDocument: printDocument,
    printInvoicePreview: printInvoicePreview,
    setPrintPaperSize: setPrintPaperSize,
    clearPrintPaperSize: clearPrintPaperSize
  };
})(window);