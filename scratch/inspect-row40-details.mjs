import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== DETAILED CELL SCAN ROWS 33 TO 45 ===');
  for (let r = 33; r <= 45; r++) {
    const row = sheet.getRow(r);
    console.log(`\nRow ${r}:`);
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c);
      const val = cell.value;
      const isMerged = cell.isMerged;
      const master = cell.master ? cell.master.address : '';
      if (val !== null && val !== undefined && val !== '') {
        console.log(`  Col ${c}: Val="${val}" | Merged=${isMerged} | Master=${master}`);
      } else {
        // Even if empty, show if merged or master is different
        if (isMerged) {
          console.log(`  Col ${c}: [Empty Merged] | Master=${master}`);
        }
      }
    }
  }
}

main().catch(console.error);
