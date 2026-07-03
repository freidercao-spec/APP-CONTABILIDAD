import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== OBJECT / FORMULA DETAILS ===');
  for (let r = 33; r <= 46; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= sheet.columnCount; c++) {
      const cell = row.getCell(c);
      const val = cell.value;
      if (val && typeof val === 'object' && ! (val instanceof Date)) {
        console.log(`Row ${r} Col ${c}: JSON=${JSON.stringify(val)}`);
      }
    }
  }
}

main().catch(console.error);
