import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== INSPECTION OF ROWS 30 TO 45 ===');
  for (let r = 30; r <= 45; r++) {
    const row = sheet.getRow(r);
    const vals = [];
    for (let c = 1; c <= 15; c++) {
      vals.push(`C${c}:"${row.getCell(c).value || ''}"`);
    }
    console.log(`Row ${r}:`, vals.join(' | '));
  }
}

main().catch(console.error);
