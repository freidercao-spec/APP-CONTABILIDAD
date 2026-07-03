import { createClient } from '@supabase/supabase-js';

const credentials = [
  {
    name: 'New Supabase (ykchpbqkjvmnddndkvno)',
    url: 'https://ykchpbqkjvmnddndkvno.supabase.co',
    key: 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
  },
  {
    name: 'Old Supabase (ylcpizjfwupfvffsbjmz)',
    url: 'https://ylcpizjfwupfvffsbjmz.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE'
  }
];

async function testAll() {
  for (const cred of credentials) {
    console.log(`\n=== Testing ${cred.name} ===`);
    try {
      const client = createClient(cred.url, cred.key);
      
      console.log('Testing table: puestos...');
      const { data: puestos, error: pError } = await client.from('puestos').select('id, nombre').limit(2);
      if (pError) {
        console.error('  puestos error:', pError.message);
      } else {
        console.log('  puestos success:', puestos);
      }

      console.log('Testing table: programacion_mensual...');
      const { data: progs, error: prError } = await client.from('programacion_mensual').select('id').limit(2);
      if (prError) {
        console.error('  programacion_mensual error:', prError.message);
      } else {
        console.log('  programacion_mensual success:', progs);
      }
      
      console.log('Testing table: programaciones_mensuales...');
      const { data: progsM, error: prMError } = await client.from('programaciones_mensuales').select('id').limit(2);
      if (prMError) {
        console.error('  programaciones_mensuales error:', prMError.message);
      } else {
        console.log('  programaciones_mensuales success:', progsM);
      }

    } catch (e) {
      console.error('  Exception:', e);
    }
  }
}

testAll();
