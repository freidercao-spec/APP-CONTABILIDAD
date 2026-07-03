import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('Scanning Column 6 and 7 for non-guard/non-numeric headers:');
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const c6 = row.getCell(6).value;
    const c7 = row.getCell(7).value;

    const s6 = String(c6 || '').trim();
    // If it's a guard row, c6 is a numeric ID (cédula). So if c6 is not a number and is not empty:
    if (s6 && !/^\d+$/.test(s6) && !s6.includes('CEDULA') && !s6.includes('CLIENTE')) {
      console.log(`Row ${r}: Col6="${s6}" | Col7="${String(c7 || '').trim()}"`);
    }
  }
}

main().catch(console.error);
