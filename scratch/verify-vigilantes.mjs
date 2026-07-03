import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

// Verificar estructura de la tabla vigilantes
const { data: v } = await sb.from('vigilantes').select('*').limit(2);
console.log('Claves de vigilantes:', Object.keys(v?.[0] || {}));
console.log('Muestra vigilante 1:');
console.log(JSON.stringify(v?.[0], null, 2));

// Verificar si los vigilantes tienen 'codigo'
const { data: conCodigo } = await sb
  .from('vigilantes')
  .select('id, nombres, apellidos, cedula, codigo')
  .eq('empresa_id', EMPRESA_ID)
  .limit(5);

console.log('\nVigilantes con codigo:');
(conCodigo || []).forEach(v => {
  console.log(`  ${v.apellidos} ${v.nombres} | cedula=${v.cedula} | codigo=${v.codigo} | id=${v.id}`);
});

// Verificar las asignaciones de Edificio 808
const { data: prog } = await sb
  .from('programaciones_mensuales')
  .select('id, puesto_id, personal')
  .eq('anio', 2026)
  .eq('mes', 5)
  .limit(1)
  .single();

console.log('\nProgId:', prog?.id);
console.log('Personal JSON:', JSON.stringify(prog?.personal?.slice(0, 3), null, 2));

// Ver asignaciones con sus vigilanteIds
const { data: asigs } = await sb
  .from('asignaciones_programacion')
  .select('dia, rol, jornada, turno, inicio, vigilante_id')
  .eq('programacion_id', prog?.id)
  .order('dia')
  .limit(8);

console.log('\nAsignaciones con vigilante_id:');
for (const a of (asigs || [])) {
  // Lookup vigilante
  if (a.vigilante_id) {
    const { data: vig } = await sb.from('vigilantes').select('id, nombres, apellidos, cedula, codigo').eq('id', a.vigilante_id).single();
    console.log(`  Día ${a.dia} ${a.jornada} ${a.turno} → ${vig?.apellidos} ${vig?.nombres} (cod=${vig?.codigo}) cedula=${vig?.cedula}`);
  }
}
