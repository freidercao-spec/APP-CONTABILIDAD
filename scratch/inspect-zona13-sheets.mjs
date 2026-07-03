import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 13 JUNIO', 'JUNIO-ZONA 13.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log('Sheets in workbook:');
  workbook.worksheets.forEach((ws, i) => {
    console.log(`- [${i}] ${ws.name}`);
  });

  const sheet = workbook.worksheets[0];
  console.log(`\nReading first 10 rows from sheet "${sheet.name}":`);
  for (let r = 1; r <= 10; r++) {
    const row = sheet.getRow(r);
    const vals = [];
    row.eachCell((c) => vals.push(`Col ${c.col}: ${String(c.value || '')}`));
    console.log(`Row ${r}:`, vals.slice(0, 10).join(' | '));
  }
}

main().catch(console.error);
