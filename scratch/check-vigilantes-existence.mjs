import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'ZONA 07 JUNIO', 'JUNIO  ZONA 07.xlsx');

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const guardsInExcel = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const c6 = row.getCell(6).value;
    const c7 = row.getCell(7).value;
    const s6 = String(c6 || '').trim();
    if (s6 && /^\d+$/.test(s6)) {
      guardsInExcel.push({ cedula: s6, nombre: String(cellValue(c7)).trim() });
    }
  }

  function cellValue(val) {
    if (val && typeof val === 'object' && val.result !== undefined) return val.result;
    return val || '';
  }

  console.log(`Loaded ${guardsInExcel.length} guards from ZONA 07 Excel.`);

  // Cargar vigilantes de Supabase
  const { data: vigilantesDB, error: vErr } = await sb
    .from('vigilantes')
    .select('id, nombres, apellidos, cedula');
  if (vErr) {
    console.error('Error fetching vigilantes:', vErr);
    return;
  }

  console.log(`Found ${vigilantesDB.length} vigilantes in database.`);

  const matchCount = guardsInExcel.filter(ge => 
    vigilantesDB.some(vd => String(vd.cedula).trim() === ge.cedula)
  ).length;

  console.log(`Matched ${matchCount} of ${guardsInExcel.length} guards in database by Cédula.`);

  // Let's query recent assignments for matched vigilantes to see what puestos they were assigned to in May 2026!
  const matchedCedulas = guardsInExcel.map(g => g.cedula);
  const matchedVigIds = vigilantesDB
    .filter(vd => matchedCedulas.includes(String(vd.cedula).trim()))
    .map(vd => vd.id);

  if (matchedVigIds.length > 0) {
    console.log('\nQuerying past assignments for these vigilantes...');
    // Query assignments for mes = 4 (May) or mes = 5 (June) or any month
    const { data: asigs, error: aErr } = await sb
      .from('asignaciones_programacion')
      .select('vigilante_id, rol, programacion_id, programaciones_mensuales(puesto_id, puestos(nombre))')
      .in('vigilante_id', matchedVigIds.slice(0, 100)); // Limit to first 100 to avoid long query

    if (aErr) {
      console.error('Error fetching past assignments:', aErr);
      return;
    }

    console.log(`Found ${asigs?.length || 0} assignments.`);
    const vigToPuesto = new Map();
    asigs?.forEach(a => {
      const puestoNombre = a.programaciones_mensuales?.puestos?.nombre;
      const vig = vigilantesDB.find(v => v.id === a.vigilante_id);
      const name = `${vig.apellidos || ''} ${vig.nombres || ''}`.trim();
      if (puestoNombre) {
        vigToPuesto.set(name, puestoNombre);
      }
    });

    console.log('\n--- Past Vigilante Puesto Assignments (Sample) ---');
    for (const [vigName, puestoName] of vigToPuesto.entries()) {
      console.log(`Vigilante: "${vigName}" -> Puesto: "${puestoName}"`);
    }
  }
}

main().catch(console.error);
