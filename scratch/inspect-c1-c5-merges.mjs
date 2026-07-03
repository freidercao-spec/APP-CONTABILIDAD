import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const merges = sheet.model.merges || [];
  console.log(`Found ${merges.length} merged ranges.`);

  console.log('=== MERGES IN COLUMNS A-E ===');
  for (const range of merges) {
    const startCol = range.match(/^[A-Z]+/)[0];
    if (['A', 'B', 'C', 'D', 'E'].includes(startCol)) {
      const parts = range.split(':');
      const startCell = sheet.getCell(parts[0]);
      console.log(`Range: "${range}" -> Start Cell Value: "${startCell.value || ''}"`);
    }
  }
}

main().catch(console.error);
