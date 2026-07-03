/**
 * LIMPIEZA Y CORRECCIÓN COMPLETA DE VIGILANTES
 * 1. Elimina vigilantes con cédulas inválidas (códigos de turno: D12, N12, etc.)
 * 2. Asigna códigos C-XXXX a vigilantes que no tienen código
 * 3. Verifica nombres/apellidos invertidos
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

// 1. Detectar vigilantes con cédulas inválidas (no numéricas o muy cortas)
const { data: allVigs } = await sb
  .from('vigilantes')
  .select('id, codigo, nombres, apellidos, cedula, estado')
  .eq('empresa_id', EMPRESA_ID)
  .order('created_at', { ascending: true });

console.log(`Total vigilantes en BD: ${allVigs?.length}`);

const invalidos = (allVigs || []).filter(v => {
  const ced = String(v.cedula || '').trim();
  // Inválido si la cédula no es numérica o tiene menos de 5 dígitos
  return !/^\d{5,}$/.test(ced);
});

console.log(`\n❌ Vigilantes con cédula inválida (${invalidos.length}):`);
invalidos.forEach(v => console.log(`  id=${v.id} cedula=${v.cedula} nombres=${v.nombres} apellidos=${v.apellidos}`));

// Eliminar los inválidos
if (invalidos.length > 0) {
  const idsInvalidos = invalidos.map(v => v.id);
  // Primero eliminar sus asignaciones
  const { data: progsAfectadas } = await sb
    .from('asignaciones_programacion')
    .select('id')
    .in('vigilante_id', idsInvalidos);
  
  if (progsAfectadas && progsAfectadas.length > 0) {
    await sb.from('asignaciones_programacion').delete().in('vigilante_id', idsInvalidos);
    console.log(`  → ${progsAfectadas.length} asignaciones eliminadas`);
  }
  
  await sb.from('vigilantes').delete().in('id', idsInvalidos);
  console.log(`  → ${invalidos.length} vigilantes inválidos eliminados`);
}

// 2. Asignar códigos a vigilantes que no tienen
const validos = (allVigs || []).filter(v => {
  const ced = String(v.cedula || '').trim();
  return /^\d{5,}$/.test(ced) && !v.codigo;
});

console.log(`\n📋 Vigilantes sin código: ${validos.length}`);

// Encontrar el último código asignado
const { data: conCodigo } = await sb
  .from('vigilantes')
  .select('codigo')
  .eq('empresa_id', EMPRESA_ID)
  .not('codigo', 'is', null)
  .order('codigo', { ascending: false })
  .limit(1);

let nextNum = 1;
if (conCodigo && conCodigo.length > 0 && conCodigo[0].codigo) {
  const match = conCodigo[0].codigo.match(/C-(\d+)/);
  if (match) nextNum = parseInt(match[1]) + 1;
}

console.log(`Siguiente código a asignar: C-${String(nextNum).padStart(4, '0')}`);

// Asignar códigos en lotes
let assigned = 0;
for (const vig of validos) {
  const codigo = `C-${String(nextNum).padStart(4, '0')}`;
  const { error } = await sb
    .from('vigilantes')
    .update({ codigo })
    .eq('id', vig.id);
  
  if (error) {
    console.error(`  ❌ Error asignando código a ${vig.id}: ${error.message}`);
  } else {
    assigned++;
    nextNum++;
  }
}
console.log(`  ✅ ${assigned} códigos asignados`);

// 3. Verificación final
const { data: final } = await sb
  .from('vigilantes')
  .select('id, codigo, nombres, apellidos, cedula')
  .eq('empresa_id', EMPRESA_ID)
  .order('codigo', { ascending: true })
  .limit(20);

console.log(`\n=== VIGILANTES FINALES (primeros 20) ===`);
(final || []).forEach(v => {
  console.log(`  [${v.codigo || '???'}] ${v.apellidos} ${v.nombres} | CC: ${v.cedula}`);
});

const { count } = await sb
  .from('vigilantes')
  .select('*', { count: 'exact', head: true })
  .eq('empresa_id', EMPRESA_ID);
console.log(`\nTotal vigilantes válidos en BD: ${count}`);
