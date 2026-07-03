import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== LIST OF ALL TABLES ===');
  if (sheet.model && sheet.model.tables) {
    sheet.model.tables.forEach((t, i) => {
      console.log(`[${i}] Name: ${t.name} | Ref: ${t.tableRef}`);
    });
  } else {
    console.log('No tables found in sheet model.');
  }
}

main().catch(console.error);
