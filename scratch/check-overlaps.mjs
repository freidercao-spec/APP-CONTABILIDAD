import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

const targetCeds = ['1002490936', '98566804', '1214743442', '71734133', '70851012', '98491354'];

for (const ced of targetCeds) {
  console.log(`\nCC: ${ced}`);
  const occurrences = [];
  for (const [pi, puesto] of excelData.entries()) {
    for (const [gi, g] of puesto.guardas.entries()) {
      if (String(g.cedula).trim() === ced) {
        occurrences.push({ puesto: puesto.cliente.trim(), index: gi, dias: g.dias });
      }
    }
  }

  // Compare days for same-puesto occurrences
  const groupsByPuesto = {};
  occurrences.forEach(o => {
    if (!groupsByPuesto[o.puesto]) groupsByPuesto[o.puesto] = [];
    groupsByPuesto[o.puesto].push(o);
  });

  for (const [puestoName, list] of Object.entries(groupsByPuesto)) {
    if (list.length < 2) continue;
    console.log(`  Puesto: "${puestoName}" has ${list.length} rows in Excel`);
    const dayAssignments = {}; // dia -> []
    list.forEach(o => {
      Object.entries(o.dias).forEach(([diaStr, val]) => {
        const dia = parseInt(diaStr);
        if (isNaN(dia) || val === '' || val === null || val === undefined) return;
        if (!dayAssignments[dia]) dayAssignments[dia] = [];
        dayAssignments[dia].push({ rowIdx: o.index, value: val });
      });
    });

    console.log(`    Total days with any assignment: ${Object.keys(dayAssignments).length}`);
    const overlaps = Object.entries(dayAssignments).filter(([d, v]) => v.length > 1);
    if (overlaps.length > 0) {
      console.log(`    ⚠️ OVERLAPS FOUND:`);
      overlaps.forEach(([d, v]) => {
        console.log(`      Dia ${d}: ${JSON.stringify(v)}`);
      });
    } else {
      console.log(`    ✅ No overlaps! The assignments are complementary.`);
    }
  }
}
