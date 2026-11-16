# Billing Generator — Implementation Plan

**Related specification:** `requirements.md`  
**Plan version:** 0.2  
**Last updated:** 16 November 2026

## 1. Target

Build a responsive, one-page billing application using HTML5, CSS3, and vanilla JavaScript. It runs entirely in the browser, stores records in IndexedDB, and supports multiple document types, custom numbering, Indian GST, fixed/percentage discounts, PNG export, direct PDF download, and physical printing.

### Confirmed owner decisions

- Multiple document types (exact first-release list still needs confirmation).
- Custom document numbering (exact pattern and sequence policy still need confirmation).
- Indian GST: CGST + SGST / IGST.
- Both fixed-amount and percentage discounts.
- A4 and A5 output.
- Direct PDF download.
- One device/browser profile; no cloud synchronization.
- Business name is not decided yet; it will be entered in the app settings.
- Logo will be provided later; build upload/storage support and use a placeholder meanwhile.

## 2. Architecture

```text
Browser
└── Billing Generator (single-page app)
    ├── HTML: semantic forms and invoice preview
    ├── CSS: responsive UI, invoice layout, print layout
    ├── Vanilla JavaScript
    │   ├── Settings and document types
    │   ├── IndexedDB repository
    │   ├── Numbering engine
    │   ├── Item catalogue
    │   ├── Money and GST calculations
    │   ├── Invoice/document editor
    │   ├── Live preview renderer
    │   ├── PNG exporter (Canvas/SVG)
    │   ├── PDF exporter (local browser library, pending approval)
    │   └── Backup and restore
    └── Browser storage
        ├── IndexedDB: settings, assets, items, documents
        └── LocalStorage: small UI preferences only
```

### Technology rules

- No Node.js, npm, package manager, framework, bundler, backend, API, or remote database.
- Use normal HTML `<script defer>` tags in dependency order.
- No CDN or runtime network dependency. Store any approved PDF library and fonts locally.
- Use IndexedDB for durable app records and image Blobs.
- Treat the document data model as the single source of truth for preview, PNG, PDF, and print.
- Use safe DOM APIs (`textContent`, element creation, and attribute assignment) for user-entered content.

### Direct PDF requirement

Direct PDF download needs a browser-side PDF generator. Recommended approach: locally bundle a pinned jsPDF UMD build, create the PDF from document data, then call its browser download API. This does not require Node.js or a server, but it is one third-party JavaScript dependency. Owner approval is still required. If third-party libraries are prohibited, switch the requirement to browser Print → Save as PDF rather than writing a custom PDF engine.

A locally bundled, appropriately licensed font must support the ₹ symbol. Add Hindi/Urdu glyph support only if those languages are approved for the first release.

## 3. Proposed folder structure

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
│   └── jspdf.umd.min.js        # only after owner approval
├── assets/
│   ├── logo-placeholder.svg
│   └── fonts/
│       └── invoice-font.ttf    # licensed font with ₹ glyph
└── README.md
```

Keep modules small and focused. Do not combine UI event handling, calculations, database calls, and export rendering in one file.

## 4. Implementation phases

### Phase 0 — Confirm decisions

**Tasks**
- Confirm exact initial document types. Proposed: Bill, Cash Memo, Quotation, Receipt, Tax Invoice.
- Confirm custom numbering pattern, prefixes, starting values, padding, sequence scope, and reset policy.
- Confirm discount scope: line-level, invoice-level, or both.
- Confirm GST workflow: supplier state, customer state/place of supply, tax-inclusive/exclusive rates, mixed tax rates, discount treatment, and rounding.
- Approve or reject the locally bundled browser PDF library.
- Confirm default page size, orientation, and whether long PNG exports are one tall image or one image per page.

**Deliverable:** approved decisions or documented defaults for all blocking items.

### Phase 1 — UI foundation

**Tasks**
- Build a responsive one-page HTML shell.
- Create business settings, document editor, item entry, live preview, invoice history, and action areas.
- Implement desktop split layout and mobile stacked layout.
- Add form labels, keyboard focus states, validation messages, and operation feedback.

**Deliverable:** responsive static UI with no persistence yet.

### Phase 2 — IndexedDB and business master

**Tasks**
- Create versioned IndexedDB stores: `settings`, `assets`, `items`, and `invoices`.
- Implement database initialization, CRUD repository methods, transactions, and migrations.
- Build business settings for name, address, mobile, email, GSTIN, supplier state, disclaimer, headings, logo dimensions, and numbering options.
- Implement logo upload, file validation, preview, and Blob persistence.

**Deliverable:** business profile and logo survive refresh and browser restart.

### Phase 3 — Document types and numbering

**Tasks**
- Add the approved document-type selector.
- Configure document titles, visible fields, prefixes, and numbering rules by type.
- Implement custom number tokens such as `{PREFIX}`, `{YYYY}`, `{YY}`, `{MM}`, and `{SEQ}`.
- Reserve sequence values safely and prevent duplicate numbers.
- Save document type and numbering snapshots with records.

**Deliverable:** every approved document type receives a unique formatted document number.

### Phase 4 — Catalogue and calculations

**Tasks**
- Implement dynamic item rows: add, edit, remove, duplicate, and select from catalogue.
- Snapshot catalogue values into the current document.
- Implement monetary helpers using integer paise.
- Implement fixed and percentage discounts according to the approved scope.
- Implement CGST + SGST and IGST calculations according to approved place-of-supply rules.
- Group tax summaries by GST rate where needed.
- Write calculation tests for quantity, rates, discounts, GST components, and rounding.

**Deliverable:** validated billing engine with exact test results. Do not use GST outputs for real tax documents until the owner/accountant confirms the tax rules.

### Phase 5 — Preview and templates

**Tasks**
- Build a dedicated invoice/document preview from the canonical document model.
- Render business header, logo, document title/number/date, customer block, item table, tax summary, totals, and disclaimer.
- Apply document-type-specific fields and layout options.
- Support A4/A5, long descriptions, and multipage content.
- Preserve business and tax snapshots on saved documents.

**Deliverable:** live preview that matches saved document values.

### Phase 6 — PNG, PDF, and physical print

**Tasks**
- Implement Canvas/SVG PNG export at a defined resolution.
- Add the approved locally bundled PDF library.
- Embed a licensed TTF font with ₹ glyph support.
- Generate vector PDF text, tables, totals, and page breaks from document data.
- Add direct PDF download with a safe filename.
- Implement a separate browser print action using print CSS.
- Test A4/A5 and multipage output on supported browsers.

**Deliverable:** clear PNG/PDF files and unclipped physical printouts.

### Phase 7 — History and backup/restore

**Tasks**
- Build history list and search by number, customer, and date.
- Implement open, edit, duplicate, and delete with confirmation.
- Implement versioned JSON backup including settings, catalogue, documents, and logo assets.
- Validate backups before import.
- Support explicit replace/merge choice and transactional import to prevent partial restores.

**Deliverable:** complete local record management and backup recovery.

### Phase 8 — QA and release

**Tasks**
- Test current stable Chrome, Edge, Firefox, and Safari.
- Test phone, tablet, and desktop screen sizes.
- Test refresh, browser restart, storage quota errors, invalid input, and backup recovery.
- Test long invoices, mixed GST rates, A4/A5, PNG, PDF, and physical printing.
- Confirm no remote requests for scripts, fonts, invoices, images, analytics, or customer data.
- Verify offline use once application files are locally available/cached.
- Document limitations of `file://` and recommend static hosting where required.

