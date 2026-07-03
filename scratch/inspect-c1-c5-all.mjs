import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('Scanning Columns 1 to 5 for rows with guards (Row 8 to 100):');
  for (let r = 8; r <= 100; r++) {
    const row = sheet.getRow(r);
    const c6 = row.getCell(6).value;
    const c7 = row.getCell(7).value;

    const s6 = String(c6 || '').trim();
    if (s6 && /^\d+$/.test(s6)) {
      const c1 = row.getCell(1).value;
      const c2 = row.getCell(2).value;
      const c3 = row.getCell(3).value;
      const c4 = row.getCell(4).value;
      const c5 = row.getCell(5).value;
      console.log(`Row ${r} (Guard: "${c7}"): C1="${c1 || ''}" | C2="${c2 || ''}" | C3="${c3 || ''}" | C4="${c4 || ''}" | C5="${c5 || ''}"`);
    }
  }
}

main().catch(console.error);
