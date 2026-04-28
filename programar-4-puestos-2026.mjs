/**
 * CORAZA CTA — Programación Masiva 4 Puestos · 12 Meses 2026
 * ===========================================================
 * Ciclo de 18 días (invariable, no se reinicia al cambiar mes):
 *   Pos  0-5  → DIURNO   (D)  · jornada: normal, turno: AM  (06:00-18:00)
 *   Pos  6-7  → DESCANSO (DR) · jornada: descanso_remunerado
 *   Pos  8    → DESCANSO (NR) · jornada: descanso_no_remunerado
 *   Pos  9-14 → NOCTURNO (N)  · jornada: normal, turno: PM  (18:00-06:00)
 *   Pos 15-16 → DESCANSO (DR) · jornada: descanso_remunerado
 *   Pos 17    → DESCANSO (NR) · jornada: descanso_no_remunerado
 *              ↓ vuelve a Pos 0
 */

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ylcpizjfwupfvffsbjmz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

// ─── CICLO DE 18 DÍAS ──────────────────────────────────────────────────────────
const CICLO = [
  // FASE DIURNA: pos 0-5 → 6 días D (06:00-18:00)
  { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' },
  { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' },
  { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' },
  { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' },
  { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' },
  { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' },
  // DESCANSO POST-DIURNO: pos 6-7 → 2 DR
  { jornada: 'descanso_remunerado',    turno: 'AM', inicio: null, fin: null },
  { jornada: 'descanso_remunerado',    turno: 'AM', inicio: null, fin: null },
  // DESCANSO NR: pos 8 → 1 NR
  { jornada: 'descanso_no_remunerado', turno: 'AM', inicio: null, fin: null },
  // FASE NOCTURNA: pos 9-14 → 6 días N (18:00-06:00)
  { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' },
  { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' },
  { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' },
  { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' },
  { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' },
  { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' },
  // DESCANSO POST-NOCTURNO: pos 15-16 → 2 DR
  { jornada: 'descanso_remunerado',    turno: 'PM', inicio: null, fin: null },
  { jornada: 'descanso_remunerado',    turno: 'PM', inicio: null, fin: null },
  // DESCANSO NR: pos 17 → 1 NR
  { jornada: 'descanso_no_remunerado', turno: 'PM', inicio: null, fin: null },
];
const CICLO_LEN = CICLO.length; // 18

// ─── PUESTOS A PROGRAMAR ───────────────────────────────────────────────────────
// Los roles se escalonan para garantizar cobertura diurna y nocturna simultánea
const PUESTOS_CONFIG = [
  {
    codigo: 'PST-0001', nombre_match: 'Clínica San Juan de Dios', zona: 'Zona Norte',
    roles: [
      { rol: 'titular_a', posInicio: 0  },   // empieza en D (día 1 de fase diurna)
      { rol: 'titular_b', posInicio: 9  },   // empieza en N (día 1 de fase nocturna)
      { rol: 'relevante', posInicio: 6  },   // empieza en DR (reserva)
    ]
  },
  {
    codigo: 'PST-0002', nombre_match: 'Central Cotraza', zona: 'Zona Centro',
    roles: [
      { rol: 'titular_a', posInicio: 0  },
      { rol: 'titular_b', posInicio: 9  },
      { rol: 'relevante', posInicio: 6  },
    ]
  },
  {
    codigo: 'PST-0003', nombre_match: 'Torre Empresarial Buenavista', zona: 'Zona Sur',
    roles: [
      { rol: 'titular_a', posInicio: 0  },
      { rol: 'titular_b', posInicio: 9  },
      { rol: 'relevante', posInicio: 15 },
    ]
  },
  {
    codigo: 'PST-0004', nombre_match: 'Plaza Madeira', zona: 'Zona 20',
    roles: [
      { rol: 'titular_a', posInicio: 0  },
      { rol: 'titular_b', posInicio: 9  },
      { rol: 'relevante', posInicio: 6  },
    ]
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const diasEnMes = (anio, mes) => new Date(anio, mes + 1, 0).getDate();
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function diaGlobalDesdeAnio(anio, mes, dia) {
  let total = 0;
  for (let m = 0; m < mes; m++) total += diasEnMes(anio, m);
  return total + (dia - 1);
}

function getPosEnCiclo(posInicio, diaGlobal) {
  return (posInicio + diaGlobal) % CICLO_LEN;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  CORAZA CTA — Programación 4 Puestos · 2026         ║');
  console.log('║  Ciclo: 6D → 2DR → 1NR → 6N → 2DR → 1NR (18 días) ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // 1. Cargar puestos de BD
  const { data: puestosDB } = await sb.from('puestos')
    .select('id, nombre, codigo')
    .eq('empresa_id', EMPRESA_ID);

  console.log(`📦 Puestos en BD: ${puestosDB?.length || 0}`);
  puestosDB?.forEach(p => console.log(`   → [${p.codigo || '?'}] ${p.nombre}`));

  // 2. Cargar vigilantes (usar nombres/apellidos correctos)
  const { data: vigilantesDB } = await sb.from('vigilantes')
    .select('id, nombres, apellidos, cedula, empresa_id')
    .eq('empresa_id', EMPRESA_ID)
    .eq('estado', 'activo')
    .limit(100);

  const vigArr = (vigilantesDB || []).map(v => ({
    id: v.id,
    nombre: `${v.apellidos || ''} ${v.nombres || ''}`.trim() || 'SIN NOMBRE',
    cedula: v.cedula || '—',
  }));

  console.log(`\n👮 Vigilantes activos: ${vigArr.length}`);
  vigArr.slice(0, 6).forEach(v => console.log(`   → ${v.nombre} (${v.cedula})`));
  if (vigArr.length > 6) console.log(`   ... y ${vigArr.length - 6} más`);

  let totalProg = 0;
  let totalAsigs = 0;

  // 3. Iterar puestos
  for (const [pi, pConfig] of PUESTOS_CONFIG.entries()) {
    console.log(`\n${'─'.repeat(58)}`);
    console.log(`📌 [${pi+1}/4] ${pConfig.nombre_match}  ·  ${pConfig.zona}`);
    console.log(`${'─'.repeat(58)}`);

    const puestoDB = puestosDB?.find(p =>
      p.codigo === pConfig.codigo ||
      p.nombre?.toLowerCase().includes(pConfig.nombre_match.toLowerCase().split(' ')[0].toLowerCase())
    );

    if (!puestoDB) {
      console.warn(`⚠️  No encontrado en BD: ${pConfig.codigo} / ${pConfig.nombre_match}`);
      continue;
    }
    console.log(`   → DB ID: ${puestoDB.id}`);

    // Asignar vigilantes a roles (con personas reales si existen)
    const rolesConVigilantes = pConfig.roles.map((r, i) => {
      const vIdx = (pi * 3 + i) % Math.max(vigArr.length, 1);
      const vig = vigArr[vIdx] || null;
      return { ...r, vigId: vig?.id || null, vigNombre: vig?.nombre || 'SIN ASIGNAR' };
    });

    console.log(`   Personal:`);
    rolesConVigilantes.forEach(r => {
      console.log(`     • ${r.rol.padEnd(12)} (pos ${String(r.posInicio).padStart(2,'0')}) → ${r.vigNombre}`);
    });

    // 4. Programar mes a mes
    for (let mes = 0; mes < 12; mes++) {
      const diasMes = diasEnMes(2026, mes);

      // 4a. Upsert cabecera programación
      const { data: progData, error: progErr } = await sb
        .from('programacion_mensual')
        .upsert({
          puesto_id: puestoDB.id,
          anio: 2026,
          mes,
          empresa_id: EMPRESA_ID,
          estado: 'publicado',
          version: 1,
        }, { onConflict: 'puesto_id,anio,mes' })
        .select('id')
        .single();

      if (progErr || !progData) {
        console.error(`  ❌ ${MESES[mes]}: ${progErr?.message}`);
        continue;
      }
      const progId = progData.id;

      // 4b. Upsert personal
      const personalRows = rolesConVigilantes
        .filter(r => r.vigId)
        .map(r => ({ programacion_id: progId, vigilante_id: r.vigId, rol: r.rol }));

      if (personalRows.length > 0) {
        await sb.from('personal_puesto')
          .delete()
          .eq('programacion_id', progId);
        await sb.from('personal_puesto').insert(personalRows);
      }

      // 4c. Generar asignaciones con el ciclo
      const asignaciones = [];
      for (let dia = 1; dia <= diasMes; dia++) {
        const diaGlobal = diaGlobalDesdeAnio(2026, mes, dia);
        for (const rol of rolesConVigilantes) {
          const pos = getPosEnCiclo(rol.posInicio, diaGlobal);
          const turno = CICLO[pos];
          asignaciones.push({
            programacion_id: progId,
            vigilante_id: rol.vigId,
            rol: rol.rol,
            dia,
            turno: turno.turno,
            jornada: turno.jornada,
            inicio: turno.inicio || null,
            fin: turno.fin || null,
          });
        }
      }

      // 4d. Reemplazar asignaciones
      await sb.from('asignaciones_dia').delete().eq('programacion_id', progId);

      for (let k = 0; k < asignaciones.length; k += 500) {
        const { error: aErr } = await sb.from('asignaciones_dia').insert(asignaciones.slice(k, k + 500));
        if (aErr) console.error(`  ❌ Asigs ${MESES[mes]}:`, aErr.message);
      }

      totalProg++;
      totalAsigs += asignaciones.length;
      process.stdout.write(`  ✓ ${MESES[mes]} (${diasMes}d · ${asignaciones.length} asigs)  `);
    }
    console.log();
  }

  console.log(`\n${'═'.repeat(58)}`);
  console.log(`🚀 PROGRAMACIÓN COMPLETADA`);
  console.log(`   ✅ ${totalProg} meses programados`);
  console.log(`   ✅ ${totalAsigs} asignaciones insertadas`);
  console.log(`   📋 Ciclo: 6D(AM 06-18) → 2DR → 1NR → 6N(PM 18-06) → 2DR → 1NR`);
  console.log(`${'═'.repeat(58)}\n`);
}

main().catch(e => {
  console.error('\n💥 ERROR FATAL:', e.message);
  process.exit(1);
});
