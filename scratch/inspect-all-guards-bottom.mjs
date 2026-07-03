import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== GUARD ROWS FROM 300 TO END ===');
  for (let r = 300; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const c6 = row.getCell(6).value;
    const c7 = row.getCell(7).value;

    const s6 = String(c6 || '').trim();
    if (s6 && /^\d+$/.test(s6)) {
      console.log(`Row ${r}: Guard="${c7}" (CC: ${s6})`);
    }
  }
}

main().catch(console.error);
