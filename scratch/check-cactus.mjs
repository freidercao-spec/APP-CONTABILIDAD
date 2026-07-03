import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

// Find "EDIFICIO CACTUS 1" in Excel
const excelPuesto = excelData.find(p => p.cliente.includes('CACTUS 1') || p.cliente.includes('CACTUS'));
console.log('EXCEL Puesto name:', excelPuesto ? excelPuesto.cliente : 'NOT FOUND');
if (excelPuesto) {
  console.log('EXCEL Guardas:', excelPuesto.guardas.map(g => `${g.nombre} (CC:${g.cedula})`));
}

// Find Puesto in DB
const { data: puestoDB } = await sb.from('puestos').select('id,nombre').eq('empresa_id', EMPRESA_ID).ilike('nombre', '%CACTUS%');
console.log('DB Puestos matching CACTUS:', puestoDB);

if (puestoDB && puestoDB.length > 0) {
  const pId = puestoDB[0].id;
  // Get Monthly Programming
  const { data: prog } = await sb.from('programaciones_mensuales').select('id, personal').eq('puesto_id', pId).eq('anio', 2026).eq('mes', 5).maybeSingle();
  console.log('DB Programming:', prog);

  // Get Assignments
  const { data: asigs } = await sb.from('asignaciones_programacion').select('id, dia, rol, vigilante_id, vigilantes(nombres, cedula)').eq('programacion_id', prog.id);
  console.log(`DB Assignments Count: ${asigs?.length}`);
  // Let's print unique roles per day
  const rolePerDay = {};
  for (const asig of asigs || []) {
    const key = `${asig.dia}-${asig.rol}`;
    if (!rolePerDay[key]) rolePerDay[key] = [];
    rolePerDay[key].push(`${asig.vigilantes?.nombres} (CC:${asig.vigilantes?.cedula})`);
  }
  const duplicates = Object.entries(rolePerDay).filter(([k, v]) => v.length > 1);
  console.log('Duplicate roles per day:', duplicates);
  if (asigs && asigs.length > 0) {
    console.log('Sample assignments in DB:', asigs.slice(0, 10).map(a => `Dia ${a.dia} Rol ${a.rol}: ${a.vigilantes?.nombres}`));
  }
}
