import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function main() {
  const { data: puestos, error } = await sb.from('puestos').select('id, nombre, zona').ilike('nombre', '%disponible%');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Disponibles puestos in database:', puestos);
}

main();
