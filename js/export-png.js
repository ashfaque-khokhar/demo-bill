(function (global) {
  "use strict";

  function safeFilename(doc) {
    var type = DocumentTypes.getById(doc.documentType).id;
    var num = String(doc.documentNumber || "draft").replace(/[^\w\-]+/g, "_");
    var date = String(doc.invoiceDate || "").replace(/[^\d\-]/g, "");
    return type + "_" + num + "_" + date + ".png";
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function exportPng(previewElement, doc) {
    if (!previewElement) {
      throw new Error("Preview is not ready.");
    }

    var width = Math.max(previewElement.scrollWidth, 794);
    var height = Math.max(previewElement.scrollHeight, 200);
    var scale = 2;

    var canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    var ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    var clone = previewElement.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    clone.style.width = width + "px";
    clone.style.background = "#ffffff";
    clone.style.color = "#111111";
    clone.style.padding = "24px";
    clone.style.boxSizing = "border-box";

    var serializer = new XMLSerializer();
    var html = serializer.serializeToString(clone);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
      '<foreignObject width="100%" height="100%">' + html + "</foreignObject></svg>";

    var svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(svgBlob);

    await new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        try {
          ctx.drawImage(image, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (blob) {
            if (!blob) {
              reject(new Error("PNG export failed."));
              return;
            }
            downloadBlob(blob, safeFilename(doc));
            resolve();
          }, "image/png");
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not render PNG. Try hosting the app over http:// instead of file://."));
      };
      image.src = url;
    });
  }

  global.ExportPng = {
    exportPng: exportPng,
    safeFilename: safeFilename
  };
})(window);
