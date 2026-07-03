import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const targetRows = [166, 167, 187, 188];
  console.log('=== DUPLICATE GUARD COMPARISON ===');
  for (const r of targetRows) {
    const row = sheet.getRow(r);
    const name = row.getCell(7).value;
    const schedule = [];
    for (let d = 1; d <= 30; d++) {
      const val = row.getCell(9 + d).value;
      schedule.push(`${d}:${val || ''}`);
    }
    console.log(`Row ${r} (${name}): ${schedule.join(' | ')}`);
  }
}

main().catch(console.error);
