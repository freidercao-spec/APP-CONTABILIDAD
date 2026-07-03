import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== COLUMNS 40 TO 52 FOR ROWS 33 TO 45 ===');
  for (let r = 33; r <= 45; r++) {
    const row = sheet.getRow(r);
    const cols = [];
    for (let c = 40; c <= sheet.columnCount; c++) {
      const val = row.getCell(c).value;
      let valStr = '';
      if (val && typeof val === 'object' && ! (val instanceof Date)) {
        valStr = `Formula:${val.formula || ''}(Res:${val.result || ''})`;
      } else {
        valStr = val ? String(val).trim() : '';
      }
      cols.push(`Col${c}:${valStr}`);
    }
    console.log(`Row ${r}: ${cols.join(' | ')}`);
  }
}

main().catch(console.error);
