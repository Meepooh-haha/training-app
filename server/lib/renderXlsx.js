import ExcelJS from 'exceljs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'pr.xlsx');

// Cell map below was read off the real accounting template (server/templates/pr.xlsx,
// sheet "PURCHASE REQUISITION (PR)") with server/scripts/inspect-pr-xlsx.mjs — do not
// change these addresses without re-running that script against the current template.
const SIG_DEFAULTS = {
  sig1_name: '(...........................................)',
  sig2_name: '(..........................................)',
  sig3_name: '(....................................................)',
  sig1_title: '',
  sig2_title: 'MANAGER',
  sig3_title: 'CEO/MD',
  sig1_date: '    วันที่ / Date: ....../....../......',
};

const CENTER = { horizontal: 'center' };

function fmtDate(d) {
  if (!d) return '';
  const p = String(d).split('-');
  if (p.length !== 3) return d;
  return `${parseInt(p[2], 10)}/${parseInt(p[1], 10)}/${parseInt(p[0], 10)}`;
}

function excelDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function fillPrTemplate(data) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  workbook.calcProperties.fullCalcOnLoad = true;

  const sheet = workbook.worksheets[0];

  sheet.getCell('E5').value = data.pr_no || '';
  sheet.getCell('I5').value = excelDate(data.date);
  sheet.getCell('E6').value = data.department || '';
  sheet.getCell('I6').value = excelDate(data.required_date);
  sheet.getCell('E7').value = data.requester || '';
  sheet.getCell('I7').value = data.expense_type || '';

  const items = (data.items || []).slice(0, 10);
  items.forEach((it, i) => {
    const row = 10 + i;
    const qty = Number(it.qty) || 0;
    const price = Number(it.unit_price) || 0;
    const amount = qty * price;
    sheet.getCell(`C${row}`).value = it.gl_code || '';
    sheet.getCell(`D${row}`).value = it.item_code || '';
    sheet.getCell(`E${row}`).value = it.description || '';
    sheet.getCell(`F${row}`).value = qty || null;
    sheet.getCell(`G${row}`).value = it.unit || '';
    sheet.getCell(`H${row}`).value = price || null;
    sheet.getCell(`I${row}`).value = amount || null;
  });
  // I20 (=SUM(I10:I19)), I21 (=I20*7%) and I23 (=(I20+I21)-I22) are existing formulas
  // in the template — left untouched, they recalculate from the item rows above.

  sheet.getCell('I22').value = Number(data.wht) || 0;
  sheet.getCell('C26').value = data.reason || '';

  // C34 isn't merged with D34 in the template (unlike C35:D35/C36:D36 in the same
  // column), which threw off centering vs. the title/date lines below it — merge it
  // here so all three lines in the requester column share the same centered width.
  if (!sheet.getCell('C34').isMerged) sheet.mergeCells('C34:D34');

  const sig1NameCell = sheet.getCell('C34');
  sig1NameCell.value = data.sig1_name ? `(${data.sig1_name})` : SIG_DEFAULTS.sig1_name;
  sig1NameCell.alignment = CENTER;

  const sig2NameCell = sheet.getCell('E34');
  sig2NameCell.value = data.sig2_name ? `(${data.sig2_name})` : SIG_DEFAULTS.sig2_name;
  sig2NameCell.alignment = CENTER;

  const sig3NameCell = sheet.getCell('G34');
  sig3NameCell.value = data.sig3_name ? `(${data.sig3_name})` : SIG_DEFAULTS.sig3_name;
  sig3NameCell.alignment = CENTER;

  // Position line: just the person's title, centered under the name — no
  // "ตำแหน่ง/ Position:" label prefix.
  const sig1TitleCell = sheet.getCell('C35');
  sig1TitleCell.value = data.sig1_title || SIG_DEFAULTS.sig1_title;
  sig1TitleCell.alignment = CENTER;

  const sig2TitleCell = sheet.getCell('E35');
  sig2TitleCell.value = data.sig2_title || SIG_DEFAULTS.sig2_title;
  sig2TitleCell.alignment = CENTER;

  const sig3TitleCell = sheet.getCell('G35');
  sig3TitleCell.value = data.sig3_title || SIG_DEFAULTS.sig3_title;
  sig3TitleCell.alignment = CENTER;

  // Only the requester's (column 1) signature line gets an auto-filled date — the
  // approver columns (2/3) keep their blank "......" placeholder for a handwritten date.
  sheet.getCell('C36').value = data.date
    ? `    วันที่ / Date: ${fmtDate(data.date)}`
    : SIG_DEFAULTS.sig1_date;

  return workbook.xlsx.writeBuffer();
}
