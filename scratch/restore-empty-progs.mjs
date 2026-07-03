import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  'https://ykchpbqkjvmnddndkvno.supabase.co',
  'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E'
);
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const targetPuestos = [
  { name: 'HOTEL BELFOR', id: '0dc4a298-94bb-4355-8a81-82f99da492d0', progId: 'fcc56cfb-510c-4cbc-bf73-ce7057629b56' },
  { name: 'AUTONOMA', id: 'fe121735-0a2d-40f7-b240-a8a40c00214e', progId: 'dd42f1b6-84cb-40e7-a9da-98c084c3aebe' },
  { name: 'AMISI', id: '2e43fd7f-7539-444c-9827-80cd422e8870', progId: '16db5e8d-c6c4-4971-8965-9190b1a3ffc2' }
];

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
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return 0;
}

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
  if (c === 'CD' || c === 'PR') return { jornada: 'permiso', turno: 'AM', inicio: null, fin: null };
  if (c === 'X')   return { jornada: 'ausencia_no_justificada', turno: 'AM', inicio: null, fin: null };
  if (c === 'DIS' || c === 'DISPONIBLE') return { jornada: 'disponible', turno: 'AM', inicio: null, fin: null };
  return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
}

function asignarRol(index) {
  const roles = ['titular_a', 'titular_b', 'relevante', 'suplente_a', 'suplente_b'];
  return roles[index] || `suplente_${index}`;
}

async function run() {
  const files = readdirSync(__dirname).filter(f => f.startsWith('excel_parsed_') && f.endsWith('.json'));
  console.log('Parsed Excel files found:', files);

  // Load vigilantes from DB for name matching
  let vigilantesDB = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb
      .from('vigilantes')
      .select('id, nombre, cedula')
      .eq('empresa_id', EMPRESA_ID)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error('Error fetching vigilantes:', error); break; }
    if (!data || data.length === 0) break;
    vigilantesDB = [...vigilantesDB, ...data];
    page++;
  }
  console.log(`Loaded ${vigilantesDB.length} vigilantes from DB.`);

  for (const target of targetPuestos) {
    console.log(`\n🔍 Searching match for: ${target.name} (ID: ${target.id})...`);
    let bestMatch = null;
    let bestScore = 0;

    for (const file of files) {
      const data = JSON.parse(readFileSync(path.join(__dirname, file), 'utf-8'));
      for (const item of data) {
        if (!item.cliente) continue;
        const score = similitud(item.cliente, target.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { item, file };
        }
      }
    }

    if (bestMatch && bestScore >= 0.8) {
      console.log(`🎯 Match found in ${bestMatch.file} (Score: ${bestScore}): "${bestMatch.item.cliente}"`);
      const item = bestMatch.item;

      // Map rows (which are guards and their shifts)
      const personalList = [];
      const asigPayloads = [];

      const guardas = item.guardas || [];

      guardas.forEach((guarda, index) => {
        const guardName = guarda.nombre;
        if (!guardName || guardName.toUpperCase().includes('VACANTE')) {
          personalList.push({ rol: asignarRol(index), vigilanteId: null, turnoId: 'AM' });
          return;
        }

        // Match vigilante in DB
        let bestGuard = null;
        let guardScore = 0;
        vigilantesDB.forEach(v => {
          const s = similitud(v.nombre, guardName);
          if (s > guardScore) {
            guardScore = s;
            bestGuard = v;
          }
        });

        const guardId = (bestGuard && guardScore >= 0.8) ? bestGuard.id : null;
        
        // Determine default turno
        let defaultTurno = 'AM';
        if (guarda.dias) {
          const codes = Object.values(guarda.dias);
          if (codes.some(c => String(c).toUpperCase().includes('N'))) {
            defaultTurno = 'PM';
          }
        }
        
        const rol = asignarRol(index);
        personalList.push({ rol, vigilanteId: guardId, turnoId: defaultTurno, displayName: guardName });

        if (guarda.dias) {
          Object.entries(guarda.dias).forEach(([diaStr, code]) => {
            const dia = parseInt(diaStr, 10);
            if (isNaN(dia) || dia < 1 || dia > 31) return;

            const { jornada, turno, inicio, fin } = traducirCodigo(code);
            const JORNADA_DB_ALLOWED = new Set([
              'normal', 'descanso_remunerado', 'descanso_no_remunerado', 'vacacion', 'sin_asignar'
            ]);
            const JORNADA_TO_CODE = {
              licencia: 'LC', suspension: 'SP', incapacidad: 'IN', accidente: 'AC', v: 'VAC', vacacion: 'VAC', vacaciones: 'VAC'
            };
            const isSpecial = !JORNADA_DB_ALLOWED.has(jornada);
            const jornadaDb = isSpecial ? 'vacacion' : (jornada === 'vacaciones' ? 'vacacion' : (jornada || 'sin_asignar'));
            const codeVal = isSpecial ? JORNADA_TO_CODE[jornada] || 'VAC' : (jornada === 'vacaciones' ? 'VAC' : null);

            // Metadata in inicio field: "ESTADO:IN|06:00"
            const realInicio = inicio || (turno === 'PM' ? '18:00' : '06:00');
            const inicioDb = codeVal ? `ESTADO:${codeVal}|${realInicio}` : realInicio;
            
            asigPayloads.push({
              programacion_id: target.progId,
              dia,
              vigilante_id: guardId,
              turno,
              jornada: jornadaDb,
              rol,
              inicio: inicioDb,
              fin: fin || (turno === 'PM' ? '06:00' : '18:00'),
              codigo_personalizado: codeVal || null
            });
          });
        }
      });

      console.log(`Inserting ${asigPayloads.length} assignments and personal config to program ${target.progId}...`);

      // Update personal in programacion_mensual
      const { error: pErr } = await sb.from('programaciones_mensuales')
        .update({ personal: personalList, estado: 'publicado' })
        .eq('id', target.progId);

      if (pErr) {
        console.error('Error updating personal config:', pErr);
        continue;
      }

      // Delete existing assignments first
      await sb.from('asignaciones_programacion').delete().eq('programacion_id', target.progId);

      // Insert new ones in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < asigPayloads.length; i += BATCH_SIZE) {
        const chunk = asigPayloads.slice(i, i + BATCH_SIZE);
        const { error: asigErr } = await sb.from('asignaciones_programacion').insert(chunk);
        if (asigErr) {
          console.error(`Error inserting batch starting at index ${i}:`, asigErr);
        }
      }
      console.log(`✅ Success restoring ${target.name}!`);
    } else {
      console.log(`❌ No match found for ${target.name} (Best score: ${bestScore})`);
    }
  }
}

run().catch(console.error);
