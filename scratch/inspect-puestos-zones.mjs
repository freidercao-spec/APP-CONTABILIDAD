import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const { data: puestos, error } = await sb.from('puestos').select('id, nombre, zona').eq('empresa_id', EMPRESA_ID).ilike('nombre', '%disponible%');
if (error) {
  console.error('Error fetching puestos:', error.message);
} else {
  console.log('All DISPONIBLES puestos in database:', puestos);
}
