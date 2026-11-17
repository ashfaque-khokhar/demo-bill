(function (global) {
  "use strict";

  function pad(num, width) {
    var s = String(num);
    while (s.length < width) {
      s = "0" + s;
    }
    return s;
  }

  function formatNumber(pattern, tokens) {
    var out = String(pattern || "{PREFIX}/{YYYY}/{SEQ}");
    out = out.replace(/\{PREFIX\}/g, tokens.prefix || "");
    out = out.replace(/\{YYYY\}/g, tokens.yyyy || "");
    out = out.replace(/\{YY\}/g, tokens.yy || "");
    out = out.replace(/\{MM\}/g, tokens.mm || "");
    out = out.replace(/\{SEQ\}/g, tokens.seq || "");
    out = out.replace(/\{DD\}/g, tokens.dd || "");
    out = out.replace(/\{MMM\}/g, tokens.mmm || "");
    out = out.replace(/\{HH\}/g, tokens.hh || "");
    out = out.replace(/\{MI\}/g, tokens.mi || "");
    out = out.replace(/\{AP\}/g, tokens.ap || "");
    return out;
  }

  function nextSequence(settings, documentTypeId, dateStr) {
    var numbering = settings.numbering || {};
    var map = numbering.nextSequenceByType || {};
    var yearMap = numbering.lastYearByType || {};
    var start = Number(numbering.sequenceStart) || 1;
    var resetRule = numbering.resetRule || "never";
    var year = String(dateStr || "").slice(0, 4);
    var current = map[documentTypeId];

    if (typeof current !== "number" || !isFinite(current) || current < start) {
      current = start;
    }

    if (resetRule === "yearly") {
      var lastYear = yearMap[documentTypeId];
      if (lastYear && lastYear !== year) {
        current = start;
      }
    }

    return {
      sequenceValue: current,
      year: year
    };
  }

  function reserveNext(settings, documentTypeId, dateStr) {
    var info = nextSequence(settings, documentTypeId, dateStr);
    var numbering = settings.numbering || {};
    if (!numbering.nextSequenceByType) {
      numbering.nextSequenceByType = {};
    }
    if (!numbering.lastYearByType) {
      numbering.lastYearByType = {};
    }
    numbering.nextSequenceByType[documentTypeId] = info.sequenceValue + 1;
    numbering.lastYearByType[documentTypeId] = info.year;
    settings.numbering = numbering;
    return info.sequenceValue;
  }

  function buildDocumentNumber(settings, documentTypeId, sequenceValue, dateStr, timestampMs) {
    var type = DocumentTypes.getById(documentTypeId);
    var numbering = settings.numbering || {};
    var prefixMap = numbering.prefixByType || {};
    var prefix = prefixMap[documentTypeId] || type.prefix;
    var date = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
    var yyyy = String(date.getFullYear());
    var yy = yyyy.slice(-2);
    var mm = pad(date.getMonth() + 1, 2);
    var seq = pad(sequenceValue, Number(numbering.sequencePadding) || 4);
    var when = DateTimeFormat.tokens(dateStr, timestampMs || 0);
    return formatNumber(numbering.pattern, {
      prefix: prefix,
      yyyy: yyyy,
      yy: yy,
      mm: mm,
      seq: seq,
      dd: when.dd,
      mmm: when.mmm,
      hh: when.hh,
      mi: when.mi,
      ap: when.ap
    });
  }

  function peekNumber(settings, documentTypeId, dateStr, timestampMs) {
    var info = nextSequence(settings, documentTypeId, dateStr);
    return {
      documentNumber: buildDocumentNumber(
        settings,
        documentTypeId,
        info.sequenceValue,
        dateStr,
        timestampMs || 0
      ),
      sequenceValue: info.sequenceValue
    };
  }

  function consumeSequenceValue(settings, documentTypeId, dateStr, sequenceValue) {
    var numbering = settings.numbering || {};
    if (!numbering.nextSequenceByType) {
      numbering.nextSequenceByType = {};
    }
    if (!numbering.lastYearByType) {
      numbering.lastYearByType = {};
    }
    var info = nextSequence(settings, documentTypeId, dateStr);
    var current = numbering.nextSequenceByType[documentTypeId];
    if (typeof current !== "number" || !isFinite(current) || current <= sequenceValue) {
      numbering.nextSequenceByType[documentTypeId] = sequenceValue + 1;
    }
    numbering.lastYearByType[documentTypeId] = info.year;
    settings.numbering = numbering;
    return sequenceValue;
  }

  global.Numbering = {
    formatNumber: formatNumber,
    nextSequence: nextSequence,
    reserveNext: reserveNext,
    buildDocumentNumber: buildDocumentNumber,
    peekNumber: peekNumber,
    consumeSequenceValue: consumeSequenceValue
  };
})(window);
