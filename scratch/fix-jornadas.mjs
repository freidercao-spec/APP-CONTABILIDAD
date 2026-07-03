/**
 * CORRECCIÓN: Ajustar jornadas no estándar en asignaciones_programacion
 * La app solo acepta estos valores de jornada:
 *   'normal', 'descanso_remunerado', 'descanso_no_remunerado', 'vacacion', 'sin_asignar'
 *
 * Mapeo de corrección:
 *   vacaciones → vacacion
 *   incapacidad → vacacion (con codigo_personalizado='IN' y prefijo ESTADO:IN| en inicio)
 *   capacitacion → vacacion (con codigo_personalizado='CZ')
 *   permiso → vacacion (con codigo_personalizado='SP')
 *   ausencia_no_justificada → sin_asignar (con codigo_personalizado='X')
 *   disponible → descanso_remunerado
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

// Obtener todos los IDs de programaciones de junio 2026
const { data: progs } = await sb
  .from('programaciones_mensuales')
  .select('id')
  .eq('empresa_id', EMPRESA_ID)
  .eq('anio', 2026)
  .eq('mes', 5);

if (!progs || progs.length === 0) {
  console.log('No hay programaciones de junio 2026');
  process.exit(0);
}

const progIds = progs.map(p => p.id);
console.log(`Programaciones a revisar: ${progIds.length}`);

// Primero ver qué jornadas no estándar existen
const { data: nonStandard } = await sb
  .from('asignaciones_programacion')
  .select('id, jornada, inicio, fin, codigo_personalizado')
  .in('programacion_id', progIds)
  .not('jornada', 'in', '("normal","descanso_remunerado","descanso_no_remunerado","vacacion","sin_asignar")');

console.log(`Registros con jornada no estándar: ${nonStandard?.length || 0}`);

// Agrupar por jornada
const byJornada = {};
(nonStandard || []).forEach(r => {
  if (!byJornada[r.jornada]) byJornada[r.jornada] = 0;
  byJornada[r.jornada]++;
});
console.log('Por jornada:', JSON.stringify(byJornada, null, 2));

// Si hay registros no estándar, corregirlos
if ((nonStandard || []).length > 0) {
  console.log('\nCorrigiendo...');
  
  const JORNADA_MAP = {
    'vacaciones': { jornada: 'vacacion', code: 'VAC' },
    'incapacidad': { jornada: 'vacacion', code: 'IN' },
    'capacitacion': { jornada: 'vacacion', code: 'CZ' },
    'permiso': { jornada: 'vacacion', code: 'SP' },
    'ausencia_no_justificada': { jornada: 'sin_asignar', code: 'X' },
    'disponible': { jornada: 'descanso_remunerado', code: null },
  };

  for (const rec of (nonStandard || [])) {
    const mapping = JORNADA_MAP[rec.jornada];
    if (!mapping) {
      console.log(`  ⚠️  Jornada desconocida: ${rec.jornada} (id=${rec.id})`);
      continue;
    }

    const newInicio = mapping.code 
      ? `ESTADO:${mapping.code}|${rec.inicio || '06:00'}`
      : rec.inicio;

    const { error } = await sb
      .from('asignaciones_programacion')
      .update({
        jornada: mapping.jornada,
        codigo_personalizado: mapping.code,
        inicio: newInicio,
      })
      .eq('id', rec.id);

    if (error) {
      console.error(`  ❌ Error actualizando ${rec.id}: ${error.message}`);
    }
  }
  console.log(`  ✅ ${nonStandard.length} registros corregidos`);
}

// Verificación final
const { count: total } = await sb
  .from('asignaciones_programacion')
  .select('*', { count: 'exact', head: true })
  .in('programacion_id', progIds);

console.log(`\n✅ Total asignaciones en BD para junio 2026: ${total}`);

// Muestra una programación de ejemplo
const { data: sample } = await sb
  .from('asignaciones_programacion')
  .select('dia, jornada, turno, inicio, fin, rol, vigilante_id, codigo_personalizado')
  .eq('programacion_id', progIds[0])
  .order('dia', { ascending: true })
  .limit(15);

console.log('\nEjemplo (primeros 15 días del primer puesto):');
(sample || []).forEach(a => {
  const code = a.codigo_personalizado ? `[${a.codigo_personalizado}]` : '';
  console.log(`  Día ${String(a.dia).padStart(2)}: ${a.jornada.padEnd(24)} ${a.turno} ${a.inicio || '    '}-${a.fin || '    '} rol=${a.rol} ${code}`);
});
