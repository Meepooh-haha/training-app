# ระบบจัดการการฝึกอบรม — Training Management

Full-stack internal HR training management app.

**Stack:** React + Vite + TailwindCSS (frontend) · Express (backend) · SQLite via better-sqlite3 · jsPDF + xlsx for client-side exports · recharts for the dashboard.

## Quick start

```bash
cd training-app
npm install     # installs root + server + client deps
npm run dev     # starts API (:3001) and client (:5173) together
```

Then open http://localhost:5173

- The SQLite database (`server/db/training.db`) is created automatically on first run.
- 5 demo records are seeded per master table, plus sample training requests and one evaluation.
- No login — single-user internal app.

## Modules

| Route | Module | What it does |
|-------|--------|--------------|
| `/` | Dashboard | KPIs, trainings-per-month, budget planned vs approved, avg score gauge, recent requests |
| `/setup` | Master data | Tabs: Training Topics · Courses (with topic & relation sub-tabs) · Evaluation Items · Evaluation Forms |
| `/requests` | Training Request | Full proposal form + attendees/schedule grids. Exports: **Training Proposal**, **PR Form**, **Memo** (PDF) |
| `/registration` | Registration | Check-in sheet per request. Export: **Registration Sheet** (PDF) |
| `/evaluation` | Evaluation | Score each form item (1–5 or numeric), comments, file attachments, pass/fail summary, PDF export |

## Thai text in PDFs (one-time setup)

jsPDF's built-in fonts don't include Thai glyphs, so by default Thai characters
are **missing in generated PDFs only** (the on-screen UI uses a Google webfont
and is always fine).

To get perfect Thai PDFs:

1. Download `THSarabunNew.ttf` (free, SIL OFL): https://www.f0nt.com/release/th-sarabun-new/
2. Convert to a jsPDF base64 string: https://peckconsulting.s3.amazonaws.com/fontconverter/fontconverter.html
3. Paste the string into `THSARABUN_BASE64` in
   `client/src/lib/thai-font.js`.

No code changes needed — the PDF generator detects the font and switches to it
automatically.

## Project layout

```
training-app/
├─ package.json          # root, runs both apps via concurrently
├─ server/
│  ├─ index.js           # Express entry
│  ├─ db/
│  │  ├─ schema.sql      # tables (executed on every start)
│  │  └─ db.js           # connection + seed
│  └─ routes/
│     ├─ setup.js        # topics, courses, eval items/forms
│     ├─ training.js     # requests, registrations, dashboard stats
│     └─ evaluation.js   # evaluations, responses, attachments
└─ client/
   └─ src/
      ├─ pages/          # Dashboard, Setup, TrainingRequest, Registration, Evaluation
      ├─ components/     # DataGrid, Modal, ExportButton, FileUpload, ui primitives
      └─ lib/            # api, pdf-generator, excel-generator, thai-font
```

## Notes / assumptions

- **shadcn/ui**: built equivalent lightweight Tailwind primitives in
  `components/ui.jsx` (shadcn's CLI requires interactive init; this keeps
  `npm install && npm run dev` zero-touch).
- **Attachments** are stored as base64 data URLs in SQLite (simple, no upload
  middleware). The JSON body limit is raised to 25 MB for this.
- **Evaluation pass/fail** threshold is a weighted average ≥ 3 / 5.
- **Dashboard "budget used"** = total budget of *approved* requests; "planned" =
  all requests in the current year.
