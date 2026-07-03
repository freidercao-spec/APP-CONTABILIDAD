import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log(`=== BOTTOM ROWS SCAN (300 to ${sheet.rowCount}) ===`);
  for (let r = 300; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const c1 = row.getCell(1).value;
    const c6 = row.getCell(6).value;
    const c7 = row.getCell(7).value;

    const s1 = String(c1 || '').trim();
    const s6 = String(c6 || '').trim();
    const s7 = String(c7 || '').trim();

    if (s1 || s6 || s7) {
      console.log(`Row ${r}: Col1="${s1}" | Col6="${s6}" | Col7="${s7}"`);
    }
  }
}

main().catch(console.error);
