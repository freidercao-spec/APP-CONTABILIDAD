import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 13 JUNIO', 'JUNIO-ZONA 13.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log(`Total rows: ${sheet.rowCount}`);
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const c2 = row.getCell(2).value;
    const c3 = row.getCell(3).value;
    const c8 = row.getCell(8).value;
    const c9 = row.getCell(9).value;
    const c10 = row.getCell(10).value;
    
    if (c3 || c8 || c9) {
      console.log(`Row ${r}: Col2="${c2 || ''}" | Col3="${c3 || ''}" | Col8="${c8 || ''}" | Col9="${c9 || ''}" | Col10="${c10 || ''}"`);
    }
  }
}

main().catch(console.error);
