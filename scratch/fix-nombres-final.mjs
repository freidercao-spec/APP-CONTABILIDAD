/**
 * FIX DEFINITIVO DE NOMBRES:
 * Guardar el nombre COMPLETO del Excel en el campo 'nombres'
 * y dejar 'apellidos' vacío. La app muestra: `${nombres} ${apellidos}`
 * que resultará en el nombre completo tal como viene del Excel.
 */
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

const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

// Extraer guardas únicos con nombre completo tal cual del Excel
const guardasExcel = new Map();
for (const puesto of excelData) {
  for (const guarda of puesto.guardas) {
    const ced = String(guarda.cedula).trim();
    if (ced && /^\d{5,}$/.test(ced) && !guardasExcel.has(ced)) {
      // Nombre completo EXACTAMENTE como está en el Excel (ya en mayúsculas)
      const nombreCompleto = guarda.nombre.trim().toUpperCase().replace(/\s+/g, ' ');
      guardasExcel.set(ced, nombreCompleto);
    }
  }
}

console.log(`Guardas del Excel: ${guardasExcel.size}`);
console.log('\nEjemplos:');
let cnt = 0;
for (const [ced, nom] of guardasExcel) {
  if (cnt++ < 8) console.log(`  CC:${ced} → "${nom}"`);
}

// Actualizar todos los vigilantes
const { data: vigsDB } = await sb
  .from('vigilantes')
  .select('id, cedula')
  .eq('empresa_id', EMPRESA_ID);

console.log(`\nVigilantes en BD: ${vigsDB?.length}`);

let updated = 0, notFound = 0;
for (const vig of (vigsDB || [])) {
  const ced = String(vig.cedula || '').trim();
  const nombreExcel = guardasExcel.get(ced);
  if (!nombreExcel) { notFound++; continue; }

  const { error } = await sb
    .from('vigilantes')
    .update({
      nombres: nombreExcel,   // nombre completo en 'nombres'
      apellidos: '',           // apellidos vacío
      nombre: nombreExcel,    // campo nombre también completo
    })
    .eq('id', vig.id);

  if (error) console.error(`  ❌ ${ced}: ${error.message}`);
  else updated++;
}

console.log(`\n✅ ${updated} vigilantes actualizados`);
console.log(`⚠️  ${notFound} no encontrados en Excel`);

// Verificación final - mostrar cómo los mostrará la app
const { data: final } = await sb
  .from('vigilantes')
  .select('codigo, nombres, apellidos, cedula')
  .eq('empresa_id', EMPRESA_ID)
  .order('codigo', { ascending: true })
  .limit(20);

console.log('\n=== COMO APARECERÁN EN LA APP (primeros 20) ===');
(final || []).forEach(v => {
  const enApp = `${v.nombres || ''} ${v.apellidos || ''}`.trim();
  console.log(`  [${v.codigo}] "${enApp}" | CC: ${v.cedula}`);
});
