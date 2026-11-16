(function (global) {
  "use strict";

  function createId() {
    return "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function createLine(overrides) {
    var line = {
      id: createId(),
      catalogueItemId: null,
      name: "",
      description: "",
      quantity: 1,
      unit: "Piece",
      rateMinor: 0,
      discountType: "none",
      discountValue: 0,
      hsnSac: "",
      gstRate: 0
    };
    if (overrides) {
      Object.assign(line, overrides);
    }
    return line;
  }

  function fromCatalogue(entry) {
    return createLine({
      catalogueItemId: entry.id,
      name: entry.name || "",
      description: entry.description || "",
      unit: entry.unit || "Piece",
      rateMinor: entry.defaultRateMinor || 0,
      gstRate: entry.defaultTaxRate || 0,
      hsnSac: entry.hsnSac || ""
    });
  }

  async function listCatalogue() {
    var rows = await StorageRepository.getAll("items");
    rows.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    });
    return rows;
  }

  async function saveCatalogueItem(item) {
    if (!item.id) {
      item.id = createId();
      item.createdAt = Date.now();
    }
    item.updatedAt = Date.now();
    item.name = String(item.name || "").trim();
    item.description = String(item.description || "");
    item.unit = String(item.unit || "Piece");
    item.defaultRateMinor = Money.roundPaise(item.defaultRateMinor || 0);
    item.defaultTaxRate = Number(item.defaultTaxRate) || 0;
    item.hsnSac = String(item.hsnSac || "");
    Validation.assertValid(Validation.validateCatalogueItem(item));
    await StorageRepository.put("items", item);
    return item;
  }

  async function deleteCatalogueItem(id) {
    await StorageRepository.remove("items", id);
  }

  global.Items = {
    createId: createId,
    createLine: createLine,
    fromCatalogue: fromCatalogue,
    listCatalogue: listCatalogue,
    saveCatalogueItem: saveCatalogueItem,
    deleteCatalogueItem: deleteCatalogueItem
  };
})(window);
