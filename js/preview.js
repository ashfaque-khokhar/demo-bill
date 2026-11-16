(function (global) {
  "use strict";

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    return node;
  }

  function text(value) {
    return document.createTextNode(value == null ? "" : String(value));
  }

  function formatDate(iso) {
    if (!iso) {
      return "";
    }
    var parts = String(iso).split("-");
    if (parts.length !== 3) {
      return iso;
    }
    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }

  function render(target, doc, calc, business, logoUrl, displayNumber) {
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }

    var type = DocumentTypes.getById(doc.documentType);
    var headings = (business && business.headings) || Settings.defaultSettings().headings;
    var showTax = !!(doc.gst && doc.gst.enabled);

    var header = el("div", "header");
    var left = el("div");
    if (logoUrl) {
      var img = el("img", "logo");
      img.src = logoUrl;
      img.alt = "Logo";
      img.style.maxWidth = (business.logoWidth || 120) + "px";
      img.style.maxHeight = (business.logoHeight || 48) + "px";
      if (business.logoAlignment === "center") {
        img.style.margin = "0 auto";
      } else if (business.logoAlignment === "right") {
        img.style.marginLeft = "auto";
      }
      left.appendChild(img);
    }
    var bizName = el("div", "biz-name");
    bizName.appendChild(text(business.businessName || "Your Business"));
    left.appendChild(bizName);
    left.appendChild(el("div")).appendChild(text(business.address || ""));
    left.appendChild(el("div")).appendChild(text(business.mobile ? ("Tel: " + business.mobile) : ""));
    if (business.email) {
      left.appendChild(el("div")).appendChild(text(business.email));
    }
    if (business.gstin) {
      left.appendChild(el("div")).appendChild(text("GSTIN: " + business.gstin));
    }
    if (business.supplierState) {
      left.appendChild(el("div")).appendChild(text("State: " + business.supplierState));
    }
    header.appendChild(left);

    var meta = el("div", "meta");
    var title = el("div", "doc-title");
    title.appendChild(text(type.title));
    meta.appendChild(title);
    var numberLabel = displayNumber != null && displayNumber !== ""
      ? displayNumber
      : (doc.documentNumber || "—");
    if (numberLabel.charAt(0) === "~") {
      numberLabel = "Draft " + numberLabel.slice(1);
    }
    meta.appendChild(el("div")).appendChild(text("No: " + numberLabel));
    meta.appendChild(el("div")).appendChild(text("Date: " + formatDate(doc.invoiceDate)));
    if (showTax && calc.supplyType && calc.supplyType !== "none") {
      meta.appendChild(el("div")).appendChild(text("Supply: " + calc.supplyType));
    }
    header.appendChild(meta);
    target.appendChild(header);

    var party = el("div", "party");
    var billTo = el("div");
    var billLabel = el("strong");
    billLabel.appendChild(text("Bill To"));
    billTo.appendChild(billLabel);
    billTo.appendChild(el("div")).appendChild(text((doc.customer && doc.customer.name) || ""));
    if (doc.customer && doc.customer.mobile) {
      billTo.appendChild(el("div")).appendChild(text(doc.customer.mobile));
    }
    if (doc.customer && doc.customer.address) {
      billTo.appendChild(el("div")).appendChild(text(doc.customer.address));
    }
    if (doc.customer && doc.customer.gstin) {
      billTo.appendChild(el("div")).appendChild(text("GSTIN: " + doc.customer.gstin));
    }
    if (doc.customer && doc.customer.state) {
      billTo.appendChild(el("div")).appendChild(text("Place of supply: " + doc.customer.state));
    }
    party.appendChild(billTo);

    var extra = el("div");
    if (doc.notes) {
      var noteLabel = el("strong");
      noteLabel.appendChild(text("Reference"));
      extra.appendChild(noteLabel);
      extra.appendChild(el("div")).appendChild(text(doc.notes));
    }
    party.appendChild(extra);
    target.appendChild(party);

    var table = el("table");
    var thead = el("thead");
    var headRow = el("tr");
    var cols = [headings.item, headings.quantity, headings.unit, headings.rate];
    if (showTax) {
      cols.push("HSN");
      cols.push(headings.tax);
    }
    cols.push(headings.amount);
    cols.forEach(function (label) {
      var th = el("th");
      th.appendChild(text(label));
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el("tbody");
    (calc.items || []).forEach(function (item, index) {
      var tr = el("tr");
      var nameCell = el("td");
      nameCell.appendChild(text((index + 1) + ". " + (item.name || "Item")));
      if (item.description) {
        nameCell.appendChild(el("div")).appendChild(text(item.description));
      }
      tr.appendChild(nameCell);

      var qty = el("td", "center");
      qty.appendChild(text(String(item.quantity)));
      tr.appendChild(qty);

      var unit = el("td", "center");
      unit.appendChild(text(item.unit || ""));
      tr.appendChild(unit);

      var rate = el("td", "right");
      rate.appendChild(text(Money.formatINR(item.rateMinor)));
      tr.appendChild(rate);

      if (showTax) {
        var hsn = el("td", "center");
        hsn.appendChild(text(item.hsnSac || ""));
        tr.appendChild(hsn);
        var tax = el("td", "right");
        tax.appendChild(text(String(item.gstRate) + "%"));
        tr.appendChild(tax);
      }

      var amount = el("td", "right");
      amount.appendChild(text(Money.formatINR(item.lineTotalMinor)));
      tr.appendChild(amount);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    target.appendChild(table);

    var totals = el("table", "totals");
    function addTotal(label, value, strong) {
      var tr = el("tr");
      var td1 = el("td");
      var td2 = el("td", "right");
      if (strong) {
        var s1 = el("strong");
        s1.appendChild(text(label));
        td1.appendChild(s1);
        var s2 = el("strong");
        s2.appendChild(text(value));
        td2.appendChild(s2);
      } else {
        td1.appendChild(text(label));
        td2.appendChild(text(value));
      }
      tr.appendChild(td1);
      tr.appendChild(td2);
      totals.appendChild(tr);
    }

    addTotal(headings.subtotal, Money.formatINR(calc.subtotalMinor));
    if (calc.discountMinor > 0) {
      addTotal("Discount", "- " + Money.formatINR(calc.discountMinor));
    }
    if (showTax) {
      addTotal("Taxable value", Money.formatINR(calc.taxableValueMinor));
      if (calc.cgstMinor > 0) {
        addTotal("CGST", Money.formatINR(calc.cgstMinor));
      }
      if (calc.sgstMinor > 0) {
        addTotal("SGST", Money.formatINR(calc.sgstMinor));
      }
      if (calc.igstMinor > 0) {
        addTotal("IGST", Money.formatINR(calc.igstMinor));
      }
    }
    addTotal(headings.grandTotal, Money.formatINR(calc.grandTotalMinor), true);
    target.appendChild(totals);

    var words = el("div");
    words.style.marginTop = "10px";
    words.appendChild(text("Amount in words: " + calc.amountInWords));
    target.appendChild(words);

    if (business.upiId || business.bankDetails) {
      var pay = el("div");
      pay.style.marginTop = "10px";
      if (business.upiId) {
        pay.appendChild(el("div")).appendChild(text("UPI: " + business.upiId));
      }
      if (business.bankDetails) {
        pay.appendChild(el("div")).appendChild(text("Bank: " + business.bankDetails));
      }
      target.appendChild(pay);
    }

    if (business.disclaimer) {
      var disc = el("div", "disclaimer");
      disc.appendChild(text(business.disclaimer));
      target.appendChild(disc);
    }
  }

  global.Preview = {
    render: render,
    formatDate: formatDate
  };
})(window);
