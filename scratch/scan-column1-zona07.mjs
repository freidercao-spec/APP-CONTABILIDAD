import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('Scanning Col 1, Col 2, Col 3 for non-empty values:');
  for (let r = 8; r <= 200; r++) {
    const row = sheet.getRow(r);
    const c1 = row.getCell(1).value;
    const c2 = row.getCell(2).value;
    const c3 = row.getCell(3).value;
    
    if (c1 || c2 || c3) {
      console.log(`Row ${r}: Col1="${c1 || ''}" | Col2="${c2 || ''}" | Col3="${c3 || ''}"`);
    }
  }
}

main().catch(console.error);
