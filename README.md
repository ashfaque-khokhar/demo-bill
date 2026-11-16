# Billing Generator

Browser-based billing app (HTML, CSS, vanilla JavaScript). No backend, Node.js, npm, or CDN at runtime.

## Open the app

Prefer a local static server (IndexedDB / PDF font loading is more reliable than `file://`):

```bash
cd "/path/to/demo bill"
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Features

- Business settings + logo (IndexedDB)
- Document types: Bill, Cash Memo, Quotation, Receipt, Tax Invoice
- Custom numbering `{PREFIX}/{YYYY}/{SEQ}` (per type)
- Item catalogue, line + invoice discounts
- Indian GST: CGST+SGST / IGST (tax-exclusive; discount before tax)
- Live preview, PNG, direct PDF (local jsPDF + Noto Sans), print
- History (open / duplicate / delete) and JSON backup/restore

## Defaults used (owner checklist)

See `requirements.md` §14.3. GST output is configurable calculation only — verify with your accountant before real tax invoices.

## Data warning

All records live in this browser profile. Use **Backup** regularly.
