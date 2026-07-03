import { readFileSync } from 'fs';

const parsed = JSON.parse(readFileSync('scratch/excel_parsed_zona23.json', 'utf-8'));
console.log('Sample parsed ZONA 23 data (first 5 puestos):');
parsed.slice(0, 5).forEach((p, pi) => {
  console.log(`\nPUESTO ${pi+1}: Cliente="${p.cliente}" Puesto="${p.puesto}"`);
  console.log('Guardas:', p.guardas.map(g => `${g.nombre} (CC:${g.cedula})`));
  p.guardas.forEach(g => {
    console.log(`  Days (${Object.keys(g.dias).length}):`, Object.entries(g.dias).map(([d, t]) => `${d}:${t}`).join(', '));
  });
});
