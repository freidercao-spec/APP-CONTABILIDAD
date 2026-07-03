/**
 * AUDITORÍA: Verificar que los datos cargados son correctos
 * y que la app puede leerlos bien
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

// Verificar primer puesto cargado
const { data: progs } = await sb
  .from('programaciones_mensuales')
  .select('id, puesto_id, anio, mes, estado, personal')
  .eq('empresa_id', EMPRESA_ID)
  .eq('anio', 2026)
  .eq('mes', 5)
  .limit(5);

console.log('=== PROGRAMACIONES MES JUNIO (mes=5) ===');
for (const p of (progs || [])) {
  // Get puesto name
  const { data: puesto } = await sb.from('puestos').select('nombre').eq('id', p.puesto_id).single();
  console.log(`\nPuesto: ${puesto?.nombre}`);
  console.log(`ID Prog: ${p.id}`);
  console.log(`Estado: ${p.estado}`);
  console.log(`Personal (${p.personal?.length || 0} roles):`);
  (p.personal || []).slice(0, 5).forEach(per => {
    console.log(`  rol=${per.rol}  vigilanteId=${per.vigilanteId}`);
  });

  // Get asignaciones for this prog
  const { data: asigs, error: asigErr } = await sb
    .from('asignaciones_programacion')
    .select('dia, rol, jornada, turno, inicio, fin, vigilante_id')
    .eq('programacion_id', p.id)
    .order('dia', { ascending: true })
    .limit(10);

  if (asigErr) {
    console.log(`  ❌ Error asignaciones: ${asigErr.message}`);
  } else {
    console.log(`\n  Primeras ${asigs?.length} asignaciones:`);
    (asigs || []).forEach(a => {
      console.log(`  Día ${a.dia}: ${a.jornada} ${a.turno} ${a.inicio || ''}-${a.fin || ''} vigId=${a.vigilante_id} rol=${a.rol}`);
    });
  }

  // Verify vigilante IDs match
  const vigIds = (p.personal || []).map(x => x.vigilanteId).filter(Boolean);
  if (vigIds.length > 0) {
    const { data: vigs } = await sb
      .from('vigilantes')
      .select('id, nombres, apellidos, cedula')
      .in('id', vigIds.slice(0, 3));
    console.log(`\n  Vigilantes del personal:`);
    (vigs || []).forEach(v => {
      console.log(`    ${v.apellidos} ${v.nombres} (CC:${v.cedula}) id=${v.id}`);
    });
  }
  break; // Solo primer puesto para no llenar pantalla
}

// Count total
const { count } = await sb
  .from('asignaciones_programacion')
  .select('*', { count: 'exact', head: true })
  .in('programacion_id', (progs || []).map(p => p.id));

console.log(`\n=== TOTAL ASIGNACIONES PARA ESTOS 5 PUESTOS: ${count} ===`);
