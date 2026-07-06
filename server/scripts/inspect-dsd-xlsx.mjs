// Dump ทุก cell/merge/dropdown ของ server/templates/dsd_template.xlsx
// (ฟอร์มรายงานผลกรมพัฒนาฝีมือแรงงาน — แปลงครั้งเดียวจาก .xls ราชการ)
// ใช้ตรวจพิกัดก่อนแก้ server/routes/dsd.js ถ้า template ถูกเปลี่ยน:
//   node server/scripts/inspect-dsd-xlsx.mjs [sheetName] [rowFrom] [rowTo]
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '../templates/dsd_template.xlsx');

const [sheetArg, fromArg, toArg] = process.argv.slice(2);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);

for (const ws of wb.worksheets) {
  if (sheetArg && ws.name !== sheetArg) continue;
  console.log(`\n===== SHEET ${JSON.stringify(ws.name)} (rows ${ws.rowCount}, state ${ws.state}) =====`);
  console.log('merges:', Object.keys(ws._merges || {}).join(' ') || '(none)');

  const dv = ws.dataValidations?.model || {};
  const dvSummary = {};
  for (const [addr, rule] of Object.entries(dv)) {
    const key = (rule.formulae || []).join(';');
    (dvSummary[key] = dvSummary[key] || []).push(addr);
  }
  for (const [formulae, addrs] of Object.entries(dvSummary)) {
    console.log(`validation ${formulae} → ${addrs.length} cells (first: ${addrs[0]})`);
  }

  const from = Number(fromArg) || 1;
  const to = Number(toArg) || Math.min(ws.rowCount, 30);
  for (let r = from; r <= to; r++) {
    const row = ws.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      let v = cell.value;
      if (v && typeof v === 'object' && v.richText) v = v.richText.map((t) => t.text).join('');
      if (v && typeof v === 'object' && v.formula) v = 'ƒ=' + v.formula;
      const s = String(v).replace(/\n/g, '\\n');
      cells.push(`${cell.address}=${s.length > 80 ? s.slice(0, 80) + '…' : s}`);
    });
    if (cells.length) console.log(`R${r}: ${cells.join(' | ')}`);
  }
}
