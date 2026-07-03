import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== INSPECTING ROWS 13 TO 33 ===');
  for (let r = 13; r <= 33; r++) {
    const row = sheet.getRow(r);
    const vals = [];
    for (let c = 1; c <= 15; c++) {
      const val = row.getCell(c).value;
      if (val !== null && val !== undefined && val !== '') {
        vals.push(`C${c}:"${val}"`);
      }
    }
    console.log(`Row ${r}:`, vals.join(' | '));
  }
}

main().catch(console.error);
