import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

const excelPath = 'C:\\Users\\gdocumental\\Downloads\\CHATBOT\\PROGRAMACION\\APP-CONTABILIDAD\\PROGRAMACION DE JULIO\\JUNIO ZONA 20 - 2.xlsx';

async function compare() {
  console.log('Fetching database puestos...');
  const { data: dbPuestos } = await sb.from('puestos').select('id, nombre');
  console.log(`Fetched ${dbPuestos?.length || 0} puestos from DB.`);

  console.log('Fetching database vigilantes...');
  const { data: dbVigilantes } = await sb.from('vigilantes').select('id, nombre, cedula');
  console.log(`Fetched ${dbVigilantes?.length || 0} vigilantes from DB.`);

  // Map of DB puestos and vigilantes
  const dbPuestoMap = new Map();
  dbPuestos?.forEach(p => dbPuestoMap.set(p.nombre.trim().toUpperCase(), p));

  const dbVigMap = new Map();
  const dbVigCedulaMap = new Map();
  dbVigilantes?.forEach(v => {
    dbVigMap.set(v.nombre.trim().toUpperCase(), v);
    if (v.cedula) {
      dbVigCedulaMap.set(String(v.cedula).trim(), v);
    }
  });

  console.log('\nParsing Excel workbook...');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['JUNIO'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const excelPuestos = [];
  const excelGuards = [];

  let currentPuesto = null;
  let inGuardRows = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    
    const titleVal = row.find(val => typeof val === 'string' && val.includes('PROGRAMACION DE TURNOS'));
    if (titleVal) {
      inGuardRows = false;
      currentPuesto = null;
      continue;
    }

    const empresaIdx = row.findIndex(val => typeof val === 'string' && val.includes('EMPRESA / CLIENTE:'));
    if (empresaIdx !== -1) {
      const clientName = row[empresaIdx + 3] || row[empresaIdx + 2] || row[empresaIdx + 1];
      currentPuesto = clientName ? clientName.trim() : null;
      if (currentPuesto && !excelPuestos.includes(currentPuesto)) {
        excelPuestos.push(currentPuesto);
      }
      continue;
    }

    const cedulaIdx = row.findIndex(val => typeof val === 'string' && val.includes('CEDULA'));
    if (cedulaIdx !== -1) {
      inGuardRows = true;
      continue;
    }

    if (inGuardRows) {
      const cedula = row[5];
      const nombre = row[6];
      
      if (cedula && nombre && typeof nombre === 'string' && nombre.trim()) {
        const nUpper = nombre.toUpperCase();
        if (nUpper.includes('HORARIO') || nUpper.includes('TURNO') || nUpper.includes('DESCANSO') || nUpper.includes('DISPONIBLE') || nUpper.includes('APELLIDOS')) {
          continue;
        }
        
        excelGuards.push({
          cedula: String(cedula).trim(),
          nombre: nombre.trim(),
          puesto: currentPuesto
        });
      }
    }
  }

  console.log(`\nFound ${excelPuestos.length} unique puestos in Excel.`);
  console.log(`Found ${excelGuards.length} unique guards in Excel.`);

  console.log('\n--- Puesto Matching ---');
  let matchedPuestos = 0;
  excelPuestos.forEach(name => {
    const dbMatch = dbPuestoMap.get(name.toUpperCase());
    if (dbMatch) {
      matchedPuestos++;
    } else {
      console.log(`❌ No match in DB for Excel puesto: "${name}"`);
    }
  });
  console.log(`Matched ${matchedPuestos}/${excelPuestos.length} puestos.`);

  console.log('\n--- Guard Matching ---');
  let matchedGuards = 0;
  let unmatchedGuardsList = [];
  excelGuards.forEach(g => {
    // Try matching by cedula first, then by name
    const dbMatchByCedula = dbVigCedulaMap.get(g.cedula);
    const dbMatchByName = dbPuestoMap.get(g.nombre.toUpperCase()) || dbVigMap.get(g.nombre.toUpperCase());
    
    const dbMatch = dbMatchByCedula || dbMatchByName;

    if (dbMatch) {
      matchedGuards++;
    } else {
      unmatchedGuardsList.push(g);
    }
  });
  console.log(`Matched ${matchedGuards}/${excelGuards.length} guards.`);
  console.log(`Unmatched guards count: ${unmatchedGuardsList.length}`);
  if (unmatchedGuardsList.length > 0) {
    console.log('Unmatched guards sample:', unmatchedGuardsList.slice(0, 10).map(g => `${g.nombre} (Cedula: ${g.cedula}) - Puesto: ${g.puesto}`));
  }
}

compare().catch(err => console.error(err));
