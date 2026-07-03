import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

const vigilanteOccurrences = {}; // cedula -> [{ puestoIdx, puestoNombre, guardaIdx, nombre }]

for (const [pi, puesto] of excelData.entries()) {
  for (const [gi, g] of puesto.guardas.entries()) {
    const ced = String(g.cedula).trim();
    if (!ced || !/^\d+$/.test(ced)) continue;
    if (!vigilanteOccurrences[ced]) vigilanteOccurrences[ced] = [];
    vigilanteOccurrences[ced].push({ puestoIdx: pi, puestoNombre: puesto.cliente.trim(), guardaIdx: gi, nombre: g.nombre.trim() });
  }
}

console.log('Vigilantes with multiple occurrences in Excel:');
let totalDupes = 0;
for (const [ced, occurrences] of Object.entries(vigilanteOccurrences)) {
  if (occurrences.length > 1) {
    totalDupes++;
    console.log(`\nCC: ${ced} (${occurrences[0].nombre}) - Occurrences: ${occurrences.length}`);
    occurrences.forEach(o => {
      console.log(`  - Puesto: "${o.puestoNombre}" (Idx: ${o.puestoIdx}), Guarda Idx: ${o.guardaIdx}`);
    });
  }
}
console.log(`\nTotal duplicate vigilantes: ${totalDupes}`);
