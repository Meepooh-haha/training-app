import ExcelJS from 'exceljs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'registration_template.xlsx');

// Cell map below was read off the real company template (server/templates/registration_template.xlsx)
// with server/scripts/inspect-registration-xlsx.mjs — do not change these addresses without
// re-running that script against the current template.
//
// The workbook ships with two sheets: "ใบลงทะเบียน" (a filled-in example from a past training)
// and "ใบลงทะเบียน (2)" (the same layout with no attendee data — this is the reusable blank
// we duplicate). Output = one tab per training day, plus "(ต่อ)" continuation tabs when a
// day has more than 28 attendees (the form has 28 signature rows); continuation tabs get
// their No. column renumbered so the running numbers carry on (29, 30, …).
const BLANK_SHEET_NAME = 'ใบลงทะเบียน (2)';
const EXAMPLE_SHEET_NAME = 'ใบลงทะเบียน';
const SINGLE_SHEET_NAME = 'ใบลงทะเบียน';

const ATTENDEE_START_ROW = 9;
const ATTENDEE_MAX_ROWS = 28; // rows 9-36 in the blank template — do not exceed without extending the sheet
const MAX_DAYS = 31; // sanity cap on tabs

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function parseIso(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// e.g. "2026-06-23" -> "วันอังคารที่ 23 มิถุนายน 2569"
function formatThaiDate(isoDate) {
  const d = parseIso(isoDate);
  if (!d) return isoDate || '';
  return `วัน${THAI_WEEKDAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// tab-safe short date, e.g. "23-06-2569" (Excel forbids : \ / ? * [ ] in tab names)
function formatTabDate(isoDate) {
  const d = parseIso(isoDate);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear() + 543}`;
}

// "09:00" -> "09.00" (template uses a period, not a colon, as the time separator)
function dotTime(t) {
  return String(t || '').replace(':', '.');
}

function formatTimeRange(start, end) {
  const s = dotTime(start || '09:00');
  const e = dotTime(end || '');
  return e ? `${s} - ${e} น.` : `${s} น.`;
}

function tabName(day, dayIndex, chunkIndex, multiDay) {
  const base = multiDay ? (formatTabDate(day) || `วันที่ ${dayIndex + 1}`) : SINGLE_SHEET_NAME;
  if (chunkIndex === 0) return base;
  return `${base} (ต่อ${chunkIndex > 1 ? ` ${chunkIndex}` : ''})`;
}

export async function fillRegistrationTemplate(data) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const exampleSheet = workbook.getWorksheet(EXAMPLE_SHEET_NAME);
  if (exampleSheet) workbook.removeWorksheet(exampleSheet.id);

  const blank = workbook.getWorksheet(BLANK_SHEET_NAME);
  // Worksheet model getter emits `merges`, but the setter reads `mergeCells` —
  // the standard ExcelJS sheet-copy recipe bridges the two.
  const srcModel = blank.model;

  const attendees = data.attendees || [];
  const chunks = [];
  for (let i = 0; i < Math.max(1, attendees.length); i += ATTENDEE_MAX_ROWS) {
    chunks.push(attendees.slice(i, i + ATTENDEE_MAX_ROWS));
  }

  const days = (Array.isArray(data.days) && data.days.length ? data.days : [data.training_date || '']).slice(0, MAX_DAYS);
  const multiDay = days.length > 1;

  days.forEach((day, di) => {
    chunks.forEach((chunk, ci) => {
      const name = tabName(day, di, ci, multiDay);
      const sheet = workbook.addWorksheet(name);
      sheet.model = Object.assign({}, srcModel, { mergeCells: srcModel.merges, name });
      sheet.name = name;

      sheet.getCell('C1').value = data.course_name || '';
      sheet.getCell('C2').value = formatThaiDate(day);
      sheet.getCell('C3').value = formatTimeRange(data.start_time, data.end_time);
      sheet.getCell('C4').value = data.location || '';
      sheet.getCell('C5').value = data.trainer_name || '';
      // F4 (company name) is a fixed label baked into the template — left untouched.

      chunk.forEach((a, i) => {
        const row = ATTENDEE_START_ROW + i;
        sheet.getCell(`B${row}`).value = a.employee_id || '';
        sheet.getCell(`C${row}`).value = a.name || '';
        sheet.getCell(`D${row}`).value = a.position || '';
        // Columns E/F (เช้า/บ่าย signature) are for handwritten signatures — left blank.
      });

      // Continuation tabs: the template pre-numbers column A as 1..28 — rewrite
      // the whole column so the running numbers continue (29, 30, …) even on
      // rows left blank for walk-in signatures.
      if (ci > 0) {
        for (let i = 0; i < ATTENDEE_MAX_ROWS; i++) {
          sheet.getCell(`A${ATTENDEE_START_ROW + i}`).value = ci * ATTENDEE_MAX_ROWS + i + 1;
        }
      }
    });
  });

  workbook.removeWorksheet(blank.id);
  return workbook.xlsx.writeBuffer();
}
