/**
 * FIX DIRECTO: Insertar asignaciones faltantes para 5 vigilantes
 * Busca el prog correcto por vigilante_id Y puesto combinado
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sb = createClient('https://ykchpbqkjvmnddndkvno.supabase.co','sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E');
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
  if (c === 'INC') return { jornada: 'vacacion', turno: 'AM', inicio: 'ESTADO:IN|06:00', fin: null };
  if (c === 'CZ')  return { jornada: 'vacacion', turno: 'AM', inicio: 'ESTADO:CZ|06:00', fin: null };
  if (c === 'SUP') return { jornada: 'vacacion', turno: 'AM', inicio: 'ESTADO:SP|06:00', fin: null };
  if (c === 'X')   return { jornada: 'sin_asignar', turno: 'AM', inicio: null, fin: null };
  if (c === 'DIS') return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
  return { jornada: 'descanso_remunerado', turno: 'AM', inicio: null, fin: null };
}

function normNombre(n) { return (n||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim(); }
function sim(a,b) {
  const wa=new Set(normNombre(a).split(' ')), wb=new Set(normNombre(b).split(' '));
  const c=[...wa].filter(w=>w.length>3&&wb.has(w));
  return c.length/Math.max(wa.size,wb.size);
}

const { data: puestosDB } = await sb.from('puestos').select('id,nombre').eq('empresa_id',EMPRESA_ID);
function buscarPuesto(cliente) {
  let best=null,bs=0;
  for(const p of puestosDB){const s=sim(cliente,p.nombre);if(s>bs){bs=s;best=p;}}
  if(bs>=0.4)return best;
  for(const p of puestosDB){const pn=normNombre(p.nombre);for(const w of normNombre(cliente).split(' ').filter(x=>x.length>3)){if(pn.includes(w))return p;}}
  return null;
}

const asignarRol = idx => ['titular_a','titular_b','relevante','suplente_a','suplente_b'][idx] || `suplente_${idx}`;

let totalInsertados = 0;

for (const [pi, excelPuesto] of excelData.entries()) {
  const puestoDB = buscarPuesto(excelPuesto.cliente);
  if (!puestoDB) continue;

  // Prog EXACTA para este puesto
  const { data: prog } = await sb
    .from('programaciones_mensuales')
    .select('id, personal')
    .eq('puesto_id', puestoDB.id)
    .eq('anio', 2026).eq('mes', 5)
    .maybeSingle();
  if (!prog) continue;

  for (const [gi, guarda] of excelPuesto.guardas.entries()) {
    const ced = String(guarda.cedula).trim();
    if (!/^\d{5,}$/.test(ced)) continue;

    const { data: vig } = await sb.from('vigilantes').select('id,cedula').eq('empresa_id',EMPRESA_ID).eq('cedula',ced).maybeSingle();
    if (!vig) continue;

    // Verificar en ESTE prog específico
    const { count } = await sb
      .from('asignaciones_programacion')
      .select('*',{count:'exact',head:true})
      .eq('programacion_id', prog.id)
      .eq('vigilante_id', vig.id);

    if (count > 0) continue; // Ya existe en este prog

    // Insertar
    console.log(`➕ ${excelPuesto.cliente} → ${guarda.nombre} CC:${ced}`);
    const rol = asignarRol(gi);
    const asigs = [];
    for (const [diaStr, codigo] of Object.entries(guarda.dias)) {
      const dia = parseInt(diaStr);
      if (isNaN(dia)||dia<1||dia>30) continue;
      const t = traducirCodigo(codigo);
      asigs.push({
        programacion_id: prog.id, empresa_id: EMPRESA_ID,
        vigilante_id: vig.id, rol, dia,
        turno: t.turno, jornada: t.jornada,
        inicio: t.inicio||null, fin: t.fin||null,
        codigo_personalizado: null,
      });
    }
    if (asigs.length > 0) {
      const { error } = await sb.from('asignaciones_programacion').insert(asigs);
      if (error) console.error(`  ❌ ${error.message}`);
      else {
        console.log(`  ✅ ${asigs.length} días`);
        totalInsertados += asigs.length;
        // Actualizar personal
        const yaEnPersonal = (prog.personal||[]).some(p=>p.vigilanteId===vig.id);
        if (!yaEnPersonal) {
          await sb.from('programaciones_mensuales').update({
            personal: [...(prog.personal||[]), { rol, vigilanteId: vig.id }]
          }).eq('id', prog.id);
        }
      }
    }
  }
}

console.log(`\n✅ Total insertados: ${totalInsertados} asignaciones`);
