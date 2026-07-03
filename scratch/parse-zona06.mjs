import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 06 JUNIO', 'JUNIO - ZONA 06.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log(`Parsing sheet "${sheet.name}" (${sheet.rowCount} rows)...`);

  const puestosMap = new Map();
  let lastPuesto = '';

  for (let r = 8; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);

    const puestoVal = row.getCell(3).value; // Column C
    const cedulaVal = row.getCell(4).value; // Column D
    const nombreVal = row.getCell(5).value; // Column E
    const zonaVal = row.getCell(6).value;   // Column F

    const pName = puestoVal ? String(puestoVal).trim().toUpperCase() : '';
    const gName = nombreVal ? String(nombreVal).trim().toUpperCase() : '';
    const gCed = cedulaVal ? String(cedulaVal).trim().replace(/[^\d]/g, '') : '';

    // Skip empty rows and headers
    if (pName.includes('PUESTO') || pName.includes('ULTIMA') || pName.includes('NIT.') || pName.includes('CUADRANTE') || pName.includes('TOTAL') || pName.includes('PENDIENTE')) {
      continue;
    }
    if (gName.includes('NOMBRE DE GUARDA') || gName.includes('PROGRAMACIÓN') || gName.includes('DISPONIBLE') || gName === '') {
      continue;
    }

    // Update lastPuesto if we hit a new valid puesto (not RELEVANTE)
    if (pName && pName !== 'RELEVANTE') {
      const cleanP = pName.replace(/\s+/g, ' ').trim();
      if (cleanP === 'RONDA' && lastPuesto.toUpperCase().includes('VISTA APARTAMIRADOR')) {
        lastPuesto = 'VISTA APARTAMIRADOR RONDA';
      } else {
        lastPuesto = String(puestoVal).trim();
      }
    }

    if (gName && gCed && /^\d+$/.test(gCed)) {
      if (!lastPuesto) {
        console.warn(`⚠️ Row ${r}: Guard without puesto: "${gName}" (CC: ${gCed})`);
        continue;
      }

      const cleanPuesto = lastPuesto.replace(/\s+/g, ' ').trim();

      if (!puestosMap.has(cleanPuesto)) {
        puestosMap.set(cleanPuesto, {
          cliente: cleanPuesto,
          puesto: 'PORTERIA',
          direccion: '',
          guardas: []
        });
      }
      const puestoBlock = puestosMap.get(cleanPuesto);

      // Extract days 1 to 30 (from Column G to AJ)
      const dias = {};
      for (let d = 1; d <= 30; d++) {
        const cell = row.getCell(6 + d); // Column G is cell 7
        const val = cell.value;
        if (val !== null && val !== undefined && val !== '') {
          dias[d] = String(val).trim();
        }
      }

      puestoBlock.guardas.push({
        cedula: parseInt(gCed, 10),
        nombre: String(nombreVal).trim(),
        anio: 2026,
        mes: 5, // June = index 5 (0-based)
        dias,
        totalDia: 0,
        totalNoche: 0,
        totalDescansos: 0
      });
    }
  }

  const puestos = Array.from(puestosMap.values());
  const totalGuards = puestos.reduce((acc, p) => acc + p.guardas.length, 0);
  console.log(`Parsed ${puestos.length} puestos and ${totalGuards} guard rows.`);

  writeFileSync(path.join(__dirname, 'excel_parsed_zona06.json'), JSON.stringify(puestos, null, 2));
  console.log('Saved to scratch/excel_parsed_zona06.json');
}

main().catch(console.error);
