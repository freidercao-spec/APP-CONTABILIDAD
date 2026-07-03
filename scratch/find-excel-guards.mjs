import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

function findGuarda(name) {
  const matches = [];
  for (const [pi, puesto] of excelData.entries()) {
    for (const [gi, g] of puesto.guardas.entries()) {
      if (g.nombre.toLowerCase().includes(name.toLowerCase())) {
        matches.push({ puestoIdx: pi, puestoNombre: puesto.cliente, guardasIdx: gi, name: g.nombre, cedula: g.cedula });
      }
    }
  }
  return matches;
}

console.log('SEPULVEDA matches:', findGuarda('SEPULVEDA'));
console.log('CAVADIA matches:', findGuarda('CAVADIA'));
console.log('WILLIAM MEDINA matches:', findGuarda('MEDINA VERGARA WILLIAM'));
console.log('JHONY MORELO matches:', findGuarda('JHONY MORELO LOPEZ'));
console.log('GONZALEZ DURAN ISABEL matches:', findGuarda('GONZALEZ DURAN ISABEL'));
