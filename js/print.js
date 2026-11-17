(function (global) {
  "use strict";

  var PRINT_CLASS = "is-printing-invoice";

  function printDocument() {
    global.print();
  }

  function printInvoicePreview(paperRootId) {
    var paper = document.getElementById(paperRootId);
    if (!paper) {
      printDocument();
      return;
    }
    document.body.classList.add(PRINT_CLASS);
    document.body.setAttribute("data-print-target", paperRootId);

    function cleanup() {
      document.body.classList.remove(PRINT_CLASS);
      document.body.removeAttribute("data-print-target");
      global.removeEventListener("afterprint", cleanup);
    }

    global.addEventListener("afterprint", cleanup);
    global.print();
  }

  global.Print = {
    printDocument: printDocument,
    printInvoicePreview: printInvoicePreview
  };
})(window);