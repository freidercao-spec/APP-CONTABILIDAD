import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');

// Get the programacion record to find related table names
const { data: prog } = await sb.from('programaciones_mensuales').select('*').limit(1).single();
console.log('programaciones_mensuales sample:', JSON.stringify(prog, null, 2));

// Try variations for related tables
const moreTableNames = [
  'asignaciones_diarias',
  'asignacion_dia',
  'dias_programacion',
  'programacion_dias',
  'personal_programacion',
  'programacion_personal',
  'guardas_puesto',
];

for (const t of moreTableNames) {
  const r = await sb.from(t).select('id').limit(1);
  if (r.error) {
    console.log(`❌ ${t}: ${r.error.message.substring(0, 60)}`);
  } else {
    console.log(`✅ ${t}: OK, filas=${r.data?.length}`);
  }
}
