(function () {
  "use strict";

  var $ = AppUI.$;
  var setStatus = AppUI.setStatus;
  var confirmModal = AppUI.confirmModal;

  var OPEN_DOC_KEY = "billing.openDocId";
  var DRAFT_DOC_KEY = "billing.draftDocument";

  var state = {
    settings: null
  };

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

      actions.appendChild(makeBtn("Open", function () {
        sessionStorage.setItem(OPEN_DOC_KEY, row.id);
        window.location.href = "index.html";
      }));
      actions.appendChild(makeBtn("Duplicate", function () {
        var draft = DocumentEditor.duplicateDocument(row, state.settings);
        sessionStorage.setItem(DRAFT_DOC_KEY, JSON.stringify(draft));
        window.location.href = "index.html";
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

  function bindEvents() {
    $("historySearch").addEventListener("input", refreshHistory);
    $("historyDate").addEventListener("change", refreshHistory);
  }

  async function init() {
    try {
      bindEvents();
      state.settings = await Settings.load();
      await refreshHistory();
      setStatus("Open, duplicate, or delete saved documents.", "info");
    } catch (error) {
      setStatus(error.message || "Could not load history.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
