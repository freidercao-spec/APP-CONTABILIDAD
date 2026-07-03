import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'excel_parsed.json'); // ZONA 20 parsed file

const excelData = JSON.parse(readFileSync(filePath, 'utf-8'));

const counts = {};

for (const ep of excelData) {
  for (const g of ep.guardas) {
    for (const code of Object.values(g.dias)) {
      const c = String(code || '').trim().toUpperCase();
      counts[c] = (counts[c] || 0) + 1;
    }
  }
}

console.log('=== SHIFT CODE COUNTS IN ZONA 20 EXCEL ===');
const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
for (const [code, count] of sorted) {
  console.log(`- Code: "${code}" -> Count: ${count}`);
}