**Deliverable:** all Must requirements and acceptance tests pass.

## 5. Key engineering rules

1. **One canonical document model:** preview, PNG, PDF, print, and storage must use the same validated data.
2. **Snapshot old documents:** changing business settings, catalogue entries, or numbering configuration must not silently change saved records.
3. **Paise-safe arithmetic:** store INR values in integer paise and define tax/discount rounding once.
4. **Numbering integrity:** reserve sequence values transactionally; never reuse issued numbers by default.
5. **Tax transparency:** show rate, taxable base, and CGST/SGST/IGST components; do not hard-code unverified tax rates.
6. **Safe rendering:** never inject untrusted user content as raw HTML.
7. **Storage resilience:** handle IndexedDB failures and quota errors; provide manual backup and restore.
8. **Output quality:** test table wrapping, page breaks, logos, currency glyphs, and footers in real generated files.
9. **No remote dependencies:** all production scripts, fonts, and assets are local files.
10. **Keep scope focused:** defer analytics, inventory, cloud sync, multi-user access, e-invoicing, and payment integrations.

## 6. Required owner checklist before the corresponding phase

- [ ] Exact document types for the first release.
- [ ] Custom numbering pattern and prefixes.
- [ ] Sequence scope, start value, padding, and reset rule.
- [ ] Supplier state and GSTIN.
- [ ] Customer state/place-of-supply workflow.
- [ ] Tax-inclusive or tax-exclusive rate entry.
- [ ] Discount scope and how discounts affect taxable value.
- [ ] GST rounding and mixed-rate behaviour.
- [ ] Approval for one locally bundled PDF library, or decision to use browser print-to-PDF instead.
- [ ] PDF languages and font requirements.
- [ ] Default page size/orientation and long-PNG behaviour.
- [ ] Final disclaimer/payment footer content (can be entered later in settings).

Business name and logo are **not blockers** for initial development: leave the business name editable and use a replaceable logo placeholder until the owner supplies the final details.

## 7. Release acceptance checklist

- [ ] Responsive one-page UI works on phone, tablet, and desktop.
- [ ] Business settings and logo persist locally.
- [ ] Multiple configured document types can be created.
- [ ] Custom numbering produces unique document numbers.
- [ ] Items can be added, edited, removed, and reused.
- [ ] Fixed and percentage discounts calculate correctly.
- [ ] CGST + SGST and IGST calculations pass approved test cases.
- [ ] Live preview matches document data.
- [ ] Saved documents survive refresh and browser restart.
- [ ] Old documents retain their original business/tax snapshots.
- [ ] A4 and A5 PDF/print output is legible and not clipped.
- [ ] Direct PDF download works without opening the print dialog.
- [ ] PNG export works for normal and long documents.
- [ ] Physical printing works.
- [ ] Backup and restore include all required records and image assets.
- [ ] No backend, Node.js, npm, CDN, remote database, or runtime network dependency is required.

## 8. Important release note

This application stores its data only in the current browser profile. Clearing browser data or losing access to the device can result in permanent loss unless a recent backup exists. The UI must clearly show backup/restore controls and communicate this limitation. GST results are user-configured calculations, not a certification of legal or tax compliance.
