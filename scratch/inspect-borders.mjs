import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== CELL BORDERS FOR ROWS 39 TO 45 ===');
  for (let r = 39; r <= 45; r++) {
    const row = sheet.getRow(r);
    const cell6 = row.getCell(6);
    const cell7 = row.getCell(7);
    console.log(`Row ${r}:`);
    console.log(`  Col 6 Border: ${JSON.stringify(cell6.border)}`);
    console.log(`  Col 7 Border: ${JSON.stringify(cell7.border)}`);
  }
}

main().catch(console.error);
