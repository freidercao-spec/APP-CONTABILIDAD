import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';

const filePath = 'ZONA 13 JUNIO/JUNIO-ZONA 13.xlsx';
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);
const sheet = workbook.worksheets[0];

console.log(`Parsing ZONA 13 sheet: "${sheet.name}"...`);

const puestosMap = new Map();
let lastPuesto = '';

for (let r = 8; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r);
  
  const puestoVal = row.getCell(3).value; // Column C
  const cedulaVal = row.getCell(8).value; // Column H
  const nombreVal = row.getCell(9).value; // Column I
  const zonaVal = row.getCell(10).value;  // Column J

  const pName = puestoVal ? String(puestoVal).trim().toUpperCase() : '';
  const gName = nombreVal ? String(nombreVal).trim().toUpperCase() : '';
  const gCed = cedulaVal ? String(cedulaVal).trim() : '';

  if (pName.includes('PUESTO') || pName.includes('ULTIMA') || pName.includes('NIT.') || pName.includes('CUADRANTE')) {
    continue;
  }
  if (gName.includes('NOMBRE DE GUARDA') || gName.includes('PROGRAMACIÓN') || gName.includes('DISPONIBLE')) {
    continue;
  }

  if (pName && pName !== 'RELEVANTE') {
    lastPuesto = String(puestoVal).trim();
  }

  if (gName && /^\d+$/.test(gCed)) {
    if (!lastPuesto) {
      console.warn(`⚠️ Row ${r}: Guard without puesto: "${gName}"`);
      continue;
    }

    if (!puestosMap.has(lastPuesto)) {
      puestosMap.set(lastPuesto, {
        cliente: lastPuesto,
        puesto: 'PORTERIA',
        direccion: '',
        guardas: []
      });
    }
    const puestoBlock = puestosMap.get(lastPuesto);

    // Extract days 1 to 31
    const dias = {};
    for (let d = 1; d <= 31; d++) {
      const cell = row.getCell(10 + d); // Day 1 is Column 11 (K)
      const val = cell.value;
      if (val !== null && val !== undefined && val !== '') {
        dias[d] = String(val).trim();
      }
    }

    puestoBlock.guardas.push({
      cedula: parseInt(gCed),
      nombre: String(nombreVal).trim(),
      anio: 2026,
      mes: 5, // June is index 5
      dias,
      totalDia: 0,
      totalNoche: 0,
      totalDescansos: 0
    });
  }
}

const puestos = Array.from(puestosMap.values());
console.log(`Parsed ${puestos.length} puestos and ${puestos.reduce((acc, p) => acc + p.guardas.length, 0)} guard rows.`);

writeFileSync('scratch/excel_parsed_zona13.json', JSON.stringify(puestos, null, 2));
console.log('Saved to scratch/excel_parsed_zona13.json');
