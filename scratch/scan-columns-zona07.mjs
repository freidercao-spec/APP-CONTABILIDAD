import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log(`Sheet "${sheet.name}" size: rows=${sheet.rowCount}, cols=${sheet.columnCount}`);

  // Find all columns that have non-empty headers at row 7
  const row7 = sheet.getRow(7);
  console.log('\nHeaders at Row 7:');
  for (let c = 1; c <= sheet.columnCount; c++) {
    const val = row7.getCell(c).value;
    if (val) {
      console.log(`Col ${c}: "${val}"`);
    }
  }

  // Find all columns that have non-empty headers at row 39
  const row39 = sheet.getRow(39);
  console.log('\nHeaders at Row 39:');
  for (let c = 1; c <= sheet.columnCount; c++) {
    const val = row39.getCell(c).value;
    if (val) {
      console.log(`Col ${c}: "${val}"`);
    }
  }
}

main().catch(console.error);
