import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

const toscana = excelData.find(p => p.cliente.includes('TOSCANA'));
console.log('TOSCANA Raw Guardas:');
toscana.guardas.forEach((g, idx) => {
  console.log(`\nGuarda ${idx}: Name="${g.nombre}" CC="${g.cedula}"`);
  console.log('Dias:', g.dias);
});
