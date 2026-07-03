/**
 * CORAZA CTA — Corrección de Códigos NULL
 * =====================================
 * Asigna códigos secuenciales C-XXXX a los vigilantes que tienen el código en NULL.
 */

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);

async function main() {
  console.log('🔍 Buscando vigilantes con código NULL...');

  // 1. Obtener todos los vigilantes con código NULL
  const { data: nullGuards, error: gErr } = await sb
    .from('vigilantes')
    .select('id, nombre, nombres, apellidos, cedula')
    .is('codigo', null);

  if (gErr) {
    console.error('❌ Error cargando vigilantes:', gErr.message);
    return;
  }

  console.log(`📋 Se encontraron ${nullGuards.length} vigilantes con código NULL.`);

  if (nullGuards.length === 0) {
    console.log('✅ Todos los vigilantes tienen código asignado.');
    return;
  }

  // 2. Obtener el máximo código existente
  const { data: allGuards, error: aErr } = await sb
    .from('vigilantes')
    .select('codigo')
    .not('codigo', 'is', null);

  if (aErr) {
    console.error('❌ Error obteniendo códigos:', aErr.message);
    return;
  }

  const codes = allGuards.map(d => {
    const m = d.codigo.match(/C-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });

  const startNumber = Math.max(...codes, 0) + 1;
  console.log(`🚀 Asignando códigos comenzando desde C-${String(startNumber).padStart(4, '0')}...`);

  // 3. Actualizar secuencialmente
  let updatedCount = 0;
  for (let i = 0; i < nullGuards.length; i++) {
    const guard = nullGuards[i];
    const nextNum = startNumber + i;
    const newCode = `C-${String(nextNum).padStart(4, '0')}`;
    const name = guard.nombre || `${guard.nombres || ''} ${guard.apellidos || ''}`.trim() || 'VIGILANTE NUEVO';

    console.log(`   👮 [${i + 1}/${nullGuards.length}] ${name} (CC: ${guard.cedula}) -> ${newCode}`);

    const { error: uErr } = await sb
      .from('vigilantes')
      .update({ codigo: newCode, nombre: name })
      .eq('id', guard.id);

    if (uErr) {
      console.error(`   ❌ Error actualizando ${name}:`, uErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`\n🎉 Proceso completado. Se actualizaron ${updatedCount} vigilantes.`);
}

main().catch(e => {
  console.error('\n💥 ERROR FATAL:', e.message);
  process.exit(1);
});
