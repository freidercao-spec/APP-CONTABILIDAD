import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log(`Total rows: ${sheet.rowCount}`);
  for (let r = 1; r <= Math.min(sheet.rowCount, 100); r++) {
    const row = sheet.getRow(r);
    const c1 = row.getCell(1).value;
    const c2 = row.getCell(2).value;
    const c3 = row.getCell(3).value;
    const c4 = row.getCell(4).value;
    const c6 = row.getCell(6).value;
    const c7 = row.getCell(7).value;
    
    if (c1 || c2 || c6 || c7) {
      console.log(`Row ${r}: Col1="${c1 || ''}" | Col2="${c2 || ''}" | Col3="${c3 || ''}" | Col4="${c4 || ''}" | Col6="${c6 || ''}" | Col7="${c7 || ''}"`);
    }
  }
}

main().catch(console.error);
