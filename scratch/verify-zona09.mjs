/**
 * CORAZA CTA — Verificación de Programación JUNIO 2026 (ZONA 09)
 * ================================================================
 * Verifica que los datos importados en Supabase coincidan con el Excel.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const ANO = 2026;
const MES_INDEX = 5;
const ZONA = 'ZONA 09';

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  CORAZA CTA — Verificación ZONA 09 Junio 2026            ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed_zona09.json'), 'utf-8'));

  // Cargar puestos de ZONA 09
  const { data: puestosZona } = await sb
    .from('puestos')
    .select('id, nombre, zona')
    .eq('empresa_id', EMPRESA_ID)
    .eq('zona', ZONA);

  console.log(`📦 Puestos en BD (${ZONA}): ${puestosZona.length}`);
  console.log(`📄 Puestos en Excel: ${excelData.length}\n`);

  // Cargar programaciones del mes
  const { data: programaciones } = await sb
    .from('programaciones_mensuales')
    .select('id, puesto_id')
    .eq('empresa_id', EMPRESA_ID)
    .eq('anio', ANO)
    .eq('mes', MES_INDEX)
    .in('puesto_id', puestosZona.map(p => p.id));

  console.log(`📋 Programaciones en BD: ${programaciones.length}`);

  if (programaciones.length === 0) {
    console.log('❌ No se encontraron programaciones. ¿Se ejecutó el seeder?');
    return;
  }

  // Cargar asignaciones
  const progIds = programaciones.map(p => p.id);
  let totalAsigs = 0;
  for (const progId of progIds) {
    const { count } = await sb
      .from('asignaciones_programacion')
      .select('*', { count: 'exact', head: true })
      .eq('programacion_id', progId);
    totalAsigs += count || 0;
  }
  console.log(`📊 Total asignaciones en BD: ${totalAsigs}`);

  // Calcular asignaciones esperadas desde Excel
  let expectedAsigs = 0;
  for (const puesto of excelData) {
    for (const guarda of puesto.guardas) {
      expectedAsigs += Object.keys(guarda.dias).length;
    }
  }
  console.log(`📊 Total asignaciones esperadas (Excel): ${expectedAsigs}`);

  const matchRate = ((totalAsigs / expectedAsigs) * 100).toFixed(1);
  console.log(`\n🎯 Tasa de coincidencia: ${matchRate}%`);

  // Verificar por puesto
  console.log('\n' + '─'.repeat(70));
  console.log('DETALLE POR PUESTO:');
  console.log('─'.repeat(70));

  const puestoMap = new Map(puestosZona.map(p => [p.id, p.nombre]));
  const progMap = new Map(programaciones.map(p => [p.puesto_id, p.id]));

  let puestosOK = 0, puestosFail = 0;
  for (const excelPuesto of excelData) {
    const nombreExcel = excelPuesto.cliente;
    const puestoDB = puestosZona.find(p => 
      p.nombre.toLowerCase().includes(nombreExcel.toLowerCase().substring(0, 8)) ||
      nombreExcel.toLowerCase().includes(p.nombre.toLowerCase().substring(0, 8))
    );

    if (!puestoDB) {
      console.log(`  ❌ NO ENCONTRADO: ${nombreExcel}`);
      puestosFail++;
      continue;
    }

    const progId = progMap.get(puestoDB.id);
    if (!progId) {
      console.log(`  ⚠️  SIN PROGRAMACIÓN: ${nombreExcel}`);
      puestosFail++;
      continue;
    }

    const { count: asigCount } = await sb
      .from('asignaciones_programacion')
      .select('*', { count: 'exact', head: true })
      .eq('programacion_id', progId);

    const expectedDias = excelPuesto.guardas.reduce((sum, g) => sum + Object.keys(g.dias).length, 0);
    const ok = (asigCount || 0) === expectedDias;
    if (ok) puestosOK++; else puestosFail++;
    console.log(`  ${ok ? '✅' : '⚠️ '} ${nombreExcel.padEnd(35)} BD: ${(asigCount || 0).toString().padStart(3)} | Excel: ${expectedDias.toString().padStart(3)}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`RESUMEN:`);
  console.log(`  ✅ Puestos OK: ${puestosOK}`);
  console.log(`  ❌ Puestos con problemas: ${puestosFail}`);
  console.log(`  📊 Asignaciones en BD: ${totalAsigs} / ${expectedAsigs} esperadas`);
  console.log(`  🎯 Precisión: ${matchRate}%`);
  console.log('═'.repeat(70) + '\n');
}

main().catch(e => {
  console.error('\n💥 ERROR FATAL:', e.message);
  process.exit(1);
});
