import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

const carisma = excelData.find(p => p.cliente.includes('CARISMA BELEN'));
console.log('CARISMA BELEN Guardas:');
carisma.guardas.forEach((g, idx) => {
  console.log(`  Row ${idx}: "${g.nombre}" (CC:${g.cedula})`);
  // Print days with values
  const activeDays = Object.entries(g.dias).filter(([d, v]) => v !== '' && v !== null && v !== undefined).map(([d, v]) => `${d}:${v}`);
  console.log(`    Days: ${activeDays.join(', ')}`);
});
