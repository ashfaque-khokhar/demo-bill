(function (global) {
  "use strict";

  var GST_SELECT_OTHER = "other";

  var PRESET_GST_RATES = [0, 5, 12, 18, 28];

  var PRESET_UNITS = [
    "Piece",
    "Nos",
    "Kg",
    "Gram",
    "Litre",
    "Ml",
    "Metre",
    "Cm",
    "Sq ft",
    "Sq m",
    "Box",
    "Pack",
    "Dozen",
    "Set",
    "Service"
  ];

  function createId() {
    return "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function createLine(overrides) {
    var line = {
      id: createId(),
      catalogueItemId: null,
      name: "",
      quantity: 1,
      unit: "Piece",
      rateMinor: 0,
      discountType: "none",
      discountValue: 0,
      hsnSac: "",
      gstRate: 0
    };
    if (overrides) {
      Object.assign(line, overrides);
    }
    return line;
  }

  function resolveUnitControl(unit) {
    var u = String(unit == null ? "" : unit).trim();
    if (!u) {
      return { mode: "empty", value: "" };
    }
    if (PRESET_UNITS.indexOf(u) >= 0) {
      return { mode: "preset", value: u };
    }
    return { mode: "preset", value: "Piece" };
  }

  function readUnitFromRow(tr) {
    var sel = tr && tr.querySelector(".item-unit");
    if (!sel) {
      return "";
    }
    var v = sel.value;
    if (!v) {
      return "";
    }
    return String(v).trim();
  }

  function unitPickerPromptLines() {
    return PRESET_UNITS.map(function (u, i) {
      return i + 1 + ". " + u;
    }).join("\n");
  }

  function resolveGstControl(rate) {
    var n = Number(rate);
    if (!isFinite(n)) {
      n = 0;
    }
    if (PRESET_GST_RATES.indexOf(n) >= 0) {
      return { mode: "preset", value: n };
    }
    return { mode: "other", value: n };
  }

  function readGstFromRow(tr) {
    var sel = tr && tr.querySelector(".item-gst");
    if (!sel) {
      return 0;
    }
    var v = sel.value;
    if (!v) {
      return 0;
    }
    if (v === GST_SELECT_OTHER) {
      var other = tr.querySelector(".item-gst-other");
      var n = Number(other && other.value);
      return isFinite(n) ? n : 0;
    }
    return Number(v) || 0;
  }

  function gstPickerPromptLines() {
    var lines = PRESET_GST_RATES.map(function (r, i) {
      return i + 1 + ". " + r + "%";
    });
    lines.push(PRESET_GST_RATES.length + 1 + ". Other (custom %)");
    return lines.join("\n");
  }

  function pickGstViaPrompt(defaultChoice) {
    var choice = window.prompt("Enter GST % number:\n" + gstPickerPromptLines(), defaultChoice || "1");
    if (choice == null || String(choice).trim() === "") {
      return null;
    }
    var index = parseInt(choice, 10);
    if (!isFinite(index) || index < 1) {
      return null;
    }
    if (index <= PRESET_GST_RATES.length) {
      return PRESET_GST_RATES[index - 1];
    }
    if (index === PRESET_GST_RATES.length + 1) {
      var custom = window.prompt("Custom GST % (0–100)", "0");
      if (custom == null) {
        return null;
      }
      var n = Number(custom);
      if (!isFinite(n) || n < 0 || n > 100) {
        return null;
      }
      return n;
    }
    return null;
  }

  function pickUnitViaPrompt(defaultChoice) {
    var choice = window.prompt("Enter unit number:\n" + unitPickerPromptLines(), defaultChoice || "1");
    if (choice == null || String(choice).trim() === "") {
      return null;
    }
    var index = parseInt(choice, 10);
    if (!isFinite(index) || index < 1) {
      return null;
    }
    if (index <= PRESET_UNITS.length) {
      return PRESET_UNITS[index - 1];
    }
    return null;
  }

  global.Items = {
    GST_SELECT_OTHER: GST_SELECT_OTHER,
    PRESET_UNITS: PRESET_UNITS,
    PRESET_GST_RATES: PRESET_GST_RATES,
    createId: createId,
    createLine: createLine,
    resolveUnitControl: resolveUnitControl,
    readUnitFromRow: readUnitFromRow,
    resolveGstControl: resolveGstControl,
    readGstFromRow: readGstFromRow,
    pickUnitViaPrompt: pickUnitViaPrompt,
    pickGstViaPrompt: pickGstViaPrompt
  };
})(window);
