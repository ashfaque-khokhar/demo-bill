(function (global) {
  "use strict";

  var BACKUP_VERSION = 1;
  var APP_VERSION = "0.2.0";

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Could not encode asset."));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function createBackup() {
    var settings = await StorageRepository.getAll("settings");
    var items = await StorageRepository.getAll("items");
    var invoices = await StorageRepository.getAll("invoices");
    var assets = await StorageRepository.getAll("assets");
    var encodedAssets = [];

    for (var i = 0; i < assets.length; i += 1) {
      var asset = assets[i];
      var dataUrl = "";
      if (asset.blob) {
        dataUrl = await blobToBase64(asset.blob);
      }
      encodedAssets.push({
        id: asset.id,
        mimeType: asset.mimeType || "application/octet-stream",
        dataUrl: dataUrl,
        createdAt: asset.createdAt || 0
      });
    }

    return {
      app: "billing-generator",
      appVersion: APP_VERSION,
      schemaVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: settings,
      items: items,
      invoices: invoices,
      assets: encodedAssets
    };
  }

  function downloadBackup(backup) {
    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "billing-backup-" + backup.exportedAt.slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    try {
      localStorage.setItem("billing.lastBackupAt", backup.exportedAt);
    } catch (e) {
      // Ignore localStorage failures.
    }
  }

  function dataUrlToBlob(dataUrl) {
    var parts = String(dataUrl || "").split(",");
    if (parts.length < 2) {
      return null;
    }
    var meta = parts[0];
    var data = parts[1];
    var mime = "application/octet-stream";
    var match = meta.match(/data:([^;]+);/);
    if (match) {
      mime = match[1];
    }
    var binary = atob(data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  function validateBackup(raw) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Backup file is invalid.");
    }
    if (raw.app !== "billing-generator") {
      throw new Error("This file is not a Billing Generator backup.");
    }
    if (typeof raw.schemaVersion !== "number") {
      throw new Error("Backup schema version is missing.");
    }
    if (raw.schemaVersion > BACKUP_VERSION) {
      throw new Error("Backup is from a newer app version and cannot be imported.");
    }
    if (!Array.isArray(raw.settings) || !Array.isArray(raw.items) || !Array.isArray(raw.invoices) || !Array.isArray(raw.assets)) {
      throw new Error("Backup structure is incomplete.");
    }
    return raw;
  }

  async function prepareImportPayload(raw) {
    var backup = validateBackup(raw);
    var assets = [];
    for (var i = 0; i < backup.assets.length; i += 1) {
      var row = backup.assets[i];
      var blob = dataUrlToBlob(row.dataUrl);
      if (!blob) {
        continue;
      }
      assets.push({
        id: row.id,
        mimeType: row.mimeType || blob.type,
        blob: blob,
        createdAt: row.createdAt || Date.now()
      });
    }
    return {
      settings: backup.settings,
      items: backup.items,
      invoices: backup.invoices,
      assets: assets
    };
  }

  async function importBackup(raw, mode) {
    var payload = await prepareImportPayload(raw);
    if (mode === "replace") {
      await StorageRepository.replaceAllData(payload);
    } else {
      await StorageRepository.mergeData(payload);
    }
  }

  function lastBackupHint() {
    try {
      return localStorage.getItem("billing.lastBackupAt");
    } catch (e) {
      return null;
    }
  }

  global.BackupRestore = {
    createBackup: createBackup,
    downloadBackup: downloadBackup,
    importBackup: importBackup,
    validateBackup: validateBackup,
    lastBackupHint: lastBackupHint
  };
})(window);
