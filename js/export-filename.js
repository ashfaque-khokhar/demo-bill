(function (global) {
  "use strict";

  function safe(doc, extension) {
    var type = DocumentTypes.getById(doc.documentType).id;
    var num = String(doc.documentNumber || "draft").replace(/[^\w\-]+/g, "_");
    var stamp = DateTimeFormat.documentTimestamp(doc);
    var when = DateTimeFormat.readableFileSegment(stamp.iso, stamp.ts);
    var ext = String(extension || "pdf").replace(/^\./, "");
    if (!when) {
      return type + "_" + num + "." + ext;
    }
    return type + "_" + num + "_" + when + "." + ext;
  }

  global.ExportFilename = {
    safe: safe
  };
})(window);