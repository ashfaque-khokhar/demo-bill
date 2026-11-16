(function (global) {
  "use strict";

  var DB_NAME = "billing-generator";
  var DB_VERSION = 1;
  var dbPromise = null;

  function openDatabase() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }

      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("items")) {
          var items = db.createObjectStore("items", { keyPath: "id" });
          items.createIndex("name", "name", { unique: false });
        }

        if (!db.objectStoreNames.contains("invoices")) {
          var invoices = db.createObjectStore("invoices", { keyPath: "id" });
          invoices.createIndex("documentNumber", "documentNumber", { unique: false });
          invoices.createIndex("invoiceDate", "invoiceDate", { unique: false });
          invoices.createIndex("customerName", "customer.name", { unique: false });
          invoices.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets", { keyPath: "id" });
        }
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function () {
        reject(new Error("Could not open local database."));
      };
    });

    return dbPromise;
  }

  function withStore(storeName, mode, handler) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var result;

        try {
          result = handler(store, tx);
        } catch (error) {
          reject(error);
          return;
        }

        tx.oncomplete = function () {
          resolve(result);
        };
        tx.onerror = function () {
          var message = "Storage operation failed.";
          if (tx.error && tx.error.name === "QuotaExceededError") {
            message = "Browser storage is full. Free space or remove old records, then try again.";
          }
          reject(new Error(message));
        };
        tx.onabort = function () {
          reject(new Error("Storage transaction was aborted."));
        };
      });
    });
  }

  function requestToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error || new Error("Database request failed."));
      };
    });
  }

  global.Db = {
    openDatabase: openDatabase,
    withStore: withStore,
    requestToPromise: requestToPromise
  };
})(window);
