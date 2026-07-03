import ExcelJS from 'exceljs';
import path from 'path';

const filePath = 'ZONA 23 JUNIO/JUNIO ZONA 23 - AC.xlsx';
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);

console.log('Sheets in ZONA 23 Excel file:');
workbook.worksheets.forEach((sheet, idx) => {
  console.log(`  Index ${idx}: "${sheet.name}" (Rows: ${sheet.rowCount}, Cols: ${sheet.actualColumnCount})`);
});
