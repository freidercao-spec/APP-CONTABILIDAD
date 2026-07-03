import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== ROWS 170 TO 172 ===');
  for (let r = 170; r <= 172; r++) {
    const row = sheet.getRow(r);
    const nonEmpties = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      const val = row.getCell(c).value;
      if (val !== null && val !== undefined && val !== '') {
        nonEmpties.push(`Col${c}:${String(val).trim().substring(0, 20)}`);
      }
    }
    console.log(`Row ${r}: ${nonEmpties.join(' | ')}`);
  }
}

main().catch(console.error);
