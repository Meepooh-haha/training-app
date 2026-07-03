# Training App

## Document generation (memo & PR)

Two independent server-side pipelines fill a real Office template and convert it to PDF via a local LibreOffice install. Both live under `server/`, are mounted in `server/index.js`, and share the same conversion pattern (`soffice --headless --convert-to pdf`, per-request `UserInstallation` profile dir, tmp-file cleanup in a `finally` block).

| | Memo | PR (Purchase Requisition) |
|---|---|---|
| Template | `server/templates/memo_template.docx` | `server/templates/pr.xlsx` |
| Fill engine | `docxtemplater` + `pizzip` (placeholder tags in the docx) | `ExcelJS` (literal cell coordinates) |
| Fill code | `server/routes/memo.js` | `server/lib/renderXlsx.js` |
| Routes | `POST /api/memo/export-pdf`, `POST /api/memo/export-docx` | `POST /api/pr/export-pdf`, `POST /api/pr/export-xlsx` |
| Client caller | `client/src/pages/MemoForm.jsx` | `client/src/pages/PRForm.jsx` (also reachable via `Development/PRIssuancePage.jsx`) |

PR intentionally uses ExcelJS/xlsx instead of docxtemplater: a spreadsheet's grid makes wrong-cell mistakes obvious, whereas a misplaced docx placeholder fails silently. Memo stays on docxtemplater/docx.

### PR cell mapping

`server/lib/renderXlsx.js` writes to fixed cell addresses on the single sheet `"PURCHASE REQUISITION (PR)"` in `server/templates/pr.xlsx`. These addresses were read off the real template with `server/scripts/inspect-pr-xlsx.mjs` (dumps every cell address, value, and merge range) — **re-run that script and update the addresses in `renderXlsx.js` if the template is ever replaced.** Never guess coordinates.

Key mapping:
- Header fields: `E5`/`I5` (PR No./Date), `E6`/`I6` (Department/Required Date), `E7`/`I7` (Requester/Expense Type). `I5`/`I6` are date-formatted cells — pass real `Date` objects.
- Item loop: rows `10`–`19` (10 fixed rows), columns `C`–`I` (GL Code, Item Code, Description, Qty, Unit, Unit Price, Amount).
- `I20`/`I21`/`I23` are pre-existing formulas in the template (subtotal, VAT, grand total) — left untouched; `workbook.calcProperties.fullCalcOnLoad = true` forces them to recalculate when opened. `I22` (WHT) is a plain value we write directly.
- `C26` — merged reason-for-request box.
- Signature block (`C34/C35`, `E34/E35`, `G34/G35`, requester/approver 2/approver 3): name and title only, no `ตำแหน่ง/ Position:` label prefix, all explicitly center-aligned (`C34` is merged with `D34` at fill time to match the width of `C35:D35`/`C36:D36` — the template doesn't merge it by default, which otherwise skews centering vs. the rows below it). Only the requester's column (`C36`) gets an auto-filled date; approver columns 2/3 keep their blank handwritten-date placeholder.

### Known limitation

`SOFFICE` in both `memo.js` and `pr.js` is a hardcoded local Windows LibreOffice path (`C:\Program Files\LibreOffice\program\soffice.exe`). `vercel.json` deploys `server/index.js` as a Vercel serverless function, which has no LibreOffice installed — `export-pdf` for both memo and PR only works where that binary is present (e.g. local dev), not on Vercel. `export-xlsx`/`export-docx` are unaffected since they skip the conversion step.
