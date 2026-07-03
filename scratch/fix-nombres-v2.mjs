/**
 * CORRECCIÓN FINAL DE NOMBRES: El Excel tiene formato "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2"
 * Necesitamos: apellidos = primeras 2 palabras, nombres = resto
 * La app muestra: `${nombres} ${apellidos}` en la UI
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

// Extraer guardas únicos preservando el formato original del Excel
const guardasExcel = new Map();
for (const puesto of excelData) {
  for (const guarda of puesto.guardas) {
    const ced = String(guarda.cedula).trim();
    if (ced && /^\d{5,}$/.test(ced) && !guardasExcel.has(ced)) {
      const fullName = guarda.nombre.trim();
      const partes = fullName.split(/\s+/).filter(Boolean);
      
      // El formato del Excel es: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
      // apellidos = primeras 2 palabras
      // nombres = resto
      // Para la app: mostrar "NOMBRE1 NOMBRE2 APELLIDO1 APELLIDO2"
      let apellidos, nombres;
      if (partes.length >= 3) {
        // Convencion colombia: 2 apellidos al inicio
        apellidos = partes.slice(0, 2).join(' ');
        nombres = partes.slice(2).join(' ');
      } else if (partes.length === 2) {
        apellidos = partes[0];
        nombres = partes[1];
      } else {
        apellidos = fullName;
        nombres = '';
      }
      
      guardasExcel.set(ced, { 
        apellidos: apellidos.toUpperCase(), 
        nombres: nombres.toUpperCase(),
        // nombre completo para el campo 'nombre' (apellidos + nombres como en el Excel)
        nombre: fullName.toUpperCase()
      });
    }
  }
}

console.log(`Guardas del Excel: ${guardasExcel.size}`);
console.log('\nEjemplos de separación:');
let count = 0;
for (const [ced, d] of guardasExcel) {
  if (count++ < 10) {
    console.log(`  CC:${ced} → apellidos="${d.apellidos}" nombres="${d.nombres}"`);
  }
}

// Actualizar en BD
const { data: vigsDB } = await sb
  .from('vigilantes')
  .select('id, cedula')
  .eq('empresa_id', EMPRESA_ID);

let updated = 0;
for (const vig of (vigsDB || [])) {
  const ced = String(vig.cedula || '').trim();
  const excelGuarda = guardasExcel.get(ced);
  if (!excelGuarda) continue;
  
  const { error } = await sb
    .from('vigilantes')
    .update({
      apellidos: excelGuarda.apellidos,
      nombres: excelGuarda.nombres,
      nombre: excelGuarda.nombre,
    })
    .eq('id', vig.id);
  
  if (error) console.error(`  ❌ ${ced}: ${error.message}`);
  else updated++;
}

console.log(`\n✅ ${updated} vigilantes actualizados`);

// Verificación final
const { data: final } = await sb
  .from('vigilantes')
  .select('codigo, nombres, apellidos, nombre, cedula')
  .eq('empresa_id', EMPRESA_ID)
  .order('codigo', { ascending: true })
  .limit(20);

console.log('\n=== RESULTADO FINAL (primeros 20) ===');
(final || []).forEach(v => {
  // La app construye el nombre como: `${nombres} ${apellidos}`  
  const nombreEnApp = `${v.nombres} ${v.apellidos}`.trim();
  console.log(`  [${v.codigo}] App: "${nombreEnApp}" | CC: ${v.cedula}`);
});
