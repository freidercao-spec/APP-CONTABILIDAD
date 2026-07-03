import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);

async function run() {
  const ids = [
    '0dc4a298-94bb-4355-8a81-82f99da492d0',
    'fe121735-0a2d-40f7-b240-a8a40c00214e',
    '2e43fd7f-7539-444c-9827-80cd422e8870'
  ];

  const { data: puestos, error } = await sb.from('puestos')
    .select('id, nombre, zona, codigo')
    .in('id', ids);

  console.log('Puestos details:', puestos, 'Error:', error);
}

run().catch(console.error);
