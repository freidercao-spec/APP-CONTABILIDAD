import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function inspect() {
  // Let's get the list of columns for vigilantes by attempting to insert an empty object or query it
  const { data, error } = await sb.from('vigilantes').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Vigilantes sample:', data);
  }
}

inspect();
