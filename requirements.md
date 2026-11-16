# Billing Generator — Requirements Specification

**Document status:** Draft v0.2 — owner decisions incorporated; remaining decisions listed in the owner checklist  
**Product:** Browser-based Billing Generator  
**Version:** 0.2  
**Last updated:** 16 November 2026

---

## 1. Purpose

Build a simple, responsive, one-page billing application using only **HTML, CSS, and vanilla JavaScript**. The application will allow a user to configure business information, create bills by adding items, preview the invoice, save records in the current browser, and export or print the invoice.

The application is intended for an individual or small business using one browser profile on one device. It will not require a backend, Node.js, a remote database, user accounts, or cloud services.

## 2. Product goals

1. Configure business information once and reuse it for new invoices.
2. Create a bill quickly by entering customer details and adding items.
3. Calculate item amounts, discounts, taxes (when enabled), and totals correctly.
4. Show a live invoice preview while the user edits the bill.
5. Save, reopen, edit, duplicate, and delete locally stored invoices.
6. Download an invoice as a PNG image.
7. Generate and directly download a PDF file, and provide a separate physical-print action.
8. Work offline after the application files have been made available locally or cached by the browser.
9. Provide a backup and restore mechanism because data is stored only in the browser.

## 3. Scope and boundaries

### 3.1 In scope

- Single-page responsive user interface.
- Business master settings.
- Customer and invoice details.
- Dynamic invoice item rows.
- Optional discount and tax configuration.
- Reusable item catalogue.
- Live invoice preview.
- Local invoice history.
- PNG export using browser-native Canvas/SVG capabilities.
- Direct PDF file generation and download using a browser-side JavaScript PDF library bundled locally with the app.
- Print layout and physical printing through the browser print dialog.
- Multiple document types (exact initial list to be confirmed).
- Customizable document-number pattern and sequence rules.
- Indian GST presentation/calculation supporting CGST + SGST or IGST.
- JSON backup and restore.
- Offline use without remote application dependencies.

### 3.2 Out of scope for the initial release

- Backend, API, server-side processing, or remote database.
- User registration, login, or multi-user permissions.
- Cloud backup or cross-device synchronization.
- Online payment collection or payment gateway integration.
- Email, SMS, WhatsApp, or automatic invoice delivery.
- E-invoice, e-way bill, or government portal integration.
- Automatic GST registration, return filing, or government compliance validation. The app will calculate/display user-configured tax values; the owner must verify tax treatment with a qualified tax professional.
- Multi-company accounts (unless approved as a later requirement).
- Sales reports, analytics dashboards, inventory management, and accounting integrations.
- Frameworks, Node.js, npm, bundlers, or build pipelines.

## 4. Technology constraints

| Area | Requirement |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 |
| Application logic | Vanilla JavaScript |
| Runtime | Modern web browser |
| Backend | None |
| Database | No remote database; browser storage only |
| Local persistence | IndexedDB for invoices, item catalogue, business settings, and image assets |
| Small UI preferences | LocalStorage only when useful |
| Image export | Browser-native Canvas and/or SVG APIs |
| Direct PDF download | Browser-side PDF generation; recommended library: jsPDF UMD browser build |
| Physical printing | `window.print()` with print-specific CSS |
| Hosting | Optional static hosting; no application server required |
| Dependencies | No Node.js, npm, package manager, bundler, framework, CDN, or runtime network dependency |
| Approved dependency exception | A pinned browser-compatible PDF library may be stored locally under `vendor/` if the owner approves the dependency |

