(function (global) {
  "use strict";

  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function parseInvoiceMoment(iso, timestampMs) {
    if (timestampMs && timestampMs > 0) {
      return new Date(timestampMs);
    }
    if (!iso) {
      return null;
    }
    var parts = String(iso).split("-");
    if (parts.length !== 3) {
      return null;
    }
    var y = Number(parts[0]);
    var m = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    if (!y || m < 0 || m > 11 || !day) {
      return null;
    }
    return new Date(y, m, day);
  }

  function documentTimestamp(doc) {
    if (!doc) {
      return { iso: "", ts: 0 };
    }
    return {
      iso: doc.invoiceDate || "",
      ts: doc.generatedAt || doc.updatedAt || 0
    };
  }

  function formatDisplay(iso, timestampMs) {
    var d = parseInvoiceMoment(iso, timestampMs);
    if (!d || isNaN(d.getTime())) {
      return iso ? String(iso) : "";
    }
    var dd = String(d.getDate()).padStart(2, "0");
    var mmm = MONTH_SHORT[d.getMonth()];
    var yyyy = String(d.getFullYear());
    var h24 = d.getHours();
    var hh = String(h24 % 12 || 12).padStart(2, "0");
    var minutes = String(d.getMinutes()).padStart(2, "0");
    var ap = h24 >= 12 ? "pm" : "am";
    return dd + " " + mmm + " " + yyyy + " @ " + hh + ":" + minutes + " " + ap;
  }

  function readableFileSegment(iso, timestampMs) {
    var d = parseInvoiceMoment(iso, timestampMs);
    if (!d || isNaN(d.getTime())) {
      return "";
    }
    var dd = String(d.getDate()).padStart(2, "0");
    var mmm = MONTH_SHORT[d.getMonth()];
    var yyyy = String(d.getFullYear());
    var h24 = d.getHours();
    var hh = String(h24 % 12 || 12).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    var ap = h24 >= 12 ? "pm" : "am";
    return dd + "-" + mmm + "-" + yyyy + "_" + hh + "-" + mi + "-" + ap;
  }

  function tokens(iso, timestampMs) {
    var dateOnly = parseInvoiceMoment(iso, 0);
    if (!dateOnly || isNaN(dateOnly.getTime())) {
      return {
        dd: "",
        mmm: "",
        hh: "00",
        mi: "00",
        ap: "am"
      };
    }
    var timeSource = timestampMs && timestampMs > 0 ? new Date(timestampMs) : dateOnly;
    if (!timeSource || isNaN(timeSource.getTime())) {
      timeSource = dateOnly;
    }
    var h24 = timeSource.getHours();
    return {
      dd: String(dateOnly.getDate()).padStart(2, "0"),
      mmm: MONTH_SHORT[dateOnly.getMonth()],
      hh: String(h24 % 12 || 12).padStart(2, "0"),
      mi: String(timeSource.getMinutes()).padStart(2, "0"),
      ap: h24 >= 12 ? "pm" : "am"
    };
  }

  global.DateTimeFormat = {
    parseInvoiceMoment: parseInvoiceMoment,
    documentTimestamp: documentTimestamp,
    formatDisplay: formatDisplay,
    readableFileSegment: readableFileSegment,
    tokens: tokens
  };
})(window);