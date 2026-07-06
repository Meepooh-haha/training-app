import ExcelJS from 'exceljs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'registration_template.xlsx');

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(TEMPLATE_PATH);

for (const sheet of workbook.worksheets) {
  console.log(`\n=== Sheet: "${sheet.name}" (dims: ${sheet.dimensions?.address || 'n/a'}) ===`);

  console.log('--- merges ---');
  const merges = sheet.model?.merges || [];
  console.log(merges.length ? merges.join(', ') : '(none)');

  console.log('--- cells ---');
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const v = cell.value;
      if (v !== null && v !== undefined && v !== '') {
        let display = v;
        if (typeof v === 'object') {
          if (v.richText) display = v.richText.map((r) => r.text).join('');
          else if (v.formula) display = `=${v.formula}`;
          else if (v.result !== undefined) display = v.result;
          else display = JSON.stringify(v);
        }
        cells.push(`${cell.address}=${JSON.stringify(display)}`);
      }
    });
    if (cells.length) console.log(`row ${rowNumber}: ${cells.join('  |  ')}`);
  });
}
