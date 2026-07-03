import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');

const tables = [
  'programacion_mensual',
  'programaciones_mensuales', 
  'programaciones',
  'programacion',
  'asignaciones_dia',
  'asignaciones',
  'personal_puesto',
  'personal_puestos',
  'puestos',
  'vigilantes',
];

for (const t of tables) {
  const r = await sb.from(t).select('id').limit(1);
  if (r.error) {
    console.log(`❌ ${t}: ${r.error.message}`);
  } else {
    console.log(`✅ ${t}: OK, filas=${r.data?.length}`);
  }
}
