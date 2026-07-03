import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 23 JUNIO', 'JUNIO ZONA 23 - AC.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // We look at the first sheet or sheets
  const sheet = workbook.worksheets[0];
  console.log(`Sheet name: ${sheet.name}`);

  const colorMap = new Map(); // value -> Set of hex colors

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      const value = String(cell.value || '').trim().toUpperCase();
      if (!value) return;

      // Extract fill color
      let hexColor = 'FFFFFF'; // default white
      if (cell.fill && cell.fill.type === 'pattern' && cell.fill.fgColor) {
        // fgColor can be argb
        const argb = cell.fill.fgColor.argb;
        if (argb) {
          hexColor = argb.substring(2); // Remove alpha (first 2 chars) if 8-char hex
        }
      }

      if (!colorMap.has(value)) {
        colorMap.set(value, new Set());
      }
      colorMap.get(value).add(hexColor);
    });
  });

  console.log('\n=== MAPPING OF CELL VALUES TO HEX COLORS ===');
  for (const [val, colors] of colorMap.entries()) {
    // Only display interesting keys (e.g. status codes or shift codes)
    if (val.length <= 4 || ['VAC', 'INC', 'CZ', 'SUP', 'DIS', 'NR', 'RELEVANTE'].includes(val)) {
      console.log(`- Code: "${val}" -> Colors: ${Array.from(colors).map(c => '#' + c).join(', ')}`);
    }
  }
}

main().catch(console.error);
