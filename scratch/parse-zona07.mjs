import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

function cellString(cell) {
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val.result !== undefined) {
    return String(val.result).trim();
  }
  return String(val).trim();
}

function cellInt(cell) {
  const s = cellString(cell);
  return parseInt(s.replace(/[^\d]/g, '')) || 0;
}

function isDiurno(code) {
  if (!code) return false;
  const c = String(code).trim().toUpperCase();
  return ['D12', 'D8', 'D9', 'D10', 'D14', 'AM'].includes(c);
}

function isNocturno(code) {
  if (!code) return false;
  const c = String(code).trim().toUpperCase();
  return ['N12', 'N8', 'N10', 'N13', 'N14', 'PM'].includes(c);
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  console.log(`Parsing sheet "${sheet.name}"...`);

  // Get and sort tables by start row
  const rawTables = sheet.model.tables || [];
  const tables = rawTables.map(t => {
    const range = t.tableRef;
    const startRow = parseInt(range.split(':')[0].match(/\d+/)[0]);
    const endRow = parseInt(range.split(':')[1].match(/\d+/)[0]);
    return { name: t.name, startRow, endRow };
  }).sort((a, b) => a.startRow - b.startRow);

  console.log(`Found ${tables.length} tables in model.`);

  const blocks = [];

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    
    // Determine the search range for preceding puesto headers
    const prevEnd = i === 0 ? 0 : tables[i - 1].endRow;
    const puestos = [];
    for (let r = prevEnd + 1; r < t.startRow; r++) {
      const cell6 = sheet.getRow(r).getCell(6);
      const val = cellString(cell6).trim().toUpperCase();
      if (val && !/^\d+$/.test(val) && !val.includes('CEDULA') && !val.includes('CLIENTE') && !val.includes('PROGRAMACION') && !val.includes('EMPRESA') && !val.includes('NIT') && !val.includes('DIRECCION') && !val.includes('TELEFONO') && !val.includes('VIGENCIA') && !val.includes('EDICION') && !val.includes('CODIGO') && !val.includes('TURNOS') && !val.includes('LOS TURNOS') && !val.includes('Permanezca') && !val.includes('Esta programación')) {
        if (!puestos.includes(val)) {
          puestos.push(val);
        }
      }
    }

    // Determine the row range where guards for this block can exist
    // It starts at startRow + 1, and goes up to the start of the next table's header search range (or sheet.rowCount for the last table)
    let maxGuardRow = sheet.rowCount;
    if (i < tables.length - 1) {
      // The next table's search range for puestos starts at tables[i].endRow + 1.
      // So the next table's headers can start anywhere from tables[i].endRow + 1 to tables[i+1].startRow.
      // Let's find where the first puesto header of the next table is actually located.
      let nextPuestoStartRow = tables[i + 1].startRow;
      for (let r = t.endRow + 1; r < tables[i + 1].startRow; r++) {
        const cell6 = sheet.getRow(r).getCell(6);
        const val = cellString(cell6).trim().toUpperCase();
        if (val && !/^\d+$/.test(val) && !val.includes('CEDULA') && !val.includes('CLIENTE') && !val.includes('PROGRAMACION') && !val.includes('EMPRESA') && !val.includes('NIT') && !val.includes('DIRECCION') && !val.includes('TELEFONO') && !val.includes('VIGENCIA') && !val.includes('EDICION') && !val.includes('CODIGO') && !val.includes('TURNOS') && !val.includes('LOS TURNOS') && !val.includes('Permanezca') && !val.includes('Esta programación')) {
          nextPuestoStartRow = r;
          break;
        }
      }
      maxGuardRow = nextPuestoStartRow - 1;
    }

    const guards = [];
    for (let r = t.startRow + 1; r <= maxGuardRow; r++) {
      const row = sheet.getRow(r);
      const c6 = cellString(row.getCell(6));
      const c7 = cellString(row.getCell(7));

      if (c6 && /^\d+$/.test(c6)) {
        const cedula = cellInt(row.getCell(6));
        const nombre = c7.trim();
        const dias = {};
        for (let d = 1; d <= 30; d++) {
          const val = cellString(row.getCell(9 + d)); // Day 1 is Col 10
          if (val !== '') {
            dias[d] = val;
          }
        }
        guards.push({ cedula, nombre, row: r, dias });
      }
    }

    if (puestos.length > 0 && guards.length > 0) {
      blocks.push({ puestos, guards, tableName: t.name });
    } else {
      console.log(`Skipped table "${t.name}" because it has puestos=[${puestos.join(',')}] and guards=${guards.length}`);
    }
  }

  console.log(`\nProcessed ${blocks.length} active grid blocks:`);
  
  const finalPuestosMap = new Map();

  for (const block of blocks) {
    const { puestos, guards, tableName } = block;
    console.log(`Block Table: "${tableName}" | Puestos: ${JSON.stringify(puestos)} | Guards count: ${guards.length}`);

    puestos.forEach(pName => {
      if (!finalPuestosMap.has(pName)) {
        finalPuestosMap.set(pName, {
          cliente: pName,
          puesto: 'PORTERIA',
          direccion: '',
          guardas: []
        });
      }
    });

    const guardEntriesForPuestos = new Map();
    puestos.forEach(pName => {
      guards.forEach(g => {
        const key = `${pName}_${g.cedula}_${g.row}`; // Include row to differentiate duplicate rows if any
        const entry = {
          cedula: g.cedula,
          nombre: g.nombre,
          row: g.row,
          anio: 2026,
          mes: 5,
          dias: {},
          totalDia: 0,
          totalNoche: 0,
          totalDescansos: 0
        };
        guardEntriesForPuestos.set(key, entry);
        finalPuestosMap.get(pName).guardas.push(entry);
      });
    });

    for (let d = 1; d <= 30; d++) {
      const diurnos = [];
      const nocturnos = [];
      const others = [];

      guards.forEach(g => {
        const code = g.dias[d];
        if (isDiurno(code)) {
          diurnos.push(g);
        } else if (isNocturno(code)) {
          nocturnos.push(g);
        } else {
          others.push(g);
        }
      });

      const dActive = diurnos.slice(0, puestos.length);
      const nActive = nocturnos.slice(0, puestos.length);

      const extra = [
        ...diurnos.slice(puestos.length),
        ...nocturnos.slice(puestos.length),
        ...others
      ];

      for (let i = 0; i < puestos.length; i++) {
        const pName = puestos[i];
        const g = dActive[i];
        if (g) {
          const key = `${pName}_${g.cedula}_${g.row}`;
          guardEntriesForPuestos.get(key).dias[d] = g.dias[d];
        }
      }

      for (let i = 0; i < puestos.length; i++) {
        const pName = puestos[i];
        const g = nActive[i];
        if (g) {
          const key = `${pName}_${g.cedula}_${g.row}`;
          guardEntriesForPuestos.get(key).dias[d] = g.dias[d];
        }
      }

      let extraIdx = 0;
      for (const g of extra) {
        const pIdx = extraIdx % puestos.length;
        const pName = puestos[pIdx];
        const key = `${pName}_${g.cedula}_${g.row}`;
        if (g.dias[d] !== undefined) {
          guardEntriesForPuestos.get(key).dias[d] = g.dias[d];
        }
        extraIdx++;
      }
    }
  }

  // Clean empty guard records (guards with no assignments at all for a particular puesto)
  const finalPuestosList = Array.from(finalPuestosMap.values()).map(p => {
    p.guardas = p.guardas.filter(g => Object.keys(g.dias).length > 0);
    // Remove the temporary row key from the final JSON structure
    p.guardas.forEach(g => delete g.row);
    return p;
  });

  const totalGuardsCount = finalPuestosList.reduce((acc, p) => acc + p.guardas.length, 0);
  console.log(`\nParsed ${finalPuestosList.length} puestos and ${totalGuardsCount} guard assignments.`);

  const outputPath = path.join(__dirname, 'excel_parsed_zona07.json');
  writeFileSync(outputPath, JSON.stringify(finalPuestosList, null, 2));
  console.log(`Saved JSON output to ${outputPath}`);
}

main().catch(console.error);
