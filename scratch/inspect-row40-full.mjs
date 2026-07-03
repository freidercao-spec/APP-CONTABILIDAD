import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== DETAILED CELL SCAN ROWS 33 TO 46 (ALL COLUMNS) ===');
  for (let r = 33; r <= 46; r++) {
    const row = sheet.getRow(r);
    console.log(`\nRow ${r}:`);
    for (let c = 1; c <= sheet.columnCount; c++) {
      const cell = row.getCell(c);
      const val = cell.value;
      if (val !== null && val !== undefined && val !== '') {
        console.log(`  Col ${c}: Val="${val}" | Merged=${cell.isMerged} | Master=${cell.master ? cell.master.address : ''}`);
      }
    }
  }
}

main().catch(console.error);
