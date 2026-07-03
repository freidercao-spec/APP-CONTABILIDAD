import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function main() {
  const { data, error } = await sb.from('asignaciones_programacion')
    .delete()
    .eq('rol', 'suplente_99');

  if (error) {
    console.error('Error cleaning up:', error);
  } else {
    console.log('Successfully cleaned up dummy row.');
  }
}

main().catch(console.error);
