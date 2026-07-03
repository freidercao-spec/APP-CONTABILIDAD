/**
 * VERIFICACIÓN CRUZADA: Excel vs Base de Datos
 * Compara día a día cada vigilante del Excel con lo que está en la BD
 * y reporta discrepancias si las hay.
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

function excelAJornada(codigo) {
  if (!codigo || codigo === '') return 'descanso_remunerado';
  const c = String(codigo).trim().toUpperCase();
  if (c === 'D12') return 'normal';
  if (c === 'D8')  return 'normal';
  if (c === 'D9')  return 'normal';
  if (c === 'D10') return 'normal';
  if (c === 'D14') return 'normal';
  if (c === 'N8')  return 'normal';
  if (c === 'N10') return 'normal';
  if (c === 'N12') return 'normal';
  if (c === 'N14') return 'normal';
  if (c === 'NR')  return 'descanso_no_remunerado';
  if (c === 'VAC' || c === 'VC') return 'vacaciones';
  if (c === 'INC' || c === 'IN') return 'incapacidad';
  if (c === 'CZ')  return 'capacitacion';
  if (c === 'SUP' || c === 'LC' || c === 'SP') return 'permiso';
  if (c === 'X')   return 'ausencia_no_justificada';
  if (c === 'DIS') return 'disponible';
  return 'descanso_remunerado';
}

function excelATurno(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (c.startsWith('N')) return 'PM';
  return 'AM';
}

function asignarRol(index) {
  const roles = ['titular_a', 'titular_b', 'relevante', 'suplente_a', 'suplente_b'];
  return roles[index] || `suplente_${index}`;
}

let totalOk = 0, totalError = 0, totalDias = 0;
const errores = [];

// Cargar puestos de ZONA 20 de BD
const { data: puestosDB } = await sb.from('puestos').select('id, nombre').eq('empresa_id', EMPRESA_ID).eq('zona', 'ZONA 20');

function normalizarNombre(nombre) {
  return (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similitud(a, b) {
  const na = normalizarNombre(a), nb = normalizarNombre(b);
  if (na === nb) return 1;

  // Extract all numbers from both strings
  const numA = na.match(/\d+/g) || [];
  const numB = nb.match(/\d+/g) || [];
  // If the numbers in both strings do not match exactly, the similarity should be 0!
  if (numA.join('-') !== numB.join('-')) {
    return 0;
  }

  const wa = new Set(na.split(' ')), wb = new Set(nb.split(' '));
  const comunes = [...wa].filter(w => w.length > 3 && wb.has(w));
  return comunes.length / Math.max(wa.size, wb.size);
}

function buscarPuesto(cliente) {
  let best = null, bestSim = 0;
  for (const p of puestosDB) {
    const s = similitud(cliente, p.nombre);
    if (s > bestSim) { bestSim = s; best = p; }
  }
  if (bestSim >= 0.6) return best;
  return null;
}

console.log('=== VERIFICACIÓN CRUZADA EXCEL vs BD ===\n');

for (const [pi, excelPuesto] of excelData.entries()) {
  const puestoDB = buscarPuesto(excelPuesto.cliente);
  if (!puestoDB) {
    console.log(`[${pi+1}] ❌ Puesto no encontrado: ${excelPuesto.cliente}`);
    continue;
  }

  // Obtener programación del mes
  const { data: prog } = await sb
    .from('programaciones_mensuales')
    .select('id, personal')
    .eq('puesto_id', puestoDB.id)
    .eq('anio', 2026)
    .eq('mes', 5)
    .maybeSingle();

  if (!prog) {
    console.log(`[${pi+1}] ❌ Sin programación en BD: ${excelPuesto.cliente}`);
    continue;
  }

  // Obtener asignaciones
  const { data: asigs } = await sb
    .from('asignaciones_programacion')
    .select('dia, jornada, turno, vigilante_id, rol, codigo_personalizado')
    .eq('programacion_id', prog.id);

  // Indexar asignaciones por vigilante_id + dia + rol
  const asigMap = new Map();
  for (const a of (asigs || [])) {
    asigMap.set(`${a.vigilante_id}-${a.dia}-${a.rol}`, a);
  }

  // Cargar vigilantes del personal
  const vigIds = (prog.personal || []).map(p => p.vigilanteId).filter(Boolean);
  const { data: vigs } = vigIds.length > 0
    ? await sb.from('vigilantes').select('id, cedula, nombres').in('id', vigIds)
    : { data: [] };
  const vigPorCedula = new Map();
  for (const v of (vigs || [])) vigPorCedula.set(String(v.cedula).trim(), v);

  let puestoOk = 0, puestoError = 0;
  const erroresPuesto = [];

  for (const [gi, guarda] of excelPuesto.guardas.entries()) {
    const ced = String(guarda.cedula).trim();
    const vigDB = vigPorCedula.get(ced);
    const rolEsperado = asignarRol(gi);

    if (!vigDB) {
      // Buscar por cédula en todos los vigilantes
      const { data: vigByCed } = await sb
        .from('vigilantes').select('id, cedula, nombres')
        .eq('empresa_id', EMPRESA_ID).eq('cedula', ced).maybeSingle();
      if (!vigByCed) {
        erroresPuesto.push(`  ❌ Vigilante no en BD: ${guarda.nombre} (CC:${ced})`);
        puestoError++;
        continue;
      }
      // Usar el encontrado globalmente
      for (const [dia, codigo] of Object.entries(guarda.dias)) {
        const diaNum = parseInt(dia);
        if (isNaN(diaNum) || diaNum > 30) continue;
        const asig = asigMap.get(`${vigByCed.id}-${diaNum}-${rolEsperado}`);
        if (!asig) {
          erroresPuesto.push(`  ❌ Día ${diaNum} FALTA en BD: ${guarda.nombre} CC:${ced} codigo=${codigo}`);
          puestoError++; totalError++;
        } else {
          const jornadaEsperada = excelAJornada(codigo);
          if (asig.jornada !== jornadaEsperada) {
            erroresPuesto.push(`  ❌ Día ${diaNum} JORNADA DIFF: ${guarda.nombre} CC:${ced} Excel=${codigo}(${jornadaEsperada}) BD=${asig.jornada}`);
            puestoError++; totalError++;
          } else {
            puestoOk++; totalOk++;
          }
        }
        totalDias++;
      }
      continue;
    }

    // Verificar cada día del guarda
    for (const [dia, codigo] of Object.entries(guarda.dias)) {
      const diaNum = parseInt(dia);
      if (isNaN(diaNum) || diaNum > 30) continue;

      totalDias++;
      const asig = asigMap.get(`${vigDB.id}-${diaNum}-${rolEsperado}`);

      if (!asig) {
        erroresPuesto.push(`  ❌ Día ${diaNum} FALTA: ${guarda.nombre} (CC:${ced}) código Excel=${codigo}`);
        puestoError++; totalError++;
      } else {
        const jornadaEsperada = excelAJornada(codigo);
        const turnoEsperado = excelATurno(codigo);
        let ok = asig.jornada === jornadaEsperada;
        // Para jornada normal, verificar turno AM/PM
        if (ok && jornadaEsperada === 'normal') {
          ok = asig.turno === turnoEsperado;
        }
        if (!ok) {
          erroresPuesto.push(`  ❌ Día ${diaNum}: ${guarda.nombre} CC:${ced} | Excel=${codigo}(${jornadaEsperada} ${turnoEsperado}) | BD=${asig.jornada} ${asig.turno}`);
          puestoError++; totalError++;
        } else {
          puestoOk++; totalOk++;
        }
      }
    }
  }

  if (erroresPuesto.length === 0) {
    console.log(`[${pi+1}] ✅ ${excelPuesto.cliente} — ${puestoOk} días CORRECTOS`);
  } else {
    console.log(`[${pi+1}] ⚠️  ${excelPuesto.cliente} — OK:${puestoOk} ERROR:${puestoError}`);
    erroresPuesto.slice(0, 5).forEach(e => console.log(e));
    if (erroresPuesto.length > 5) console.log(`  ... y ${erroresPuesto.length - 5} más`);
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`RESULTADO FINAL:`);
console.log(`  ✅ Días correctos en BD: ${totalOk}`);
console.log(`  ❌ Días con error:       ${totalError}`);
console.log(`  📊 Total días verificados: ${totalDias}`);
const pct = totalDias > 0 ? ((totalOk / totalDias) * 100).toFixed(1) : 0;
console.log(`  🎯 Precisión: ${pct}%`);
console.log(`${'═'.repeat(60)}`);
