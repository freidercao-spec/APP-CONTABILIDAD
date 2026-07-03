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

async function main() {
  const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed_zona23.json'), 'utf-8'));
  const excelPuestos = excelData.map(p => p.cliente.trim());

  const { data: dbPuestos, error } = await sb
    .from('puestos')
    .select('id, nombre, zona')
    .eq('empresa_id', EMPRESA_ID)
    .eq('zona', 'ZONA 23');

  if (error) {
    console.error('Error fetching puestos:', error);
    process.exit(1);
  }

  const dbNames = dbPuestos.map(p => p.nombre.trim());

  console.log('=== VERIFICACIÓN DE PUESTOS EN BD (ZONA 23) ===\n');
  console.log(`Puestos en Excel: ${excelPuestos.length}`);
  console.log(`Puestos en BD (ZONA 23): ${dbPuestos.length}\n`);

  let faltantes = 0;
  for (const ep of excelPuestos) {
    if (!dbNames.includes(ep)) {
      console.log(`❌ Puesto de Excel NO ESTÁ en ZONA 23 de la BD: "${ep}"`);
      faltantes++;
    }
  }

  let extra = 0;
  for (const dp of dbNames) {
    if (!excelPuestos.includes(dp)) {
      console.log(`⚠️  Puesto en ZONA 23 de la BD que no está en este Excel de Junio: "${dp}"`);
      extra++;
    }
  }

  if (faltantes === 0) {
    console.log('✅ ¡Todos los puestos del Excel existen en la base de datos bajo la ZONA 23!');
  } else {
    console.log(`❌ Faltan ${faltantes} puestos.`);
  }
}

main().catch(console.error);
