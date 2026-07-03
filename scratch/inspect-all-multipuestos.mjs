import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const tables = sheet.model.tables || [];
  console.log(`Found ${tables.length} tables in model.\n`);

  for (const t of tables) {
    const range = t.tableRef; // e.g., "A39:AQ47"
    const startRow = parseInt(range.split(':')[0].match(/\d+/)[0]);
    const endRow = parseInt(range.split(':')[1].match(/\d+/)[0]);

    // Find all puesto headers between the end of the previous table (or row 1) and startRow
    const prevEnd = getPrevTableEnd(tables, t);
    const puestos = [];
    for (let r = prevEnd + 1; r < startRow; r++) {
      const cell6 = sheet.getRow(r).getCell(6);
      const val = cell6.value;
      if (val && typeof val === 'string') {
        const s = val.trim().toUpperCase();
        if (s && !s.includes('CEDULA') && !s.includes('CLIENTE') && !s.includes('PROGRAMACION') && !s.includes('EMPRESA') && !s.includes('NIT') && !s.includes('DIRECCION') && !s.includes('TELEFONO') && !s.includes('VIGENCIA') && !s.includes('EDICION') && !s.includes('CODIGO') && !s.includes('TURNOS')) {
          if (!puestos.includes(s)) {
            puestos.push(s);
          }
        }
      }
    }

    // Find guards in this table range
    const guards = [];
    for (let r = startRow + 1; r <= endRow; r++) {
      const row = sheet.getRow(r);
      const c6 = row.getCell(6).value;
      const c7 = row.getCell(7).value;
      const s6 = String(c6 || '').trim();
      const s7 = String(c7 || '').trim();
      if (s6 && /^\d+$/.test(s6)) {
        // Get values in columns AR:AV (Col 44 to 48)
        const times = [];
        for (let c = 44; c <= 48; c++) {
          const val = row.getCell(c).value;
          if (val) {
            times.push(`Col${c}:${formatVal(val)}`);
          }
        }
        guards.push({ row: r, cedula: s6, nombre: s7, times: times.join(', ') });
      }
    }

    console.log(`Table: "${t.name}" | Range: ${range}`);
    console.log(`  Puestos: ${JSON.stringify(puestos)}`);
    console.log(`  Guards (${guards.length}):`);
    guards.forEach(g => {
      console.log(`    Row ${g.row}: "${g.nombre}" (CC: ${g.cedula}) | Extra: [${g.times}]`);
    });
    console.log();
  }
}

function formatVal(val) {
  if (val instanceof Date) {
    return val.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (val && typeof val === 'object' && val.result !== undefined) {
    return formatVal(val.result);
  }
  return String(val);
}

function getPrevTableEnd(tables, currentTable) {
  let prevEnd = 0;
  for (const t of tables) {
    if (t.name === currentTable.name) break;
    const endRow = parseInt(t.tableRef.split(':')[1].match(/\d+/)[0]);
    if (endRow > prevEnd && endRow < parseInt(currentTable.tableRef.split(':')[0].match(/\d+/)[0])) {
      prevEnd = endRow;
    }
  }
  return prevEnd;
}

main().catch(console.error);
