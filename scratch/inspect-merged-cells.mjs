import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== MERGED CELLS ===');
  // ExcelJS has sheet.model.merges array
  const merges = sheet.model.merges || [];
  console.log(`Found ${merges.length} merged ranges.`);

  // Print some merges that involve column 1 (A) or column 6/7 (F/G)
  for (const range of merges) {
    // range is string like "A8:A14"
    const parts = range.split(':');
    const startCell = sheet.getCell(parts[0]);
    if (parts[0].startsWith('A') || parts[0].startsWith('F') || parts[0].startsWith('G')) {
      console.log(`Range: "${range}" -> Start Cell Value: "${startCell.value || ''}"`);
    }
  }
}

main().catch(console.error);
