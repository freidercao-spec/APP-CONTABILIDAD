/**
 * CORRECCIÓN: Re-insertar asignaciones faltantes para 5 vigilantes específicos
 * Detectados por la verificación cruzada:
 * - BAENA JIMENEZ MISAEL (CC:1002490936) - BOULEVARD 49
 * - GALLEGO JIMEZ MICHELL ANDREA (CC:1214743442) - EDIFIIO IRIS PORTERIA
 * - CORDOBA GUARIN CESAR AUGUSTO (CC:71734133) - CONJUNTO RESIDENCIAL LONDON
 * - RIOS OSPINA CRISTOBAL DE JESUS (CC:70851012) - C.R. PROVINCIA DE TOSCANA
 * - GILBELTO OCAÑAS SUAREZ (CC:98566804) - CARISMA BELEN
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

function traducirCodigo(codigo) {
  if (!codigo || codigo === '') return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
  const c = String(codigo).trim().toUpperCase();
  if (c === 'D12') return { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' };
  if (c === 'D8')  return { jornada: 'normal', turno: 'AM', inicio: '07:00', fin: '15:00' };
  if (c === 'D10') return { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '16:00' };
  if (c === 'D14') return { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '20:00' };
  if (c === 'N12') return { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' };
  if (c === 'N14') return { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '08:00' };
  if (c === 'NR')  return { jornada: 'descanso_no_remunerado', turno: 'AM', inicio: null, fin: null };
  if (c === 'VAC' || c === 'VC') return { jornada: 'vacacion', turno: 'AM', inicio: null, fin: null };
  if (c === 'INC') return { jornada: 'vacacion', turno: 'AM', inicio: 'ESTADO:IN|06:00', fin: null, codigo_personalizado: 'IN' };
  if (c === 'CZ')  return { jornada: 'vacacion', turno: 'AM', inicio: 'ESTADO:CZ|06:00', fin: null, codigo_personalizado: 'CZ' };
  if (c === 'SUP') return { jornada: 'vacacion', turno: 'AM', inicio: 'ESTADO:SP|06:00', fin: null, codigo_personalizado: 'SP' };
  if (c === 'X')   return { jornada: 'sin_asignar', turno: 'AM', inicio: 'ESTADO:X|06:00', fin: null, codigo_personalizado: 'X' };
  if (c === 'DIS') return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
  return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
}

function normalizarNombre(n) {
  return (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
function similitud(a, b) {
  const na = normalizarNombre(a), nb = normalizarNombre(b);
  if (na === nb) return 1;
  const wa = new Set(na.split(' ')), wb = new Set(nb.split(' '));
  const comunes = [...wa].filter(w => w.length > 3 && wb.has(w));
  return comunes.length / Math.max(wa.size, wb.size);
}

const { data: puestosDB } = await sb.from('puestos').select('id, nombre').eq('empresa_id', EMPRESA_ID);

function buscarPuesto(cliente) {
  let best = null, bestSim = 0;
  for (const p of puestosDB) {
    const s = similitud(cliente, p.nombre);
    if (s > bestSim) { bestSim = s; best = p; }
  }
  if (bestSim >= 0.4) return best;
  const palabras = normalizarNombre(cliente).split(' ').filter(w => w.length > 3);
  for (const p of puestosDB) {
    const pn = normalizarNombre(p.nombre);
    for (const pal of palabras) { if (pn.includes(pal)) return p; }
  }
  return null;
}

let totalInsertados = 0;
const asignarRol = (idx) => {
  const roles = ['titular_a', 'titular_b', 'relevante', 'suplente_a', 'suplente_b'];
  return roles[idx] || `suplente_${idx}`;
};

for (const [pi, excelPuesto] of excelData.entries()) {
  const puestoDB = buscarPuesto(excelPuesto.cliente);
  if (!puestoDB) continue;

  const { data: prog } = await sb
    .from('programaciones_mensuales')
    .select('id, personal')
    .eq('puesto_id', puestoDB.id)
    .eq('anio', 2026)
    .eq('mes', 5)
    .maybeSingle();
  if (!prog) continue;

  for (const [gi, guarda] of excelPuesto.guardas.entries()) {
    const ced = String(guarda.cedula).trim();
    if (!/^\d{5,}$/.test(ced)) continue;

    // Buscar vigilante en BD
    const { data: vig } = await sb
      .from('vigilantes')
      .select('id, cedula')
      .eq('empresa_id', EMPRESA_ID)
      .eq('cedula', ced)
      .maybeSingle();

    if (!vig) {
      console.log(`  ⚠️ Vigilante no existe en BD: ${guarda.nombre} CC:${ced}`);
      continue;
    }

    // Verificar si ya tiene asignaciones en esta programación
    const { count: existeCount } = await sb
      .from('asignaciones_programacion')
      .select('*', { count: 'exact', head: true })
      .eq('programacion_id', prog.id)
      .eq('vigilante_id', vig.id);

    if (existeCount > 0) continue; // Ya tiene asignaciones, OK

    // No tiene asignaciones → insertar
    console.log(`  ➕ Insertando asignaciones para: ${guarda.nombre} CC:${ced} en ${excelPuesto.cliente}`);
    const rol = asignarRol(gi);

    const asigs = [];
    for (const [diaStr, codigo] of Object.entries(guarda.dias)) {
      const dia = parseInt(diaStr);
      if (isNaN(dia) || dia < 1 || dia > 30) continue;
      const t = traducirCodigo(codigo);
      asigs.push({
        programacion_id: prog.id,
        empresa_id: EMPRESA_ID,
        vigilante_id: vig.id,
        rol,
        dia,
        turno: t.turno,
        jornada: t.jornada,
        inicio: t.inicio || null,
        fin: t.fin || null,
        codigo_personalizado: t.codigo_personalizado || null,
      });
    }

    if (asigs.length > 0) {
      const { error } = await sb.from('asignaciones_programacion').insert(asigs);
      if (error) {
        console.error(`    ❌ Error insertando: ${error.message}`);
      } else {
        console.log(`    ✅ ${asigs.length} días insertados`);
        totalInsertados += asigs.length;

        // También agregar al personal de la programación si no está
        const yaEnPersonal = (prog.personal || []).some(p => p.vigilanteId === vig.id);
        if (!yaEnPersonal) {
          const nuevoPersonal = [...(prog.personal || []), { rol, vigilanteId: vig.id }];
          await sb.from('programaciones_mensuales')
            .update({ personal: nuevoPersonal })
            .eq('id', prog.id);
        }
      }
    }
  }
}

console.log(`\n✅ CORRECCIÓN COMPLETADA: ${totalInsertados} asignaciones insertadas`);
