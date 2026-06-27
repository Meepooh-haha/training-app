import * as XLSX from 'xlsx';

/**
 * Export an array of plain objects to an .xlsx file.
 * @param {object[]} rows   data rows (already flattened / labelled)
 * @param {string}   filename  without extension
 * @param {string}   sheetName
 */
export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
