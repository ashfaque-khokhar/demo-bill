(function (global) {
  "use strict";

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Could not read image."));
      };
      reader.readAsDataURL(blob);
    });
  }

  function canShareFiles() {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return false;
    }
    if (typeof File === "undefined") {
      return false;
    }
    try {
      var probe = new File(["x"], "probe.pdf", { type: "application/pdf" });
      if (typeof navigator.canShare === "function") {
        return navigator.canShare({ files: [probe] });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function shareTitle(doc) {
    var type = DocumentTypes.getById(doc.documentType);
    var num = doc.documentNumber || "draft";
    return num + " · " + (type && type.title ? type.title : "Invoice");
  }

  async function sharePdfBlob(blob, doc) {
    var filename = ExportPdf.safeFilename(doc);
    var file = new File([blob], filename, { type: "application/pdf" });
    var payload = { files: [file], title: shareTitle(doc) };

    if (!canShareFiles()) {
      ExportPdf.downloadBlob(blob, filename);
      return "downloaded";
    }

    if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) {
      ExportPdf.downloadBlob(blob, filename);
      return "downloaded";
    }

    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      if (error && error.name === "AbortError") {
        return "cancelled";
      }
      ExportPdf.downloadBlob(blob, filename);
      return "downloaded";
    }
  }

  global.DocumentShare = {
    blobToDataUrl: blobToDataUrl,
    canShareFiles: canShareFiles,
    sharePdfBlob: sharePdfBlob
  };
})(window);