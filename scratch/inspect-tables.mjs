import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log('=== SHEET TABLES ===');
  // Check sheet.tables
  if (sheet.tables) {
    console.log(`Found ${Object.keys(sheet.tables).length} tables:`);
    for (const [name, table] of Object.entries(sheet.tables)) {
      console.log(`Table name: ${name}`);
      console.log(`  Reference: ${table.table.ref}`);
      console.log(`  Columns: ${table.table.columns.map(c => c.name).join(', ')}`);
    }
  } else {
    console.log('No tables object directly on sheet.');
  }

  // Also check sheet.model.tables
  if (sheet.model && sheet.model.tables) {
    console.log(`Found ${sheet.model.tables.length} tables in model:`);
    for (const t of sheet.model.tables) {
      console.log(`Table: ${JSON.stringify(t)}`);
    }
  }
}

main().catch(console.error);
