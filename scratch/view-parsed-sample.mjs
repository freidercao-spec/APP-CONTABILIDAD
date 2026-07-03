import { readFileSync } from 'fs';
import path from 'path';

const parsed = JSON.parse(readFileSync('scratch/excel_parsed.json', 'utf-8'));
console.log('Sample parsed data (first 5 puestos):');
parsed.slice(0, 5).forEach((p, pi) => {
  console.log(`\nPUESTO ${pi+1}: Cliente="${p.cliente}" Puesto="${p.puesto}"`);
  console.log('Guardas:', p.guardas.map(g => `${g.nombre} (CC:${g.cedula})`));
});
