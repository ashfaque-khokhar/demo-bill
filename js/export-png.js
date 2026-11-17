(function (global) {
  "use strict";

  function safeFilename(doc) {
    return ExportFilename.safe(doc, "png");
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

  async function waitForImage(img) {
    if (!img || img.complete) {
      return;
    }
    if (typeof img.decode === "function") {
      try {
        await img.decode();
        return;
      } catch (e) {
        // Fall through to load/error wait.
      }
    }
    await new Promise(function (resolve) {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }

  function liveImgToDataUrl(live) {
    if (!live || !live.complete || !live.naturalWidth) {
      return null;
    }
    try {
      var canvas = document.createElement("canvas");
      canvas.width = live.naturalWidth;
      canvas.height = live.naturalHeight;
      canvas.getContext("2d").drawImage(live, 0, 0);
      return canvas.toDataURL("image/png");
    } catch (e) {
      return null;
    }
  }

  async function resolveImgDataUrl(live, img, index, logoDataUrl) {
    var isLogo = img.classList && img.classList.contains("logo");

    if (logoDataUrl && (isLogo || index === 0)) {
      return logoDataUrl;
    }

    await waitForImage(live);

    var fromLive = liveImgToDataUrl(live);
    if (fromLive) {
      return fromLive;
    }

    var src =
      (live && live.currentSrc) ||
      (live && live.getAttribute("src")) ||
      img.getAttribute("src") ||
      "";
    if (src && src.indexOf("data:") === 0) {
      return src;
    }

    return null;
  }

  function removeCloneImage(img) {
    if (img && img.parentNode) {
      img.parentNode.removeChild(img);
    }
  }

  async function inlineCloneImages(preview, clone, logoDataUrl) {
    var liveImages = preview.querySelectorAll("img");
    var images = clone.querySelectorAll("img");
    await Promise.all(
      Array.prototype.map.call(images, async function (img, index) {
        var live = liveImages[index];
        var dataUrl = await resolveImgDataUrl(live, img, index, logoDataUrl);
        if (dataUrl) {
          img.setAttribute("src", dataUrl);
        } else {
          removeCloneImage(img);
        }
      })
    );
  }

  async function buildPngBlob(previewElement, logoDataUrl, paperId) {
    if (!previewElement) {
      throw new Error("Preview is not ready.");
    }

    var id = paperId || "A4";
    var width;
    var height;
    var pad;
    if (global.PaperSizes) {
      width = Math.max(previewElement.scrollWidth, PaperSizes.previewContentWidthPx(id));
      height = Math.max(previewElement.scrollHeight, PaperSizes.previewContentMinHeightPx(id));
      pad = PaperSizes.previewPaddingPx(id);
    } else {
      width = Math.max(previewElement.scrollWidth, 794);
      height = Math.max(previewElement.scrollHeight, 200);
      pad = 24;
    }
    var rasterScale = 2;

    var canvas = document.createElement("canvas");
    canvas.width = width * rasterScale;
    canvas.height = height * rasterScale;
    var ctx = canvas.getContext("2d");
    ctx.scale(rasterScale, rasterScale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    var clone = previewElement.cloneNode(true);
    await inlineCloneImages(previewElement, clone, logoDataUrl || null);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    clone.style.width = width + "px";
    clone.style.background = "#ffffff";
    clone.style.color = "#111111";
    clone.style.padding = pad + "px";
    clone.style.boxSizing = "border-box";
    var invScale = global.PaperSizes ? PaperSizes.layoutScale(id) : 1;
    clone.style.fontSize = 12 * invScale + "px";

    var serializer = new XMLSerializer();
    var html = serializer.serializeToString(clone);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
      '<foreignObject width="100%" height="100%">' + html + "</foreignObject></svg>";

    var svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(svgBlob);

    return new Promise(function (resolve, reject) {
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
            resolve(blob);
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

  async function exportPng(previewElement, doc, logoDataUrl, paperId) {
    var paper = paperId || (doc && doc.paperSize) || "A4";
    var blob = await buildPngBlob(previewElement, logoDataUrl, paper);
    downloadBlob(blob, safeFilename(doc));
  }

  global.ExportPng = {
    buildPngBlob: buildPngBlob,
    exportPng: exportPng,
    downloadBlob: downloadBlob,
    safeFilename: safeFilename
  };
})(window);