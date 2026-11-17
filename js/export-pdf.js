(function (global) {
  "use strict";

  var fontCache = null;

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var chunk = 0x8000;
    var binary = "";
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function loadFont() {
    if (fontCache) {
      return fontCache;
    }
    var response = await fetch("assets/fonts/NotoSans-Regular.ttf");
    if (!response.ok) {
      throw new Error("Could not load PDF font.");
    }
    var buffer = await response.arrayBuffer();
    fontCache = arrayBufferToBase64(buffer);
    return fontCache;
  }

  function pageSize(paper) {
    if (paper === "A5") {
      return { format: "a5", width: 148, height: 210 };
    }
    return { format: "a4", width: 210, height: 297 };
  }

  function safeFilename(doc) {
    var type = DocumentTypes.getById(doc.documentType).id;
    var num = String(doc.documentNumber || "draft").replace(/[^\w\-]+/g, "_");
    var date = String(doc.invoiceDate || "").replace(/[^\d\-]/g, "");
    return type + "_" + num + "_" + date + ".pdf";
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

  async function buildPdfBlob(doc, calc, business, logoDataUrl, paper) {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error("PDF library is not available.");
    }

    var JsPDF = global.jspdf.jsPDF;
    var size = pageSize(paper || "A4");
    var pdf = new JsPDF({ unit: "mm", format: size.format, orientation: "portrait" });
    var fontBase64 = await loadFont();
    pdf.addFileToVFS("NotoSans-Regular.ttf", fontBase64);
    pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    pdf.setFont("NotoSans", "normal");

    var margin = 12;
    var y = margin;
    var pageWidth = size.width;
    var contentWidth = pageWidth - margin * 2;
    var type = DocumentTypes.getById(doc.documentType);
    var showTax = !!(doc.gst && doc.gst.enabled);

    function ensureSpace(needed) {
      if (y + needed > size.height - margin) {
        pdf.addPage();
        y = margin;
      }
    }

    function line(text, x, sizePt, align) {
      pdf.setFontSize(sizePt || 10);
      pdf.text(String(text || ""), x, y, { align: align || "left" });
    }

    if (logoDataUrl) {
      try {
        var fmt = logoDataUrl.indexOf("image/png") >= 0 ? "PNG" : "JPEG";
        pdf.addImage(logoDataUrl, fmt, margin, y, 30, 12);
      } catch (e) {
        // Ignore logo failures and continue with text.
      }
    }

    pdf.setFontSize(14);
    pdf.text(business.businessName || "Your Business", margin + (logoDataUrl ? 34 : 0), y + 6);
    y += 16;
    pdf.setFontSize(9);
    var bizLines = [
      business.address || "",
      business.mobile ? ("Tel: " + business.mobile) : "",
      business.email || "",
      business.gstin ? ("GSTIN: " + business.gstin) : "",
      business.supplierState ? ("State: " + business.supplierState) : ""
    ].filter(Boolean);
    bizLines.forEach(function (row) {
      ensureSpace(5);
      pdf.text(row, margin, y);
      y += 4.5;
    });

    y += 2;
    pdf.setFontSize(13);
    pdf.text(type.title, pageWidth - margin, margin + 6, { align: "right" });
    pdf.setFontSize(9);
    pdf.text("No: " + (doc.documentNumber || "—"), pageWidth - margin, margin + 12, { align: "right" });
    pdf.text("Date: " + Preview.formatDate(doc.invoiceDate), pageWidth - margin, margin + 17, { align: "right" });

    y += 4;
    ensureSpace(20);
    pdf.setFontSize(10);
    pdf.text("Bill To", margin, y);
    y += 5;
    pdf.setFontSize(9);
    var customerLines = [
      (doc.customer && doc.customer.name) || "",
      (doc.customer && doc.customer.mobile) || "",
      (doc.customer && doc.customer.address) || "",
      doc.customer && doc.customer.gstin ? ("GSTIN: " + doc.customer.gstin) : "",
      doc.customer && doc.customer.state ? ("Place of supply: " + doc.customer.state) : ""
    ].filter(Boolean);
    customerLines.forEach(function (row) {
      ensureSpace(5);
      pdf.text(row, margin, y);
      y += 4.5;
    });

    y += 4;
    ensureSpace(12);
    var colX = {
      item: margin,
      qty: margin + contentWidth * 0.46,
      rate: margin + contentWidth * 0.58,
      tax: margin + contentWidth * 0.72,
      amount: pageWidth - margin
    };

    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, y - 4, contentWidth, 7, "F");
    pdf.setFontSize(8);
    pdf.text((business.headings && business.headings.item) || "Item", colX.item, y);
    pdf.text("Qty", colX.qty, y);
    pdf.text("Rate", colX.rate, y);
    if (showTax) {
      pdf.text("GST%", colX.tax, y);
    }
    pdf.text("Amount", colX.amount, y, { align: "right" });
    y += 6;
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 4;

    (calc.items || []).forEach(function (item, index) {
      var name = (index + 1) + ". " + (item.name || "Item");
      var wrapped = pdf.splitTextToSize(name, contentWidth * 0.44);
      var rowHeight = Math.max(6, wrapped.length * 4.2);
      ensureSpace(rowHeight + 2);
      pdf.setFontSize(9);
      pdf.text(wrapped, colX.item, y);
      pdf.text(String(item.quantity), colX.qty, y);
      pdf.text(Money.formatINR(item.rateMinor), colX.rate, y);
      if (showTax) {
        pdf.text(String(item.gstRate), colX.tax, y);
      }
      pdf.text(Money.formatINR(item.lineTotalMinor), colX.amount, y, { align: "right" });
      y += rowHeight;
    });

    y += 4;
    ensureSpace(40);
    function totalRow(label, value, bold) {
      ensureSpace(6);
      pdf.setFontSize(bold ? 11 : 9);
      pdf.text(label, pageWidth - margin - 55, y);
      pdf.text(value, pageWidth - margin, y, { align: "right" });
      y += 5;
    }

    totalRow("Subtotal", Money.formatINR(calc.subtotalMinor));
    if (calc.discountMinor > 0) {
      totalRow("Discount", "- " + Money.formatINR(calc.discountMinor));
    }
    if (showTax) {
      totalRow("Taxable", Money.formatINR(calc.taxableValueMinor));
      if (calc.cgstMinor > 0) {
        totalRow("CGST", Money.formatINR(calc.cgstMinor));
      }
      if (calc.sgstMinor > 0) {
        totalRow("SGST", Money.formatINR(calc.sgstMinor));
      }
      if (calc.igstMinor > 0) {
        totalRow("IGST", Money.formatINR(calc.igstMinor));
      }
    }
    totalRow("Grand Total", Money.formatINR(calc.grandTotalMinor), true);

    y += 3;
    ensureSpace(12);
    pdf.setFontSize(9);
    var words = pdf.splitTextToSize("Amount in words: " + calc.amountInWords, contentWidth);
    pdf.text(words, margin, y);
    y += words.length * 4.5 + 4;

    if (business.upiId || business.bankDetails) {
      ensureSpace(12);
      if (business.upiId) {
        pdf.text("UPI: " + business.upiId, margin, y);
        y += 4.5;
      }
      if (business.bankDetails) {
        pdf.text("Bank: " + business.bankDetails, margin, y);
        y += 4.5;
      }
    }

    if (business.disclaimer) {
      y += 2;
      ensureSpace(16);
      pdf.setDrawColor(180);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 5;
      var disc = pdf.splitTextToSize(business.disclaimer, contentWidth);
      pdf.setFontSize(8);
      pdf.text(disc, margin, y);
    }

    return pdf.output("blob");
  }

  async function exportPdf(doc, calc, business, logoDataUrl, paper) {
    var blob = await buildPdfBlob(doc, calc, business, logoDataUrl, paper);
    downloadBlob(blob, safeFilename(doc));
  }

  global.ExportPdf = {
    buildPdfBlob: buildPdfBlob,
    exportPdf: exportPdf,
    downloadBlob: downloadBlob,
    safeFilename: safeFilename
  };
})(window);
