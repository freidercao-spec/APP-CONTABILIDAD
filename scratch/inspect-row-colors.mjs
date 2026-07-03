import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== STYLE INSPECTION ROWS 40 TO 44 ===');
  for (let r = 40; r <= 44; r++) {
    const row = sheet.getRow(r);
    const cell6 = row.getCell(6);
    const cell7 = row.getCell(7);

    console.log(`Row ${r} (Guard: "${cell7.value}"):`);
    console.log(`  Col 6: Fill=${JSON.stringify(cell6.fill)} | Font=${JSON.stringify(cell6.font)}`);
    console.log(`  Col 7: Fill=${JSON.stringify(cell7.fill)} | Font=${JSON.stringify(cell7.font)}`);
  }
}

main().catch(console.error);
