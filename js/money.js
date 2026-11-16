(function (global) {
  "use strict";

  function toPaise(rupees) {
    var n = Number(rupees);
    if (!isFinite(n) || n < 0) {
      return 0;
    }
    return Math.round(n * 100);
  }

  function fromPaise(paise) {
    var n = Number(paise);
    if (!isFinite(n)) {
      return 0;
    }
    return n / 100;
  }

  function roundPaise(value) {
    var n = Number(value);
    if (!isFinite(n)) {
      return 0;
    }
    return Math.round(n);
  }

  function formatINR(paise) {
    var amount = fromPaise(roundPaise(paise));
    return "₹" + amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatPlain(paise) {
    return fromPaise(roundPaise(paise)).toFixed(2);
  }

  var ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  var tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n) {
    if (n < 20) {
      return ones[n];
    }
    var t = Math.floor(n / 10);
    var o = n % 10;
    if (o === 0) {
      return tens[t];
    }
    return tens[t] + " " + ones[o];
  }

  function amountInWords(paise) {
    var total = roundPaise(paise);
    if (total < 0) {
      return "";
    }
    var rupees = Math.floor(total / 100);
    var p = total % 100;
    if (rupees === 0 && p === 0) {
      return "Zero Rupees Only";
    }

    function chunk(n) {
      var parts = [];
      var crore = Math.floor(n / 10000000);
      n = n % 10000000;
      var lakh = Math.floor(n / 100000);
      n = n % 100000;
      var thousand = Math.floor(n / 1000);
      n = n % 1000;
      var hundred = Math.floor(n / 100);
      var rest = n % 100;

      if (crore) {
        parts.push(twoDigits(crore) + " Crore");
      }
      if (lakh) {
        parts.push(twoDigits(lakh) + " Lakh");
      }
      if (thousand) {
        parts.push(twoDigits(thousand) + " Thousand");
      }
      if (hundred) {
        parts.push(ones[hundred] + " Hundred");
      }
      if (rest) {
        parts.push(twoDigits(rest));
      }
      return parts.join(" ");
    }

    var words = chunk(rupees);
    var out = (words || "Zero") + " Rupees";
    if (p > 0) {
      out += " and " + twoDigits(p) + " Paise";
    }
    return out + " Only";
  }

  global.Money = {
    toPaise: toPaise,
    fromPaise: fromPaise,
    roundPaise: roundPaise,
    formatINR: formatINR,
    formatPlain: formatPlain,
    amountInWords: amountInWords
  };
})(window);
