import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

const targetCeds = ['1002490936', '98566804', '1214743442', '71734133', '70851012'];

for (const ced of targetCeds) {
  console.log(`\nSearching Excel for CC: ${ced}`);
  let found = false;
  for (const [pi, puesto] of excelData.entries()) {
    for (const [gi, g] of puesto.guardas.entries()) {
      if (String(g.cedula).trim() === ced) {
        console.log(`  Found in Excel:`);
        console.log(`  Puesto Index: ${pi}`);
        console.log(`  Puesto Name: "${puesto.cliente}" / "${puesto.puesto}"`);
        console.log(`  Guarda Index: ${gi}`);
        console.log(`  Guarda Name: "${g.nombre}"`);
        console.log(`  Days:`, Object.keys(g.dias).length);
        found = true;
      }
    }
  }
  if (!found) console.log('  NOT FOUND IN EXCEL');
}