**Direct PDF decision (owner selection recorded):** The owner selected direct PDF download rather than only opening the browser print dialog. The recommended approach is to bundle a browser/UMD build of jsPDF locally and generate the PDF from structured invoice data. Its browser API supports saving a generated PDF from the client; see the [jsPDF documentation](https://parallax.github.io/jsPDF/docs/jsPDF.html) and [project usage notes](https://github.com/parallax/jsPDF). No Node.js runtime, npm installation, backend, CDN, or build pipeline is required.

**Dependency approval remains open:** jsPDF is a third-party JavaScript library. If “HTML, CSS, and JavaScript only” means absolutely no third-party library, direct PDF generation would require either maintaining a custom PDF writer (not recommended) or changing the requirement back to browser Print → Save as PDF. Confirm this in the checklist.

**PDF font requirement:** The PDF generator must embed a locally bundled, appropriately licensed TrueType font that supports the Indian Rupee symbol (₹). If Hindi or Urdu invoice text is later required, the selected font must support those scripts too. Do not rely on the PDF library's default standard fonts for glyphs they do not contain.

**PDF rendering approach:** Generate PDF content from validated invoice data using PDF text, line, image, and table-layout primitives. Do not rasterize the entire invoice into a screenshot as the primary PDF method; vector text and table lines provide sharper output and more predictable pagination.

**Local-file note:** some browser capabilities, particularly Service Workers and certain storage behaviours, are restricted when opening an HTML file directly with `file://`. The app must remain usable as a static site. IndexedDB and file access must be tested in the target browsers. If direct `file://` behaviour is inconsistent, recommend launching from a simple static host; this still does not introduce a backend.

## 5. Users and primary workflow

### 5.1 Intended user

A single business operator who creates bills/invoices and wants to keep records locally on the same browser and device.

### 5.2 Primary workflow

1. Open the billing application.
2. Configure business master details and invoice layout.
3. Start a new invoice.
4. Enter invoice date and customer details.
5. Add items manually or select saved catalogue items.
6. Enter quantities, rates, discounts, and optional tax values.
7. Review the live invoice preview and calculated totals.
8. Save the invoice.
9. Download the document as PNG or PDF, or send it to a physical printer.
10. Reopen the invoice later from invoice history when required.

## 6. Functional requirements

Priority definitions: **Must** = required for the first usable release; **Should** = strongly recommended; **Could** = optional enhancement.

### 6.1 Business master settings

| ID | Priority | Requirement |
|---|---|---|
| BIZ-01 | Must | Allow the user to configure a business/shop/company name. |
| BIZ-02 | Must | Allow the user to enter a business address. |
| BIZ-03 | Must | Allow the user to enter a business mobile/contact number. |
| BIZ-04 | Should | Allow optional email, website, GSTIN, supplier state, and state code fields. |
| BIZ-05 | Must | Allow the user to upload a business logo. |
| BIZ-06 | Must | Store the logo locally and reuse it in invoice previews and exports. |
| BIZ-07 | Must | Allow the user to configure the default disclaimer/terms text. |
| BIZ-08 | Must | Allow the user to configure invoice title and item-table headings. |
| BIZ-09 | Must | Allow the user to configure custom document-number patterns, prefixes, starting sequence, padding, and reset rules. |
| BIZ-10 | Must | Persist settings in browser storage and reload them on the next visit. |
| BIZ-11 | Must | Provide a way to preview the configured business header. |
| BIZ-12 | Should | Provide controls for logo visibility, size, and alignment. |
| BIZ-13 | Must | Store supplier state/state code for GST calculations when GST is enabled. |

#### Logo handling defaults (proposed)

- Accepted formats: PNG, JPEG, and WebP.
- Maximum file size: 2 MB (configurable).
- Recommended source dimensions: approximately 600 × 240 px, with transparent PNG preferred.
- Default display dimensions: approximately 120 × 48 CSS pixels.
- Preserve aspect ratio; never stretch the logo.
- Use `object-fit: contain` in the HTML preview.
- Store the selected file as a local Blob in IndexedDB, not as a temporary object URL.
- Validate file type and dimensions before saving.

These values are proposed defaults and can be changed during the requirements review.

### 6.2 Invoice and customer details

| ID | Priority | Requirement |
|---|---|---|
| INV-01 | Must | Create a new invoice. |
| INV-02 | Must | Generate a unique invoice identifier/number. |
| INV-03 | Must | Allow invoice date entry; default to the current device date. |
| INV-04 | Must | Capture customer name. |
| INV-05 | Should | Capture customer mobile number and address. |
| INV-06 | Could | Capture customer email, GSTIN, state/state code, place of supply, and reference/notes. |
| INV-07 | Must | Allow the document title and visible fields to be controlled by document type and settings. |
| INV-08 | Must | Save a snapshot of the business details and invoice settings used when the invoice is issued. |
| INV-09 | Must | Changing master settings must not silently alter previously saved invoices. |
| INV-10 | Must | Allow a saved invoice to be reopened and viewed. |
| INV-11 | Must | Allow a saved invoice to be edited with an explicit save action. |
| INV-12 | Should | Allow a saved invoice to be duplicated into a new invoice with a new number. |
| INV-13 | Must | Ask for confirmation before deleting an invoice. |
| INV-14 | Must | Support multiple document types selected by the user when starting a new document. |
| INV-15 | Must | Store the document type and its display title with every saved document. |
| INV-16 | Must | Allow document-type-specific visibility of fields and totals (for example, quotation versus tax invoice). |
| INV-17 | Must | Generate document numbers from a user-configurable pattern rather than hard-coding `INV-0001`. |
| INV-18 | Must | Support configurable prefix, sequence padding, and sequence start value. |
| INV-19 | Should | Support configurable sequence reset rules (never, yearly, or manual) and numbering scope (global or per document type). |
| INV-20 | Must | Prevent duplicate document numbers within the configured numbering scope. |
| INV-21 | Must | Preserve the document type and numbering pattern snapshot on saved records. |

**Proposed initial document types (owner confirmation required):** Bill, Cash Memo, Quotation, Receipt, and Tax Invoice. The exact list is not yet final. Each type may have its own title, prefix, visible fields, and numbering sequence. A quotation-to-invoice conversion workflow is not assumed for the first release unless separately approved.

**Custom numbering proposal:** allow tokens such as `{PREFIX}`, `{YYYY}`, `{YY}`, `{MM}`, and `{SEQ}`. Example pattern: `{PREFIX}/{YYYY}/{SEQ}` with a four-digit sequence. This is a proposal, not a confirmed final format.

### 6.3 Item catalogue and invoice rows

| ID | Priority | Requirement |
|---|---|---|
| ITEM-01 | Must | Allow the user to add an item row to an invoice. |
| ITEM-02 | Must | Allow the user to edit an item row. |
| ITEM-03 | Must | Allow the user to remove an item row. |
| ITEM-04 | Should | Allow the user to duplicate an item row. |
| ITEM-05 | Must | Capture item name/description, quantity, unit, and rate. |
| ITEM-06 | Should | Support an optional item-level discount. |
| ITEM-07 | Should | Support an optional item-level tax rate. |
| ITEM-08 | Must | Calculate each row amount automatically. |
| ITEM-09 | Should | Allow an item to be saved to a reusable local catalogue. |
| ITEM-10 | Should | Allow a catalogue item to be selected for a new invoice. |
| ITEM-11 | Must | Allow the user to edit and delete catalogue entries. |
| ITEM-12 | Must | Preserve item values in an invoice even if the catalogue entry changes later. |

### 6.4 Calculations, discounts, and Indian GST

| ID | Priority | Requirement |
|---|---|---|
| CALC-01 | Must | Calculate each line's gross amount from quantity × unit rate. |
| CALC-02 | Must | Calculate subtotal from invoice item rows. |
| CALC-03 | Must | Support both fixed-amount and percentage discounts. |
| CALC-04 | Should | Support discounts at item level and/or invoice level; exact scope must be confirmed. |
| CALC-05 | Must | Support Indian GST with CGST + SGST for intra-state supplies and IGST for inter-state supplies. |
| CALC-06 | Must | Allow GST to be enabled or disabled for each document/invoice. |
| CALC-07 | Must | Allow the user to configure the GST rate for each applicable item; do not silently assume a rate. |
| CALC-08 | Must | Capture the supplier state and the customer's state/place of supply when GST is enabled. |
| CALC-09 | Must | Select CGST + SGST or IGST based on the configured supply type/place-of-supply decision. |
| CALC-10 | Must | Show tax rate and tax amount clearly, with separate CGST and SGST amounts or an IGST amount as applicable. |
| CALC-11 | Should | Support optional HSN/SAC code per catalogue item or invoice line. |
| CALC-12 | Must | Define whether entered rates are tax-exclusive or tax-inclusive before production use. |
| CALC-13 | Must | Define how discounts affect taxable value and when tax is calculated before production use. |
| CALC-14 | Must | Calculate the final payable total and recalculate immediately after relevant inputs change. |
| CALC-15 | Must | Use integer minor currency units (for INR, paise) or an equivalent decimal-safe calculation approach. |
| CALC-16 | Must | Apply a documented and consistent rounding rule for line values, tax components, and invoice totals. |
| CALC-17 | Should | Display the total amount in words. |
| CALC-18 | Must | Prevent invalid, negative, blank, or non-finite values from corrupting calculations. |
| CALC-19 | Must | Preserve the selected tax and discount settings in the saved invoice snapshot. |

**GST behaviour required by the selected scope:**

- The business profile must include the supplier's state and (where needed) state code.
- When GST is enabled, the invoice must capture the customer's state/place of supply. Customer GSTIN remains optional unless the owner later makes it mandatory for a specific document type.
- The user must be able to set a GST rate per item/line. HSN/SAC is optional unless the owner confirms it is required.
- For an intra-state supply, show CGST and SGST as separate components. For an inter-state supply, show IGST. The owner must confirm how the app determines supply type and handle exceptional place-of-supply cases manually where needed.
- The app must not invent tax rates or claim that a generated document is legally compliant. All tax configuration and results must be reviewable before issue.

**Discount behaviour selected:** both fixed-amount and percentage discount entry are required. It is not yet confirmed whether discounts apply to each line, the whole invoice, or both.

**Tax calculation decisions still required:** tax-inclusive versus tax-exclusive rates; discount allocation/taxable base; tax rate choices; supply-type determination; and rounding method. A recommended working model is tax-exclusive rates, discounts deducted from taxable value before GST, item-level tax rates, and paise precision, but the owner should confirm this model with their accountant/tax adviser before real billing.

### 6.5 Invoice layout and live preview

| ID | Priority | Requirement |
|---|---|---|
| PREV-01 | Must | Show a live invoice preview. |
| PREV-02 | Must | Update the preview when business settings, customer details, items, or totals change. |
| PREV-03 | Must | Display the business logo and configured business information. |
| PREV-04 | Must | Display invoice number and date. |
| PREV-05 | Must | Display customer information selected for the invoice. |
| PREV-06 | Must | Display item rows and configured table headings. |
| PREV-07 | Must | Display applicable subtotal, discounts, taxes, and final total. |
| PREV-08 | Must | Display the configured disclaimer/terms when enabled. |
| PREV-09 | Should | Allow optional payment information such as UPI ID or bank details. |
| PREV-10 | Should | Allow fields/columns to be shown or hidden. |
| PREV-11 | Must | Keep editor controls and application navigation out of the exported/printed invoice. |
| PREV-12 | Must | Handle long invoices and page breaks without clipping or losing rows. |

### 6.6 Save and invoice history

| ID | Priority | Requirement |
|---|---|---|
| SAVE-01 | Must | Save invoices in IndexedDB. |
| SAVE-02 | Must | Store invoice number, date, customer, totals, line items, and a business/settings snapshot. |
| SAVE-03 | Must | Show a list of saved invoices. |
| SAVE-04 | Must | Allow a saved invoice to be opened. |
| SAVE-05 | Must | Allow a saved invoice to be updated explicitly. |
| SAVE-06 | Should | Allow an invoice to be duplicated. |
| SAVE-07 | Must | Allow invoice deletion after confirmation. |
| SAVE-08 | Should | Provide search/filter by invoice number, customer, or date. |
| SAVE-09 | Must | Handle IndexedDB errors and storage quota failures with a clear user message. |

### 6.7 Export, PDF, and printing

| ID | Priority | Requirement |
|---|---|---|
| OUT-01 | Must | Export the invoice as a downloadable PNG image. |
| OUT-02 | Must | Generate a PDF file directly in the browser and download it without requiring the user to open the print dialog. |
| OUT-03 | Must | Provide a separate physical-print action using the browser print dialog. |
| OUT-04 | Must | Keep editor controls, navigation, and action buttons out of exported/printed documents. |
| OUT-05 | Must | Support A4 and A5 paper sizes. |
| OUT-06 | Must | Keep logos, text, totals, and table borders legible in exported output. |
| OUT-07 | Must | Support multi-page documents without clipping rows, totals, or disclaimers. |
| OUT-08 | Must | Use the same invoice/document data for preview, PNG, PDF, and print output. |
| OUT-09 | Must | Use browser-native Canvas/SVG for PNG export. |
| OUT-10 | Must | Generate PDF from structured invoice data using a local browser-compatible PDF library, subject to owner approval of that one dependency. |
| OUT-11 | Must | Use a locally bundled font that contains the required currency and language glyphs. |
| OUT-12 | Should | Allow the user to choose output paper size (A4 or A5) before export/print. |
| OUT-13 | Must | Use a meaningful default filename containing document type/number/date, without unsafe filename characters. |

**PDF approach:** use a local browser/UMD build of jsPDF and its client-side `save()` capability. Construct headings, business/customer blocks, item rows, tax summaries, totals, and footers from invoice data. Implement page-break and row-height management explicitly. Do not require Node.js, npm, a CDN, a remote API, or a server.

**PNG approach:** use a dedicated Canvas/SVG export renderer rather than capturing the whole application screen. Test logo conversion, long text, Indian Rupee glyph rendering, and tall invoices. For a long invoice, the owner must choose whether PNG output is one tall image or one image per page.

**Print approach:** retain a browser print action with print-specific CSS as a separate feature. It is not the primary PDF download path.

### 6.8 Backup and restore

| ID | Priority | Requirement |
|---|---|---|
| BACK-01 | Must | Export all application data to a downloadable JSON backup. |
| BACK-02 | Must | Include business settings, item catalogue, invoices, and required image assets in the backup format. |
| BACK-03 | Must | Import a previously exported backup. |
| BACK-04 | Must | Validate the backup structure and version before importing. |
| BACK-05 | Must | Ask for confirmation before replacing or merging existing data. |
| BACK-06 | Must | Avoid partial imports; validate the backup before committing changes. |
| BACK-07 | Should | Include a backup date, application version, and schema version in the backup. |
| BACK-08 | Must | Clearly explain that data is device/browser-specific and that the user is responsible for maintaining backups. |

### 6.9 Responsive UI and accessibility

| ID | Priority | Requirement |
|---|---|---|
| UI-01 | Must | Provide a simple one-page interface. |
| UI-02 | Must | Support desktop, tablet, and mobile screen sizes. |
| UI-03 | Must | Use a two-column editor/preview layout on suitable wide screens. |
| UI-04 | Must | Use a single-column or clearly stacked layout on narrow screens. |
| UI-05 | Must | Keep important actions easy to reach on mobile. |
| UI-06 | Must | Use readable labels, sensible spacing, and clear validation messages. |
| UI-07 | Should | Support keyboard navigation and visible focus states. |
| UI-08 | Should | Use semantic HTML and accessible form labels. |
| UI-09 | Must | Avoid unnecessary animation and external assets. |

## 7. Proposed screen structure

The application remains one page. Sections may be collapsible, tab-like, or shown in a simple navigation panel, but should not require separate routes.

1. **Header:** application title, business settings, saved invoices, backup/restore.
2. **Business settings:** business identity, logo, contact details, invoice headings, disclaimer, tax/currency and print options.
3. **Invoice editor:** invoice number/date, customer information, item rows, discounts, tax and notes.
4. **Live preview:** printable invoice representation.
5. **Action area:** Save, New Invoice, Download PNG, Print / Save PDF.
6. **Invoice history:** saved invoice list with open, edit, duplicate, and delete actions.

On desktop, editor and preview should appear side by side when space permits. On mobile, the editor and preview should stack, with export/print actions remaining easy to access.

## 8. Data model proposal

The following is an initial data shape, not a final database schema. IDs should be generated uniquely, and records should include a schema/version field where appropriate.

### 8.1 Business settings

```js
{
  id: "default",
  businessName: "",
  address: "",
  mobile: "",
  email: "",
  website: "",
  gstin: "",
  logoAssetId: null,
  documentTypes: ["bill", "cash-memo", "quotation", "receipt", "tax-invoice"],
  numbering: {
    pattern: "{PREFIX}/{YYYY}/{SEQ}",
    prefixByType: {
      bill: "BILL",
      cashMemo: "CM",
      quotation: "QT",
      receipt: "REC",
      taxInvoice: "INV"
    },
    sequencePadding: 4,
    sequenceStart: 1,
    sequenceScope: "per-type",
    resetRule: "never",
    nextSequenceByType: {}
  },
  invoiceTitle: "INVOICE",
  disclaimer: "",
  supplierState: "",
  supplierStateCode: "",
  currencyCode: "INR",
  currencySymbol: "₹",
  dateFormat: "DD-MM-YYYY",
  headings: {
    item: "Description",
    quantity: "Qty",
    unit: "Unit",
    rate: "Rate",
    discount: "Discount",
    tax: "Tax",
    amount: "Amount",
    subtotal: "Subtotal",
    grandTotal: "Grand Total"
  },
  logoWidth: 120,
  logoHeight: 48,
  logoAlignment: "left",
  updatedAt: 0
}
```

### 8.2 Catalogue item

```js
{
  id: "item-id",
  name: "",
  description: "",
  unit: "Piece",
  defaultRateMinor: 0,
  defaultTaxRate: 0,
  createdAt: 0,
  updatedAt: 0
}
```

### 8.3 Invoice

```js
{
  id: "invoice-id",
  schemaVersion: 1,
  documentType: "tax-invoice",
  documentNumber: "CUSTOM-FORMAT-0001",
  numberingSnapshot: { pattern: "{PREFIX}/{YYYY}/{SEQ}", sequenceValue: 1 },
  invoiceDate: "YYYY-MM-DD",
  customer: {
    name: "",
    mobile: "",
    address: "",
    email: "",
    gstin: "",
    state: "",
    stateCode: ""
  },
  gst: {
    enabled: false,
    supplyType: "intra-state",
    rateMode: "exclusive",
    placeOfSupply: "",
    discountTaxTreatment: "pending-owner-confirmation"
  },
  discount: { type: "none", value: 0 },
  items: [
    {
      id: "line-id",
      catalogueItemId: null,
      name: "",
      description: "",
      quantity: 1,
      unit: "Piece",
      rateMinor: 0,
      discountType: "none",
      discountValue: 0,
      hsnSac: "",
      gstRate: 0,
      cgstMinor: 0,
      sgstMinor: 0,
      igstMinor: 0,
      taxableValueMinor: 0,
      lineTotalMinor: 0
    }
  ],
  currencyCode: "INR",
  subtotalMinor: 0,
  discountMinor: 0,
  taxableValueMinor: 0,
  cgstMinor: 0,
  sgstMinor: 0,
  igstMinor: 0,
  taxMinor: 0,
  grandTotalMinor: 0,
  businessSnapshot: {},
  createdAt: 0,
  updatedAt: 0
}
```

For INR, `Minor` amounts represent paise. Store calculated values consistently and preferably recompute totals from validated line-item inputs when loading or exporting an invoice.

### 8.4 IndexedDB stores

| Store | Key | Purpose |
|---|---|---|
| `settings` | `id` | Business profile and app preferences |
| `items` | `id` | Reusable product/service catalogue |
| `invoices` | `id` | Saved invoices, bills, quotations, receipts, and other approved document records |
| `assets` | `id` | Logo and other locally stored image Blobs |

Add indexes for invoice number, invoice date, customer name, and item name where useful.

## 9. Non-functional requirements

### 9.1 Reliability and data integrity

- A page refresh must not remove successfully saved records.
- Database writes must be handled transactionally where possible.
- Show success/failure feedback for save, import, export, and delete actions.
- Prevent accidental invoice-number collisions.
- Do not change saved invoices merely because master settings changed.
- Validate imported data before making it active.

### 9.2 Privacy and security

- Application data must remain in the current browser's local storage/database.
- Do not send invoice, customer, business, or logo data to external services.
- Do not load remote fonts, scripts, analytics, or tracking resources.
- Treat all user-entered text as untrusted input.
- Use safe DOM APIs such as `textContent` instead of inserting untrusted values through `innerHTML`.
- Validate uploaded images by actual file content where feasible, and enforce size limits.
- Do not claim that local browser storage is encrypted or a secure backup.

### 9.3 Performance

- Initial interface should load quickly on typical modern phones and computers.
- Avoid unnecessary libraries and large assets.
- Recalculate only the affected totals when practical.
- Avoid losing input focus or cursor position during live preview updates.
- Handle invoices with many rows without freezing the interface.

### 9.4 Browser support

Target current stable versions of:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Apple Safari (macOS and iOS)

The final supported browser/version matrix must be verified during testing. Browser storage availability, file downloads, SVG/Canvas export, and print behaviour may vary.

## 10. Error handling and user feedback

The application must provide clear messages for at least these cases:

- Required business details are missing.
- Logo type or file size is unsupported.
- An item has an invalid quantity, rate, discount, or tax value.
- An invoice cannot be saved because browser storage is unavailable or full.
- An invoice number already exists.
- Backup file is invalid, unsupported, or from a newer schema version.
- Backup import would replace existing information.
- PNG or direct PDF export is unsupported or fails.
- Physical-print dialog was opened; the user must complete or cancel the print operation.
- Direct PDF generation failed because the PDF library/font asset could not load or the document could not be generated.

Never show a success message until the corresponding operation has actually succeeded.

## 11. Acceptance criteria

The initial release is accepted when all Must requirements pass and the following end-to-end scenarios succeed:

### AC-01: Business profile persistence

- Enter business name, address, mobile, disclaimer, and custom table headings.
- Upload a valid logo.
- Save settings and refresh the page.
- Confirm all settings and the logo are restored correctly.

### AC-02: Create and calculate invoice

- Create a new invoice and enter customer details.
- Add at least three items with different quantities and rates.
- Confirm line amounts, subtotal, optional discount, tax, and grand total are correct.
- Edit and remove an item and confirm totals update immediately.

### AC-03: Live preview

- Change customer details, item values, and business headings.
- Confirm the preview updates and matches the underlying invoice values.
- Confirm editor buttons and settings controls do not appear in the invoice preview export.

### AC-04: Save and reopen

- Save an invoice, refresh the page, and reopen it.
- Confirm the customer, line items, totals, logo, and business snapshot are unchanged.
- Change master settings and confirm the older invoice remains unchanged.

### AC-05: PNG export

- Export a normal invoice and a long invoice.
- Confirm the PNG opens, has readable text, includes the logo, and does not crop required content.

### AC-06: PDF/print

- Print an invoice using A4 paper.
- Confirm the print output contains only the invoice.
- Confirm no table rows, totals, disclaimer, or logo are clipped.
- Confirm the direct PDF download produces a valid multi-page PDF without opening the print dialog.
- Confirm the separate physical-print action opens the browser print dialog.

### AC-07: Backup and restore

- Export a backup containing settings, assets, items, and invoices.
- Clear test data or use a clean browser profile.
- Import the backup.
- Confirm all restored records and the logo are available.
- Try an invalid backup and confirm no existing data is partially overwritten.

### AC-08: Responsive and offline use

- Test at phone, tablet, and desktop widths.
- Confirm the UI remains usable without unwanted horizontal page scrolling.
- Disconnect the network after the static app has been loaded/cached as applicable.
- Confirm core billing functions still work without external requests.

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| User clears browser data | All local records may be lost | Prominent backup/export reminders and restore flow |
| Device/browser unavailable | Records are not automatically available elsewhere | Explain single-device scope; encourage regular backups |
| Storage quota exceeded | New data or logo may fail to save | Handle quota errors and show actionable guidance |
| Browser export differences | PNG/PDF output may differ between browsers | Define supported browsers and test exports in each |
| Long invoice pagination | Rows or totals may be clipped | Test long invoices and apply print page-break rules |
| Tax rules differ by business | Incorrect tax display/calculation | Make tax optional/configurable; confirm required tax rules with owner |
| Invoice number collision | Duplicate invoice identifiers | Generate and reserve sequence numbers transactionally |
| Native-only PNG rendering limitations | Export may not match preview | Use a dedicated Canvas/SVG renderer and test before release |
| PDF library/font dependency | Direct PDF download needs browser-side PDF code and suitable fonts | Bundle approved, pinned files locally; document licence and test Unicode glyphs |

## 13. Implementation plan

The project should be implemented in small, testable vertical slices. The sequence below minimizes rework: confirm document/tax rules before coding those calculations, then build persistence, the billing engine, and output paths around one canonical document model.

### 13.1 Phase 0 — Requirements sign-off

**Tasks**
- Confirm the exact document types for the first release.
- Confirm the custom numbering pattern, sequence scope, reset rule, and starting number.
- Confirm supplier state and the GST place-of-supply workflow.
- Confirm tax-inclusive/exclusive rates, discount/tax order, and rounding rules.
- Confirm whether discounts are available per item, per invoice, or both.
- Approve the locally bundled PDF library exception or change PDF output to browser print-to-PDF.
- Confirm the A4/A5 default, orientation, and long-PNG behaviour.

**Exit criteria:** the blocking checklist items are decided or explicitly accepted as implementation defaults. Do not release tax calculations for real billing until GST treatment is reviewed by the owner/accountant.

### 13.2 Phase 1 — Static foundation and responsive UI

**Tasks**
- Create the one-page HTML shell and semantic form structure.
- Build responsive desktop editor/preview and mobile stacked layouts.
- Add business-settings, document-editor, item-table, preview, and history regions.
- Add accessible labels, validation placeholders, status messages, and action buttons.
- Add a dedicated invoice-preview surface isolated from editor controls.

**Exit criteria:** the application shell works at phone, tablet, and desktop widths; no billing data is lost because persistence is not yet enabled.

### 13.3 Phase 2 — Storage layer and business master

**Tasks**
- Create a versioned IndexedDB database and stores: `settings`, `items`, `invoices`, and `assets`.
- Implement a storage repository with create/read/update/delete operations and transaction handling.
- Implement business settings form and validation.
- Upload, validate, preview, and persist the logo as a Blob.
- Persist document-type definitions, numbering rules, headings, disclaimers, supplier state, and output preferences.
- Add database upgrade/migration handling from the beginning.

**Exit criteria:** business settings and logo survive refresh and reopen; storage failures produce clear messages.

### 13.4 Phase 3 — Document types and numbering engine

**Tasks**
- Implement the approved document-type list and type-specific labels/fields.
- Implement the configurable numbering token parser.
- Reserve the next sequence value safely before saving a new document.
- Prevent duplicate numbers within the selected numbering scope.
- Handle abandoned drafts without reusing an already issued number unless the owner explicitly chooses that policy.
- Save the document type and numbering-rule snapshot with each record.

**Exit criteria:** each approved document type creates a correctly formatted unique number; refresh/repeated clicks do not create duplicate numbers.

### 13.5 Phase 4 — Item catalogue and billing calculations

**Tasks**
- Build dynamic item rows with add, edit, remove, duplicate, and catalogue selection.
- Implement item catalogue CRUD and snapshot selected item values into each document.
- Implement decimal-safe monetary helpers using integer paise.
- Implement fixed and percentage discount handling according to the approved scope.
- Implement GST calculations for CGST + SGST and IGST based on the approved place-of-supply rules.
- Implement tax summaries grouped by GST rate where required.
- Add deterministic unit tests for line amounts, discounts, tax components, and rounding.

**Exit criteria:** known test cases produce exact expected paise-level totals; tax calculations are approved before being used for actual tax invoices.

### 13.6 Phase 5 — Live preview and invoice layouts

**Tasks**
- Create reusable rendering for business header, customer block, document metadata, item table, tax summary, totals, and footer.
- Apply the approved type-specific titles and field visibility.
- Support A4 and A5 layout measurements.
- Handle long descriptions, large item counts, and multi-page content.
- Store a business/settings snapshot in each saved document so older records remain unchanged.

**Exit criteria:** preview updates from the canonical document model and remains consistent with calculated values.

### 13.7 Phase 6 — PNG, direct PDF, and physical print

**Tasks**
- Implement PNG export using Canvas/SVG at a defined output resolution.
- Add the locally bundled, pinned jsPDF browser build under `vendor/` after owner approval.
- Bundle a licensed TTF font with ₹ glyph support and test embedding.
- Implement PDF drawing from structured invoice data, including table row wrapping and page-break handling.
- Add direct PDF download with a safe filename.
- Keep a separate physical print action with print-specific CSS.
- Verify A4/A5 and multi-page output on supported browsers.

**Exit criteria:** PNG and PDF are legible, match the document data, and do not clip rows, tax summaries, totals, or disclaimers. Direct PDF download does not open the print dialog.

### 13.8 Phase 7 — Invoice history and backup/restore

**Tasks**
- Implement invoice list, search, open, edit, duplicate, and delete.
- Ensure edits require an explicit save action.
- Implement a versioned JSON backup that includes settings, catalogue, invoices, and image assets (encoded safely).
- Validate all backup records before import.
- Offer explicit replace/merge behaviour and use a transaction to avoid partial imports.

**Exit criteria:** backup from one browser profile can be restored into a clean profile, including logo assets and invoice snapshots.

### 13.9 Phase 8 — QA, offline verification, and release

**Tasks**
- Test current stable Chrome, Edge, Firefox, and Safari versions.
- Test small/large screens, A4/A5, long invoices, missing optional fields, and unusual text.
- Test IndexedDB failures, storage quota failures, refresh, and browser restart.
- Test JSON backup integrity and invalid-file rejection.
- Test offline operation after the app files are locally available or cached.
- Confirm there are no external network requests for scripts, fonts, images, analytics, or invoice data.
- Document the browser-specific limitations of opening from `file://` versus a static origin.

**Exit criteria:** all Must requirements and acceptance criteria pass; no known data-loss or calculation defect remains open.

### 13.10 Suggested project structure

```text
billing-generator/
├── index.html
├── css/
│   ├── styles.css
│   ├── responsive.css
│   └── print.css
├── js/
│   ├── app.js
│   ├── db.js
│   ├── storage-repository.js
│   ├── settings.js
│   ├── document-types.js
│   ├── numbering.js
│   ├── customers.js
│   ├── items.js
│   ├── money.js
│   ├── gst.js
│   ├── calculations.js
│   ├── document-editor.js
│   ├── preview.js
│   ├── export-png.js
│   ├── export-pdf.js
│   ├── print.js
│   └── backup-restore.js
├── vendor/
│   └── jspdf.umd.min.js       # only if owner approves the PDF library
├── assets/
│   ├── logo-placeholder.svg
│   └── fonts/
│       └── invoice-font.ttf   # licensed font with ₹ glyph support
└── README.md
```

Use ordinary `<script defer>` tags in dependency order. Do not introduce ES module build steps, npm scripts, a package manager, or a Node.js server. The vendored PDF file is a browser runtime asset, not a build tool.

### 13.11 Development order and implementation gates

| Gate | Must be complete before proceeding |
|---|---|
| Gate A | Document types, numbering, GST/discount rules, and PDF dependency decision |
| Gate B | Responsive shell and IndexedDB repository |
| Gate C | Business settings, logo asset handling, and snapshots |
| Gate D | Document numbering and item catalogue |
| Gate E | Calculation tests, including GST and discounts |
| Gate F | Live preview and A4/A5 layout |
| Gate G | PNG, PDF download, and physical print |
| Gate H | Invoice history, backup/restore, offline and cross-browser QA |

Do not begin polished PDF layout before the document model and totals are stable; otherwise the PDF renderer will need repeated rewrites.

## 14. Owner decisions — confirmation checklist

### 14.1 Already confirmed by the owner

These selections are recorded and should not be asked again unless the owner changes them.

- [x] **Document types:** Multiple types. The exact first-release list remains to be finalized.
- [x] **Numbering:** Custom format. The actual pattern/tokens and sequence policy remain to be finalized.
- [x] **Tax:** Indian GST with CGST + SGST / IGST support. Detailed tax rules remain to be finalized.
- [x] **Discount modes:** Both fixed-amount and percentage discounts. Discount scope (line, invoice, or both) remains to be finalized.
- [x] **Paper sizes:** A4 and A5.
- [x] **PDF:** Direct PDF download is required; do not rely only on Print → Save as PDF.
- [x] **Device scope:** One device/browser profile; no cloud synchronization.
- [x] **Business name:** Not decided yet; keep editable in master settings and do not hard-code a name.
- [x] **Logo:** The owner will provide it later; implement a placeholder and logo upload/storage now.

### 14.2 Remaining checklist — required before final implementation choices

**A. Business and GST identity**

- [ ] Business name to display (may be entered later in the app).
- [ ] Business address, mobile, and optional email.
- [ ] Supplier state and GSTIN (GSTIN may remain configurable/optional until entered).
- [ ] Customer state/place-of-supply input method.
- [ ] Whether customer GSTIN, HSN/SAC, and state code must appear on tax invoices.
- [ ] Whether payment UPI ID, bank details, or QR code should appear.

**B. Document types**

- [ ] Confirm the exact first-release document types. Proposed list: Bill, Cash Memo, Quotation, Receipt, Tax Invoice.
- [ ] Should each type have a separate title, prefix, and sequence? (Recommended: yes.)
- [ ] Should quotation conversion to invoice be included in the first release? (Recommended: later version.)
- [ ] Should a receipt be a standalone document or be linked to a previous invoice/payment?

**C. Custom numbering**

- [ ] Confirm numbering pattern. Proposed example: `{PREFIX}/{YYYY}/{SEQ}`.
- [ ] Confirm sequence start and number padding (proposed: 1 and four digits).
- [ ] Sequence scope: one shared sequence or a separate sequence per document type? (Recommended: per type.)
- [ ] Reset policy: never, yearly, or manual? (Recommended: never unless business/accounting needs a yearly reset.)
- [ ] Can an issued number ever be reused after a document is deleted/voided? (Recommended: no.)

**D. Discounts and GST calculation**

- [ ] Discount scope: item-level, invoice-level, or both?
- [ ] Is percentage discount applied to the line/invoice value before GST?
- [ ] Are item rates tax-exclusive (GST added on top) or tax-inclusive (GST already included)? (Recommended: tax-exclusive.)
- [ ] Which GST rates should be selectable? Rates must be configured/verified by the owner; do not hard-code assumptions.
- [ ] Determine intra-state versus inter-state using supplier state and place of supply, or require the user to select supply type manually?
- [ ] For intra-state supplies, confirm equal split of the configured GST rate between CGST and SGST where applicable.
- [ ] Rounding rule: per line/component or on final invoice total? (Recommended: calculate in paise and round tax components consistently.)
- [ ] Should mixed GST rates across items be supported? (Recommended: yes.)
- [ ] Should cess or other charges be supported? (Not included unless requested.)

**E. PDF library and fonts**

- [ ] Approve one locally bundled browser-side PDF library (recommended: jsPDF UMD) to enable direct PDF downloads. No Node.js, npm, CDN, backend, or build step will be used.
- [ ] If third-party PDF libraries are not acceptable, confirm fallback to browser Print → Save as PDF or explicitly approve a custom PDF writer (not recommended).
- [ ] PDF font language: English only initially, or also Hindi/Urdu? (₹ support is required in all cases.)

**F. Layout and export**

- [ ] Default paper size: A4 or A5? (Recommended: A4.)
- [ ] Orientation: portrait only or portrait + landscape? (Recommended: portrait initially.)
- [ ] Logo alignment: left, center, or right? (Recommended: left.)
- [ ] Long invoice PNG: one tall image or one PNG per page?
- [ ] Need amount in words, signature, stamp, payment instructions, or thank-you footer?
- [ ] Provide exact disclaimer/terms later, or use an editable placeholder? (Recommended: editable placeholder.)

**G. Storage, usage, and release**

- [ ] Confirm manual backup only or periodic in-app backup reminder. (Recommended: manual backup plus a visible last-backup date.)
- [ ] Backup import: replace, merge, or let the user choose? (Recommended: let the user choose after validation.)
- [ ] Run directly from a folder (`file://`), use static hosting, or support both? (Recommended: static hosting plus local-file best effort.)
- [ ] Language: English initially, or English + Hindi/Urdu? (Recommended: English initially.)
- [ ] Application display name: retain “Billing Generator” or choose a custom name?

### 14.3 Suggested defaults to avoid blocking development

| Decision | Recommended default if owner does not specify |
|---|---|
| Document types | Bill, Cash Memo, Quotation, Receipt, Tax Invoice |
| Type-specific numbering | Separate sequence and prefix per document type |
| Number pattern | `{PREFIX}/{YYYY}/{SEQ}` |
| Sequence padding | Four digits; start at 1 |
| Sequence reset | Never reset automatically |
| Discount modes | Fixed amount and percentage |
| Discount scope | Item-level and invoice-level, controlled explicitly |
| GST mode | GST optional per document; mixed item rates supported |
| GST split | CGST + SGST for intra-state; IGST for inter-state |
| Tax rate entry | User-configurable per item; no assumed tax rate |
| Tax rates | Tax-exclusive |
| Discount/tax order | Discount reduces taxable value before GST, subject to accountant confirmation |
| Monetary precision | Integer paise internally; display two decimals |
| Rounding | Consistent paise rounding per tax component and invoice |
| Paper | A4 default; A5 selectable; portrait initially |
| Logo | Placeholder until owner provides image; upload and store locally |
| PDF | Direct download via locally bundled jsPDF UMD, if approved |
| PNG | Browser Canvas/SVG export |
| Physical print | Browser print dialog with print CSS |
| Storage | IndexedDB; one device/browser |
| Backup | Manual JSON export/import, include logo assets |
| Language | English initially |
| Hosting | Static files only; no backend |

These are recommendations, not additional owner-confirmed decisions. GST calculation defaults must be checked before real tax documents are issued.

## 15. Definition of done

- [ ] Business profile can be configured and persists after refresh.
- [ ] Logo can be uploaded later, stored locally, resized without distortion, and printed/exported.
- [ ] Multiple approved document types can be created.
- [ ] Custom numbering format and sequence rules work without duplicate numbers.
- [ ] Customer details and item rows can be entered and edited.
- [ ] Both fixed and percentage discounts work according to approved scope.
- [ ] GST supports CGST + SGST and IGST according to approved rules.
- [ ] Calculations pass paise-level test cases.
- [ ] Live preview matches the saved document data.
- [ ] A4 and A5 layouts render correctly.
- [ ] Direct PDF download works without opening the print dialog.
- [ ] PNG export works and preserves required content.
- [ ] Physical printing works.
- [ ] Invoices survive refresh and browser restart.
- [ ] Saved invoices preserve business and tax snapshots.
- [ ] Invoice history supports open/edit/duplicate/delete as scoped.
- [ ] Backup and restore include settings, catalogue, invoices, and logo assets.
- [ ] The app does not send business or customer data to remote services.
- [ ] Core features work without an internet connection once the app files are locally available/cached.
- [ ] No Node.js, npm, backend, remote database, CDN, or build pipeline is required.

## 16. Sign-off

**Owner approval:** ______________________________  
**Date:** ______________________________  
**Approved requirements version:** ______________________________

---

## 17. Technical references

- [jsPDF API documentation](https://parallax.github.io/jsPDF/docs/jsPDF.html) — browser PDF API, including direct document save.
- [jsPDF GitHub project](https://github.com/parallax/jsPDF) — browser UMD distribution and usage information.

The implementation must pin and locally store the selected browser build and review its licence before release. No live CDN link should be used in the production app.
