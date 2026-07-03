import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const ANO = 2026;
const MES_INDEX = 5;
const ZONA = 'ZONA 04';

async function main() {
  console.log(`🔍 Cargando datos de verificación para ${ZONA}...`);
  const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed_zona04.json'), 'utf-8'));

  // 1. Agrupar asignaciones de Excel por cédula del guarda
  const excelGuards = new Map();
  for (const puesto of excelData) {
    for (const g of puesto.guardas) {
      const ced = String(g.cedula);
      if (!excelGuards.has(ced)) {
        excelGuards.set(ced, { nombre: g.nombre, dias: new Set() });
      }
      const existing = excelGuards.get(ced);
      for (const d of Object.keys(g.dias)) {
        existing.dias.add(parseInt(d, 10));
      }
    }
  }

  // 2. Obtener puestos de ZONA 04 en la BD
  const { data: puestosZona, error: pErr } = await sb
    .from('puestos')
    .select('id, nombre')
    .eq('empresa_id', EMPRESA_ID)
    .eq('zona', ZONA);

  if (pErr) {
    console.error('❌ Error cargando puestos:', pErr.message);
    return;
  }

  const puestoIds = puestosZona.map(p => p.id);
  console.log(`📦 Puestos de ZONA 04 en la BD: ${puestoIds.length}`);

  // 3. Obtener programaciones de ZONA 04 para Junio 2026
  const { data: progs, error: prErr } = await sb
    .from('programaciones_mensuales')
    .select('id, puesto_id')
    .eq('empresa_id', EMPRESA_ID)
    .eq('anio', ANO)
    .eq('mes', MES_INDEX)
    .in('puesto_id', puestoIds);

  if (prErr) {
    console.error('❌ Error cargando programaciones:', prErr.message);
    return;
  }

  const progIds = progs.map(p => p.id);
  console.log(`📋 Programaciones de ZONA 04 en la BD: ${progIds.length}`);

  if (progIds.length === 0) {
    console.log('❌ No hay programaciones cargadas para esta zona.');
    return;
  }

  // 4. Obtener TODAS las asignaciones de ZONA 04 para estas programaciones (paginado por si supera 1000)
  let dbAsigs = [];
  let page = 0;
  while (true) {
    const { data: batch, error: aErr } = await sb
      .from('asignaciones_programacion')
      .select('vigilante_id, dia, programacion_id')
      .in('programacion_id', progIds)
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (aErr) {
      console.error('❌ Error cargando asignaciones:', aErr.message);
      return;
    }
    if (!batch || batch.length === 0) break;
    dbAsigs.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }

  console.log(`📊 Total asignaciones registradas en BD para ZONA 04: ${dbAsigs.length}`);

  // 5. Cargar mapeo de vigilante_id a cédula
  const { data: vigilantes, error: vErr } = await sb
    .from('vigilantes')
    .select('id, cedula, nombre')
    .eq('empresa_id', EMPRESA_ID);

  if (vErr) {
    console.error('❌ Error cargando vigilantes:', vErr.message);
    return;
  }

  const vigIdToCedula = new Map(vigilantes.map(v => [v.id, String(v.cedula).trim()]));
  const vigCedulaToName = new Map(vigilantes.map(v => [String(v.cedula).trim(), v.nombre]));

  // 6. Agrupar asignaciones de la BD por cédula del vigilante
  const dbGuards = new Map();
  for (const asig of dbAsigs) {
    const ced = vigIdToCedula.get(asig.vigilante_id);
    if (!ced) continue;

    if (!dbGuards.has(ced)) {
      dbGuards.set(ced, { dias: new Set() });
    }
    dbGuards.get(ced).dias.add(asig.dia);
  }

  // 7. Comparar
  let totalExcel = 0;
  let totalDb = 0;
  let mismatches = 0;

  console.log('\n' + '─'.repeat(70));
  console.log('COMPARACIÓN DETALLADA POR VIGILANTE:');
  console.log('─'.repeat(70));

  for (const [ced, gExcel] of excelGuards.entries()) {
    const gDb = dbGuards.get(ced);
    const excelCount = gExcel.dias.size;
    const dbCount = gDb ? gDb.dias.size : 0;

    totalExcel += excelCount;
    totalDb += dbCount;

    if (excelCount !== dbCount) {
      mismatches++;
      console.log(`⚠️  DIFERENCIA - Cédula: ${ced.padEnd(12)} | Nombre: ${gExcel.nombre.padEnd(35)} | BD: ${dbCount} días | Excel: ${excelCount} días`);
      
      const dbDays = gDb ? Array.from(gDb.dias).sort((a,b)=>a-b) : [];
      const excelDays = Array.from(gExcel.dias).sort((a,b)=>a-b);

      const missingInDb = excelDays.filter(d => !gDb || !gDb.dias.has(d));
      const extraInDb = dbDays.filter(d => !gExcel.dias.has(d));

      if (missingInDb.length > 0) console.log(`     - Faltan en BD días: ${missingInDb.join(', ')}`);
      if (extraInDb.length > 0) console.log(`     - Sobran en BD días: ${extraInDb.join(', ')}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('RESUMEN DE PRECISIÓN POR ASIGNACIÓN (ZONA 04):');
  console.log(`  📊 Asignaciones esperadas (Excel): ${totalExcel}`);
  console.log(`  📊 Asignaciones reales (BD):     ${totalDb}`);
  console.log(`  ❌ Vigilantes con diferencias:    ${mismatches}`);
  console.log(`  🎯 Tasa de Coincidencia:         ${((totalDb / totalExcel) * 100).toFixed(2)}%`);
  console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);
