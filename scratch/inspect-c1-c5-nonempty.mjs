import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== NON-EMPTY CELLS IN COLUMNS 1 TO 5 ===');
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 5; c++) {
      const val = row.getCell(c).value;
      if (val !== null && val !== undefined && val !== '') {
        const valStr = String(val).trim();
        // Ignore standard headers
        if (!['CLIENTE:', 'COD PUESTO', 'ZONA', 'ZONA ', 'DIRECCION', 'TIPO DE SERVICIO'].includes(valStr.toUpperCase())) {
          console.log(`Row ${r} Col ${c}: "${valStr}"`);
        }
      }
    }
  }
}

main().catch(console.error);
