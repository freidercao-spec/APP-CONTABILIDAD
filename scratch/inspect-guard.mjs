import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const TARGET_CC = '15259158';

async function main() {
  const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed_zona23.json'), 'utf-8'));
  console.log('Searching in Excel:');
  for (const ep of excelData) {
    for (const g of ep.guardas) {
      if (String(g.cedula).trim() === TARGET_CC) {
        console.log(`- Excel Puesto: "${ep.cliente}" -> Guard: "${g.nombre}" (CC: ${g.cedula})`);
      }
    }
  }

  console.log('\nSearching in DB:');
  const { data: byCed } = await sb.from('vigilantes').select('*').eq('empresa_id', EMPRESA_ID).eq('cedula', TARGET_CC);
  console.log('By CC:', byCed);

  const { data: byName } = await sb.from('vigilantes').select('*').eq('empresa_id', EMPRESA_ID).ilike('nombres', '%MARIN%');
  console.log('By Name like MARIN:', byName.map(v => `${v.nombres} ${v.apellidos} (CC: ${v.cedula})`));
}
main();
