/**
 * CORRECCIÓN FINAL: Actualizar nombres y apellidos de vigilantes
 * El Excel tiene formato: "APELLIDOS NOMBRES" (2 apellidos + 1-2 nombres)
 * La app muestra: `${nombres} ${apellidos}` → necesitamos separar correctamente
 * 
 * Estrategia: Usar los datos del Excel parseado para hacer el match por cédula
 * y actualizar nombres/apellidos correctamente
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

// Cargar datos del Excel
const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed.json'), 'utf-8'));

// Extraer todos los guardas únicos por cédula
const guardasExcel = new Map();
for (const puesto of excelData) {
  for (const guarda of puesto.guardas) {
    const ced = String(guarda.cedula).trim();
    if (ced && /^\d{5,}$/.test(ced) && !guardasExcel.has(ced)) {
      // El Excel tiene formato "APELLIDOS NOMBRES" (todo en mayúsculas)
      // La convención colombiana: primero apellidos, luego nombres
      const fullName = guarda.nombre.trim().toUpperCase();
      const partes = fullName.split(/\s+/).filter(Boolean);
      
      // Intentar separar: 2 apellidos + resto son nombres
      // Si hay 4+ palabras: primeras 2 = apellidos, resto = nombres
      // Si hay 3 palabras: primera 1 = apellidos, resto = nombres  
      // Si hay 2 palabras: primera = apellido, segunda = nombre
      let apellidos, nombres;
      if (partes.length >= 4) {
        apellidos = partes.slice(0, 2).join(' ');
        nombres = partes.slice(2).join(' ');
      } else if (partes.length === 3) {
        apellidos = partes[0];
        nombres = partes.slice(1).join(' ');
      } else if (partes.length === 2) {
        apellidos = partes[0];
        nombres = partes[1];
      } else {
        apellidos = fullName;
        nombres = '';
      }
      
      guardasExcel.set(ced, { apellidos, nombres, fullName });
    }
  }
}

console.log(`Guardas únicos del Excel: ${guardasExcel.size}`);

// Cargar vigilantes de la BD
const { data: vigsDB } = await sb
  .from('vigilantes')
  .select('id, cedula, nombres, apellidos, nombre')
  .eq('empresa_id', EMPRESA_ID);

console.log(`Vigilantes en BD: ${vigsDB?.length}`);

let updated = 0, notFound = 0;

for (const vig of (vigsDB || [])) {
  const ced = String(vig.cedula || '').trim();
  const excelData2 = guardasExcel.get(ced);
  
  if (!excelData2) {
    notFound++;
    continue;
  }
  
  // Solo actualizar si los datos difieren
  if (vig.apellidos !== excelData2.apellidos || vig.nombres !== excelData2.nombres) {
    const { error } = await sb
      .from('vigilantes')
      .update({
        apellidos: excelData2.apellidos,
        nombres: excelData2.nombres,
        nombre: excelData2.fullName,
      })
      .eq('id', vig.id);
    
    if (error) {
      console.error(`  ❌ Error ${vig.id}: ${error.message}`);
    } else {
      updated++;
    }
  }
}

console.log(`\n✅ ${updated} vigilantes actualizados`);
console.log(`⚠️  ${notFound} sin match en Excel`);

// Muestra resultado
const { data: final } = await sb
  .from('vigilantes')
  .select('codigo, nombres, apellidos, cedula')
  .eq('empresa_id', EMPRESA_ID)
  .order('codigo', { ascending: true })
  .limit(15);

console.log('\nVigilantes actualizados (primeros 15):');
(final || []).forEach(v => {
  const nombre = `${v.nombres} ${v.apellidos}`.trim();
  console.log(`  [${v.codigo}] Nombre: "${nombre}" | CC: ${v.cedula}`);
});
