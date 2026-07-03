import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');

const { data: users, error } = await sb.from('usuarios').select('*');
if (error) {
  console.error('Error fetching users:', error.message);
} else {
  console.log('Users in database:', users);
}
