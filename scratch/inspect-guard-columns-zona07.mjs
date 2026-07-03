import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const row = sheet.getRow(40);
  console.log('=== ROW 40 ALL COLUMNS ===');
  for (let c = 1; c <= sheet.columnCount; c++) {
    const val = row.getCell(c).value;
    if (val !== null && val !== undefined && val !== '') {
      console.log(`Col ${c}: "${val}"`);
    }
  }
}

main().catch(console.error);
