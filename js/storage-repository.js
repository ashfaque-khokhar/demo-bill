(function (global) {
  "use strict";

  function get(storeName, id) {
    return Db.withStore(storeName, "readonly", function (store) {
      return Db.requestToPromise(store.get(id));
    }).then(function (value) {
      return value || null;
    });
  }

  function put(storeName, record) {
    return Db.withStore(storeName, "readwrite", function (store) {
      return Db.requestToPromise(store.put(record));
    });
  }

  function remove(storeName, id) {
    return Db.withStore(storeName, "readwrite", function (store) {
      return Db.requestToPromise(store.delete(id));
    });
  }

  function getAll(storeName) {
    return Db.withStore(storeName, "readonly", function (store) {
      return Db.requestToPromise(store.getAll());
    }).then(function (rows) {
      return rows || [];
    });
  }

  function clear(storeName) {
    return Db.withStore(storeName, "readwrite", function (store) {
      return Db.requestToPromise(store.clear());
    });
  }

  function putMany(storeName, records) {
    return Db.openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        for (var i = 0; i < records.length; i += 1) {
          store.put(records[i]);
        }
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(new Error("Could not save records."));
        };
      });
    });
  }

  function findInvoiceByNumber(documentNumber) {
    return Db.openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("invoices", "readonly");
        var store = tx.objectStore("invoices");
        var index = store.index("documentNumber");
        var request = index.getAll(documentNumber);
        request.onsuccess = function () {
          resolve(request.result || []);
        };
        request.onerror = function () {
          reject(new Error("Could not look up document number."));
        };
      });
    });
  }

  function replaceAllData(payload) {
    return Db.openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(["settings", "items", "invoices", "assets"], "readwrite");
        tx.objectStore("settings").clear();
        tx.objectStore("items").clear();
        tx.objectStore("invoices").clear();
        tx.objectStore("assets").clear();

        (payload.settings || []).forEach(function (row) {
          tx.objectStore("settings").put(row);
        });
        (payload.items || []).forEach(function (row) {
          tx.objectStore("items").put(row);
        });
        (payload.invoices || []).forEach(function (row) {
          tx.objectStore("invoices").put(row);
        });
        (payload.assets || []).forEach(function (row) {
          tx.objectStore("assets").put(row);
        });

        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(new Error("Restore failed. Existing data was not partially imported."));
        };
      });
    });
  }

  function mergeData(payload) {
    return Db.openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(["settings", "items", "invoices", "assets"], "readwrite");
        (payload.settings || []).forEach(function (row) {
          tx.objectStore("settings").put(row);
        });
        (payload.items || []).forEach(function (row) {
          tx.objectStore("items").put(row);
        });
        (payload.invoices || []).forEach(function (row) {
          tx.objectStore("invoices").put(row);
        });
        (payload.assets || []).forEach(function (row) {
          tx.objectStore("assets").put(row);
        });
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(new Error("Merge failed."));
        };
      });
    });
  }

  global.StorageRepository = {
    get: get,
    put: put,
    remove: remove,
    getAll: getAll,
    clear: clear,
    putMany: putMany,
    findInvoiceByNumber: findInvoiceByNumber,
    replaceAllData: replaceAllData,
    mergeData: mergeData
  };
})(window);
