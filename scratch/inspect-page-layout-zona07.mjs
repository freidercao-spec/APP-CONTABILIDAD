import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== GRID VIEW ROWS 30 TO 110 (COLUMNS 1 TO 10) ===');
  for (let r = 30; r <= 110; r++) {
    const row = sheet.getRow(r);
    const cells = [];
    for (let c = 1; c <= 10; c++) {
      const val = row.getCell(c).value;
      const valStr = val ? String(val).trim().substring(0, 15) : '';
      cells.push(`[Col${c}]:${valStr.padEnd(15)}`);
    }
    console.log(`Row ${r.toString().padEnd(3)}: ${cells.join(' | ')}`);
  }
}

main().catch(console.error);
