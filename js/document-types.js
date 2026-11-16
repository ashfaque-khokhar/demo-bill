(function (global) {
  "use strict";

  var TYPES = [
    {
      id: "bill",
      title: "BILL",
      prefix: "BILL",
      showGstFields: false,
      showTaxTotals: false
    },
    {
      id: "cash-memo",
      title: "CASH MEMO",
      prefix: "CM",
      showGstFields: false,
      showTaxTotals: false
    },
    {
      id: "quotation",
      title: "QUOTATION",
      prefix: "QT",
      showGstFields: false,
      showTaxTotals: false
    },
    {
      id: "receipt",
      title: "RECEIPT",
      prefix: "REC",
      showGstFields: false,
      showTaxTotals: false
    },
    {
      id: "tax-invoice",
      title: "TAX INVOICE",
      prefix: "INV",
      showGstFields: true,
      showTaxTotals: true
    }
  ];

  function getAll() {
    return TYPES.slice();
  }

  function getById(id) {
    for (var i = 0; i < TYPES.length; i += 1) {
      if (TYPES[i].id === id) {
        return TYPES[i];
      }
    }
    return TYPES[0];
  }

  global.DocumentTypes = {
    getAll: getAll,
    getById: getById
  };
})(window);
