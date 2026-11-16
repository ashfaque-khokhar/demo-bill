(function (global) {
  "use strict";

  function emptyCustomer() {
    return {
      name: "",
      mobile: "",
      address: "",
      email: "",
      gstin: "",
      state: "",
      stateCode: ""
    };
  }

  function readFromForm(ids) {
    return {
      name: document.getElementById(ids.name).value.trim(),
      mobile: document.getElementById(ids.mobile).value.trim(),
      address: document.getElementById(ids.address).value.trim(),
      email: document.getElementById(ids.email).value.trim(),
      gstin: document.getElementById(ids.gstin).value.trim(),
      state: document.getElementById(ids.state).value.trim(),
      stateCode: document.getElementById(ids.stateCode).value.trim()
    };
  }

  function writeToForm(customer, ids) {
    document.getElementById(ids.name).value = customer.name || "";
    document.getElementById(ids.mobile).value = customer.mobile || "";
    document.getElementById(ids.address).value = customer.address || "";
    document.getElementById(ids.email).value = customer.email || "";
    document.getElementById(ids.gstin).value = customer.gstin || "";
    document.getElementById(ids.state).value = customer.state || "";
    document.getElementById(ids.stateCode).value = customer.stateCode || "";
  }

  global.Customers = {
    emptyCustomer: emptyCustomer,
    readFromForm: readFromForm,
    writeToForm: writeToForm
  };
})(window);
