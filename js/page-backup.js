(function () {
  "use strict";

  var $ = AppUI.$;
  var setStatus = AppUI.setStatus;
  var confirmModal = AppUI.confirmModal;

  function refreshBackupHint() {
    var at = BackupRestore.lastBackupHint();
    $("lastBackupHint").textContent = at
      ? ("Last backup downloaded from this browser: " + at)
      : "No backup recorded yet in this browser.";
  }

  function bindEvents() {
    $("btnExportBackup").addEventListener("click", async function () {
      try {
        var backup = await BackupRestore.createBackup();
        BackupRestore.downloadBackup(backup);
        refreshBackupHint();
        setStatus("Backup downloaded.", "ok");
      } catch (error) {
        setStatus(error.message || "Backup failed.", "error");
      }
    });

    $("backupFile").addEventListener("change", async function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      try {
        var text = await file.text();
        var raw = JSON.parse(text);
        BackupRestore.validateBackup(raw);
        var mode = await confirmModal(
          "Import backup",
          "Replace all local data, or merge into existing records?",
          [
            { label: "Cancel", value: "", className: "secondary" },
            { label: "Merge", value: "merge", className: "secondary" },
            { label: "Replace", value: "replace", className: "danger" }
          ]
        );
        if (!mode) {
          event.target.value = "";
          return;
        }
        await BackupRestore.importBackup(raw, mode);
        setStatus("Backup imported (" + mode + ").", "ok");
        window.location.href = "history.html";
      } catch (error) {
        setStatus(error.message || "Import failed.", "error");
      }
      event.target.value = "";
    });
  }

  async function init() {
    try {
      bindEvents();
      refreshBackupHint();
      setStatus("Download a backup regularly. Import merges or replaces local data.", "info");
    } catch (error) {
      setStatus(error.message || "Could not open backup page.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
