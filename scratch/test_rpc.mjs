import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function testRpc() {
  console.log('Testing RPC exec_sql...');
  
  // 1. Try calling the rpc method with property name 'sql'
  const { data: data1, error: error1 } = await sb.rpc('exec_sql', { sql: 'SELECT 1 as result;' });
  if (error1) {
    console.error('❌ RPC exec_sql with { sql } error:', error1.message);
  } else {
    console.log('✅ RPC exec_sql with { sql } success! Result:', data1);
  }

  // 2. Try calling the rpc method with property name 'query' (as seen in seed-browser.html line 84)
  const { data: data2, error: error2 } = await sb.rpc('exec_sql', { query: 'SELECT 1 as result;' });
  if (error2) {
    console.error('❌ RPC exec_sql with { query } error:', error2.message);
  } else {
    console.log('✅ RPC exec_sql with { query } success! Result:', data2);
  }
}

testRpc();
