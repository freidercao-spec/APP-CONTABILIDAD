import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');

// Check asignaciones_programacion structure
const r = await sb.from('asignaciones_programacion').select('*').limit(2);
if (r.error) {
  console.log('❌ asignaciones_programacion:', r.error.message);
} else {
  console.log('✅ asignaciones_programacion OK, filas:', r.data?.length);
  if (r.data?.[0]) {
    console.log('Claves:', Object.keys(r.data[0]).join(', '));
    console.log('Muestra:', JSON.stringify(r.data[0], null, 2));
  }
}
