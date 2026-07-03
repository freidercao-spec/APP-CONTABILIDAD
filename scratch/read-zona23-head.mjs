import ExcelJS from 'exceljs';

const filePath = 'ZONA 23 JUNIO/JUNIO ZONA 23 - AC.xlsx';
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);
const sheet = workbook.getWorksheet('MAYO 2026') || workbook.worksheets[0];

console.log(`Sheet name: "${sheet.name}"`);
for (let r = 1; r <= 15; r++) {
  const row = sheet.getRow(r);
  const values = [];
  for (let c = 1; c <= 38; c++) {
    values.push(row.getCell(c).value);
  }
  // Print row number and non-empty values
  console.log(`Row ${r}:`, values.slice(0, 15).map(v => v !== null && typeof v === 'object' ? (v.result || v.text || JSON.stringify(v)) : v));
}
