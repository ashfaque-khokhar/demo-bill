(function (global) {
  "use strict";

  function printDocument() {
    global.print();
  }

  global.Print = {
    printDocument: printDocument
  };
})(window);
