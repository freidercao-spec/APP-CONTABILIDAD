import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== TABLA 1 SCHEDULE ===');
  for (let r = 8; r <= 14; r++) {
    const row = sheet.getRow(r);
    const name = row.getCell(7).value;
    if (!name) continue;
    const schedule = [];
    for (let d = 1; d <= 30; d++) {
      const val = row.getCell(9 + d).value;
      schedule.push(`${d}:${val || ''}`);
    }
    console.log(`Row ${r} (${name}): ${schedule.join(' | ')}`);
  }
}

main().catch(console.error);
