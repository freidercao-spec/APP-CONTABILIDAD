import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'excel_parsed.json');

const excelData = JSON.parse(readFileSync(filePath, 'utf-8'));

console.log('=== LOGGING DETAILS FOR RARE SHIFTS IN ZONA 20 ===');

for (const ep of excelData) {
  for (const g of ep.guardas) {
    for (const [dia, code] of Object.entries(g.dias)) {
      const c = String(code || '').trim().toUpperCase();
      if (['1', 'D9', 'N10', 'N8'].includes(c)) {
        console.log(`- Puesto: "${ep.cliente}" -> Guard: "${g.nombre}" -> Day ${dia}: "${c}"`);
      }
    }
  }
}
