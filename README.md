# Billing Generator

https://ashfaque-khokhar.github.io/demo-bill/index.html

Browser-based billing app (HTML, CSS, vanilla JavaScript). No backend, Node.js, npm, or CDN at runtime.

## Open the app

Prefer a local static server (IndexedDB / PDF font loading is more reliable than `file://`):

```bash
cd "/path/to/demo bill"
python3 -m http.server 8080
```

Then open `http://localhost:8080` (Editor).

Service workers and install prompts require **HTTPS** in production (localhost is fine for development). Opening pages via `file://` does not register the PWA.

## Installable PWA (offline)

After one **online** visit while the service worker installs, the app shell (HTML, CSS, JS, icons, and bundled font) is cached. Invoices and settings stay in **IndexedDB** on the device — no server.

1. Serve the app over `http://localhost` or HTTPS.
2. Open the Editor once and wait for the service worker to activate (DevTools → Application → Service workers).
3. Install from the browser menu (e.g. Chrome **Install app**, or **Add to Home Screen** on mobile).
4. Turn on **Offline** in DevTools and confirm Editor, Settings, History, and Backup still load.

**Updates:** when you change static files, bump `CACHE_VERSION` in `sw.js` and add any new script paths to `PRECACHE_URLS` in the same file.

**Limits:** clearing site data removes both the cache and IndexedDB. Use **Backup** before clearing storage or uninstalling; iOS may evict unused installed apps over time.

Place the PDF font at `assets/fonts/NotoSans-Regular.ttf` (see `js/export-pdf.js`); offline PDF export needs that file present at install time.

## Pages

| Page | File | Purpose |
|------|------|---------|
| Editor | `index.html` | Create / edit invoices, preview, export |
| Settings | `settings.html` | Business details, logo, numbering |
| History | `history.html` | Open, duplicate, or delete saved documents |
| Backup | `backup.html` | JSON backup download / import |

Shared chrome and navigation live in each page; page logic is in `js/ui-common.js` plus `js/page-*.js`. Domain modules (`db`, GST, export, etc.) are unchanged.

## Features

- Business settings + logo (IndexedDB)
- Document types: Bill, Cash Memo, Quotation, Receipt, Tax Invoice
- Custom numbering `{PREFIX}/{YYYY}/{SEQ}` (per type)
- Line + invoice discounts
- Indian GST: CGST+SGST / IGST (tax-exclusive; discount before tax)
- Live preview, PNG, direct PDF (local jsPDF + Noto Sans), print
- Installable PWA with offline app shell (`manifest.webmanifest`, `sw.js`)
- History (open / duplicate / delete) and JSON backup/restore

## Defaults used (owner checklist)

See `requirements.md` §14.3. GST output is configurable calculation only — verify with your accountant before real tax invoices.

## Data warning

All records live in this browser profile. Use **Backup** regularly.
