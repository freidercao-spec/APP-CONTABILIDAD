import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log(`=== SCANNING ROWS 380 TO 618 ===`);
  for (let r = 380; r <= Math.min(sheet.rowCount, 618); r++) {
    const row = sheet.getRow(r);
    const nonEmpties = [];
    for (let c = 1; c <= 45; c++) {
      const val = row.getCell(c).value;
      if (val !== null && val !== undefined && val !== '') {
        nonEmpties.push(`Col${c}:${String(val).trim().substring(0, 20)}`);
      }
    }
    if (nonEmpties.length > 0) {
      console.log(`Row ${r}: ${nonEmpties.join(' | ')}`);
    }
  }
}

main().catch(console.error);
