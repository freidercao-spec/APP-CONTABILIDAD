import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);

async function run() {
  const { data, error } = await sb.from('puestos').select('*').limit(1);
  console.log('Sample puesto:', data ? data[0] : null, 'Error:', error);
}

run().catch(console.error);
