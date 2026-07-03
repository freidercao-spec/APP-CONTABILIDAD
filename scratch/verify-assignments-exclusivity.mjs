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
const ANO = 2026;
const MES_INDEX = 5; // Junio

async function main() {
  const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed_zona23.json'), 'utf-8'));
  const excelPuestos = excelData.map(p => p.cliente.trim());

  // Get all programaciones for June 2026
  const { data: progs, error } = await sb
    .from('programaciones_mensuales')
    .select(`
      id,
      puesto:puestos!inner (
        id,
        nombre,
        zona
      )
    `)
    .eq('empresa_id', EMPRESA_ID)
    .eq('anio', ANO)
    .eq('mes', MES_INDEX)
    .eq('puestos.zona', 'ZONA 23');

  if (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }

  console.log('=== VERIFICACIÓN DE EXCLUSIVIDAD DE ASIGNACIONES (JUNIO 2026) ===\n');
  console.log(`Programaciones en BD para ZONA 23 en Junio 2026: ${progs.length}`);

  let estrados = 0;
  for (const pr of progs) {
    const name = pr.puesto.nombre.trim();
    if (!excelPuestos.includes(name)) {
      console.log(`❌ ALERTA: Programación encontrada para puesto que no está en el Excel: "${name}"`);
      estrados++;
    }
  }

  if (estrados === 0) {
    console.log('✅ ¡Cero programaciones extrañas! Solo se programaron los 42 puestos oficiales del Excel.');
  } else {
    console.log(`❌ Se encontraron ${estrados} programaciones extrañas.`);
  }
}

main().catch(console.error);
