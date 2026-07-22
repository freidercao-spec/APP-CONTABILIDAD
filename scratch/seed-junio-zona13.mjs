/**
 * CORAZA CTA — Seed Programación JUNIO 2026 desde Excel (ZONA 13)
 * ===============================================================
 * Lee scratch/excel_parsed_zona13.json y carga la programación real
 * en la base de datos Supabase para ZONA 13.
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
const ANO = 2026;
const MES_INDEX = 5; // Junio = índice 5 (0-based)
const NUEVA_ZONA = 'ZONA 13';

function traducirCodigo(codigo) {
  if (!codigo || codigo === '') {
    return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
  }
  const c = String(codigo).trim().toUpperCase();
  if (c === 'D12') return { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '18:00' };
  if (c === 'D8')  return { jornada: 'normal', turno: 'AM', inicio: '07:00', fin: '15:00' };
  if (c === 'D9')  return { jornada: 'normal', turno: 'AM', inicio: '07:00', fin: '16:00' };
  if (c === 'D10') return { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '16:00' };
  if (c === 'D14') return { jornada: 'normal', turno: 'AM', inicio: '06:00', fin: '20:00' };
  if (c === 'N8')  return { jornada: 'normal', turno: 'PM', inicio: '22:00', fin: '06:00' };
  if (c === 'N10') return { jornada: 'normal', turno: 'PM', inicio: '20:00', fin: '06:00' };
  if (c === 'N12') return { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '06:00' };
  if (c === 'N13') return { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '07:00' };
  if (c === 'N14') return { jornada: 'normal', turno: 'PM', inicio: '18:00', fin: '08:00' };
  if (c === 'NR')  return { jornada: 'descanso_no_remunerado', turno: 'AM', inicio: null, fin: null };
  if (c === 'VAC' || c === 'VC') return { jornada: 'vacaciones', turno: 'AM', inicio: null, fin: null };
  if (c === 'INC' || c === 'IN') return { jornada: 'incapacidad', turno: 'AM', inicio: null, fin: null };
  if (c === 'CZ')  return { jornada: 'capacitacion', turno: 'AM', inicio: null, fin: null };
  if (c === 'SUP' || c === 'LC' || c === 'SP') return { jornada: 'permiso', turno: 'AM', inicio: null, fin: null };
  if (c === 'X')   return { jornada: 'ausencia_no_justificada', turno: 'AM', inicio: null, fin: null };
  if (c === 'DIS') return { jornada: 'disponible', turno: 'AM', inicio: null, fin: null };
  return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
}

function normalizarNombre(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similitud(a, b) {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (na === nb) return 1;

  const numA = na.match(/\d+/g) || [];
  const numB = nb.match(/\d+/g) || [];
  if (numA.join('-') !== numB.join('-')) {
    return 0;
  }

  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const comunes = [...wordsA].filter(w => w.length > 3 && wordsB.has(w));
  const total = Math.max(wordsA.size, wordsB.size);
  return comunes.length / total;
}

function asignarRol(index) {
  const roles = ['titular_a', 'titular_b', 'relevante', 'suplente_a', 'suplente_b'];
  return roles[index] || `suplente_${index}`;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  CORAZA CTA — Seed Programación Junio 2026 (${NUEVA_ZONA})  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const excelData = JSON.parse(readFileSync(path.join(__dirname, 'excel_parsed_zona13.json'), 'utf-8'));
  console.log(`📄 Puestos en Excel: ${excelData.length}`);

  // Cargar puestos de la BD
  const { data: puestosDB, error: pErr } = await sb
    .from('puestos')
    .select('id, nombre, codigo, zona')
    .eq('empresa_id', EMPRESA_ID);
  if (pErr) { console.error('❌ Error cargando puestos:', pErr.message); process.exit(1); }
  console.log(`📦 Puestos en BD: ${puestosDB.length}`);

  // Cargar vigilantes por páginas
  let vigilantesDB = [];
  let page = 0;
  while (true) {
    const { data: batch } = await sb
      .from('vigilantes')
      .select('id, nombres, apellidos, cedula')
      .eq('empresa_id', EMPRESA_ID)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!batch || batch.length === 0) break;
    vigilantesDB.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }
  console.log(`\n👮 Vigilantes en BD: ${vigilantesDB.length}`);

  const vigilantesPorCedula = new Map();
  vigilantesDB.forEach(v => {
    const ced = String(v.cedula || '').trim();
    if (ced) vigilantesPorCedula.set(ced, v);
  });

  const vigilantesPorNombre = new Map();
  vigilantesDB.forEach(v => {
    const fullName = `${v.apellidos || ''} ${v.nombres || ''}`.trim();
    vigilantesPorNombre.set(normalizarNombre(fullName), v);
  });

  function buscarVigilante(cedula, nombre) {
    const cedStr = String(cedula || '').trim();
    if (cedStr) {
      const porCed = vigilantesPorCedula.get(cedStr);
      if (porCed) return porCed;
    }
    const normNombre = normalizarNombre(nombre);
    const porNombre = vigilantesPorNombre.get(normNombre);
    if (porNombre) {
      const dbCed = String(porNombre.cedula || '').trim();
      if (!dbCed || dbCed === cedStr) return porNombre;
    }
    return null;
  }

  function buscarPuesto(cliente, puesto) {
    let mejorMatch = null, mejorSim = 0;
    for (const p of puestosDB) {
      const sim = similitud(cliente, p.nombre);
      if (sim > mejorSim) { mejorSim = sim; mejorMatch = p; }
    }
    if (mejorSim >= 0.8) return mejorMatch;
    return null;
  }

  let totalProg = 0, totalAsigs = 0, totalNuevosVigilantes = 0;
  const guardasSinMatch = [];
  const puestosSinMatch = [];

  for (const [pi, excelPuesto] of excelData.entries()) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📌 [${pi + 1}/${excelData.length}] ${excelPuesto.cliente} — ${excelPuesto.puesto}`);

    let puestoDB = buscarPuesto(excelPuesto.cliente, excelPuesto.puesto);

    if (!puestoDB) {
      console.log(`   ⚠️  Puesto no encontrado. Creando en ${NUEVA_ZONA}...`);
      const nombrePuesto = `${excelPuesto.cliente.trim()}`;
      const { data: nuevoPuesto, error: nPErr } = await sb
        .from('puestos')
        .insert({ empresa_id: EMPRESA_ID, nombre: nombrePuesto, zona: NUEVA_ZONA, estado: 'activo' })
        .select('id, nombre, zona')
        .single();
      if (nPErr || !nuevoPuesto) {
        console.error(`   ❌ Error creando puesto: ${nPErr?.message}`);
        puestosSinMatch.push(excelPuesto.cliente);
        continue;
      }
      puestoDB = nuevoPuesto;
      puestosDB.push(nuevoPuesto);
      console.log(`   ✅ Puesto creado: ${nuevoPuesto.nombre} [${nuevoPuesto.id}]`);
    } else {
      console.log(`   ✅ Puesto: ${puestoDB.nombre} [${puestoDB.id}]`);
      if (puestoDB.zona !== NUEVA_ZONA) {
        await sb.from('puestos').update({ zona: NUEVA_ZONA }).eq('id', puestoDB.id);
        console.log(`   🔄 Zona actualizada a ${NUEVA_ZONA}`);
      }
    }

    const personalParaDB = [];
    const todasAsignaciones = [];

    for (const [gi, guarda] of excelPuesto.guardas.entries()) {
      let vigilante = buscarVigilante(guarda.cedula, guarda.nombre);

      if (!vigilante) {
        console.log(`   ➕ Creando vigilante: ${guarda.nombre} (CC: ${guarda.cedula})`);
        const nombres = guarda.nombre.trim();
        const apellidos = '';

        const { data: nuevoVig, error: nvErr } = await sb
          .from('vigilantes')
          .insert({ empresa_id: EMPRESA_ID, cedula: String(guarda.cedula), nombres, apellidos, estado: 'activo' })
          .select('id, nombres, apellidos, cedula')
          .single();

        if (nvErr || !nuevoVig) {
          console.warn(`   ❌ Error creando vigilante ${guarda.nombre}: ${nvErr?.message}`);
          guardasSinMatch.push({ nombre: guarda.nombre, cedula: guarda.cedula });
          continue;
        }
        vigilante = nuevoVig;
        vigilantesPorCedula.set(String(guarda.cedula), nuevoVig);
        const fullName = `${nuevoVig.apellidos || ''} ${nuevoVig.nombres || ''}`.trim();
        vigilantesPorNombre.set(normalizarNombre(fullName), nuevoVig);
        totalNuevosVigilantes++;
      }

      const rol = asignarRol(gi);
      personalParaDB.push({ vigilante_id: vigilante.id, rol });

      let asigsCount = 0;
      for (const [diaStr, codigo] of Object.entries(guarda.dias)) {
        const dia = parseInt(diaStr);
        if (isNaN(dia) || dia < 1 || dia > 30) continue; // Junio solo tiene 30 días
        const { jornada, turno, inicio, fin } = traducirCodigo(codigo);
        todasAsignaciones.push({
          programacion_id: null,
          empresa_id: EMPRESA_ID,
          vigilante_id: vigilante.id,
          rol,
          dia,
          turno,
          jornada,
          inicio: inicio || null,
          fin: fin || null,
          codigo_personalizado: null,
        });
        asigsCount++;
      }
      console.log(`   👮 ${guarda.nombre} (CC: ${guarda.cedula}) → ${rol} · ${asigsCount} días`);
    }

    if (personalParaDB.length === 0) {
      console.log(`   ⏩ Sin guardas válidos, saltando.`);
      continue;
    }

    const personalJson = personalParaDB.map(p => ({
      rol: p.rol,
      vigilanteId: p.vigilante_id
    }));

    const { data: existing } = await sb
      .from('programaciones_mensuales')
      .select('id')
      .eq('puesto_id', puestoDB.id)
      .eq('anio', ANO)
      .eq('mes', MES_INDEX)
      .maybeSingle();

    let progId;
    if (existing?.id) {
      progId = existing.id;
      await sb.from('programaciones_mensuales').update({ personal: personalJson }).eq('id', progId);
      console.log(`   🔄 Programación actualizada: ${progId}`);
    } else {
      const { data: newProg } = await sb
        .from('programaciones_mensuales')
        .insert({ puesto_id: puestoDB.id, anio: ANO, mes: MES_INDEX, empresa_id: EMPRESA_ID, estado: 'publicado', version: 1, personal: personalJson })
        .select('id').single();
      progId = newProg.id;
      console.log(`   📋 Programación creada: ${progId}`);
    }

    // Clean and reinsert assignments
    await sb.from('asignaciones_programacion').delete().eq('programacion_id', progId);

    todasAsignaciones.forEach(asig => {
      asig.programacion_id = progId;
    });

    // Insert in batches of 500
    for (let k = 0; k < todasAsignaciones.length; k += 500) {
      const { error: aErr } = await sb
        .from('asignaciones_programacion')
        .insert(todasAsignaciones.slice(k, k + 500));
      if (aErr) console.error(`   ❌ Error asignaciones lote ${k}: ${aErr.message}`);
    }

    totalProg++;
    totalAsigs += todasAsignaciones.length;
    console.log(`   ✅ ${todasAsignaciones.length} asignaciones insertadas`);
  }

  console.log(`\n${'═'.repeat(62)}`);
  console.log(`🚀 SEED ZONA 13 COMPLETADO`);
  console.log(`   ✅ ${totalProg} programaciones insertadas/actualizadas`);
  console.log(`   ✅ ${totalAsigs} asignaciones insertadas`);
  console.log(`   ➕ ${totalNuevosVigilantes} vigilantes nuevos creados`);
  console.log(`${'═'.repeat(62)}\n`);
}

main().catch(e => {
  console.error('\n💥 ERROR FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
