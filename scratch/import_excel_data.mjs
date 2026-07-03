import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import crypto from 'crypto';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

const excelPath = 'C:\\Users\\gdocumental\\Downloads\\CHATBOT\\PROGRAMACION\\APP-CONTABILIDAD\\PROGRAMACION DE JULIO\\JUNIO ZONA 20 - 2.xlsx';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const SHIFT_CONFIGS = {
  'D12': { id: 'D12', nombre: 'Diurno 12h', inicio: '06:00', fin: '18:00', color: '#0ea5e9', type: 'AM' },
  'N12': { id: 'N12', nombre: 'Nocturno 12h', inicio: '18:00', fin: '06:00', color: '#6366f1', type: 'PM' },
  'D8':  { id: 'D8',  nombre: 'Diurno 8h',   inicio: '06:00', fin: '14:00', color: '#10b981', type: 'AM' },
  'D9':  { id: 'D9',  nombre: 'Diurno 9h',   inicio: '06:00', fin: '15:00', color: '#8b5cf6', type: 'AM' },
  'D10': { id: 'D10', nombre: 'Diurno 10h',  inicio: '06:00', fin: '16:00', color: '#f59e0b', type: 'AM' },
  'D14': { id: 'D14', nombre: 'Diurno 14h',  inicio: '06:00', fin: '20:00', color: '#f43f5e', type: 'AM' },
  'N8':  { id: 'N8',  nombre: 'Nocturno 8h',  inicio: '22:00', fin: '06:00', color: '#ec4899', type: 'PM' },
  'N10': { id: 'N10', nombre: 'Nocturno 10h', inicio: '20:00', fin: '06:00', color: '#14b8a6', type: 'PM' },
  'N14': { id: 'N14', nombre: 'Nocturno 14h', inicio: '16:00', fin: '06:00', color: '#3b82f6', type: 'PM' },
  'CZ':  { id: 'CZ',  nombre: 'Coraza',      inicio: '07:00', fin: '17:00', color: '#84cc16', type: 'AM' },
  '1':   { id: 'D12', nombre: 'Diurno 12h',  inicio: '06:00', fin: '18:00', color: '#0ea5e9', type: 'AM' }
};

// Map sheet cell codes to DB assignments
function mapCellToAssignment(cellVal, rol, vigilanteId, dia) {
  const code = cellVal ? String(cellVal).trim().toUpperCase() : '';
  
  if (!code || code === 'X' || code === '0') {
    return {
      dia,
      rol,
      vigilanteId,
      turno: 'AM',
      jornada: 'sin_asignar',
      inicio: '06:00',
      fin: '18:00',
      codigo_personalizado: null
    };
  }

  // Check special states
  if (code === 'VAC' || code === 'VC') {
    return {
      dia,
      rol,
      vigilanteId,
      turno: 'AM',
      jornada: 'vacacion',
      inicio: 'ESTADO:VC|06:00',
      fin: '18:00',
      codigo_personalizado: 'VC'
    };
  }

  if (code === 'LC') {
    return {
      dia,
      rol,
      vigilanteId,
      turno: 'AM',
      jornada: 'licencia',
      inicio: 'ESTADO:LC|06:00',
      fin: '18:00',
      codigo_personalizado: 'LC'
    };
  }

  if (code === 'INC' || code === 'IN') {
    return {
      dia,
      rol,
      vigilanteId,
      turno: 'AM',
      jornada: 'incapacidad',
      inicio: 'ESTADO:IN|06:00',
      fin: '18:00',
      codigo_personalizado: 'IN'
    };
  }

  if (code === 'SUP' || code === 'SP') {
    return {
      dia,
      rol,
      vigilanteId,
      turno: 'AM',
      jornada: 'suspension',
      inicio: 'ESTADO:SP|06:00',
      fin: '18:00',
      codigo_personalizado: 'SP'
    };
  }

  if (code === 'NR') {
    return {
      dia,
      rol,
      vigilanteId,
      turno: 'AM',
      jornada: 'descanso_no_remunerado',
      inicio: '06:00',
      fin: '18:00',
      codigo_personalizado: null
    };
  }

  if (code === 'DIS') {
    return {
      dia,
      rol,
      vigilanteId,
      turno: 'AM',
      jornada: 'descanso_remunerado',
      inicio: '06:00',
      fin: '18:00',
      codigo_personalizado: null
    };
  }

  // Work shifts
  const shift = SHIFT_CONFIGS[code] || SHIFT_CONFIGS['D12'];
  return {
    dia,
    rol,
    vigilanteId,
    turno: shift.type,
    jornada: 'normal',
    inicio: shift.inicio,
    fin: shift.fin,
    codigo_personalizado: null
  };
}

async function runImport() {
  console.log('--- 🚀 STARTING IMPORT PROCESS FROM EXCEL 🚀 ---');
  
  // 1. Load active data from database to prevent duplicate inserts
  console.log('Fetching active database Puestos...');
  const { data: dbPuestos } = await sb.from('puestos').select('*');
  const puestoMap = new Map(dbPuestos?.map(p => [p.nombre.trim().toUpperCase(), p]));

  console.log('Fetching active database Vigilantes...');
  const { data: dbVigilantes } = await sb.from('vigilantes').select('*');
  const vigMapByCedula = new Map(dbVigilantes?.map(v => [String(v.cedula).trim(), v]));
  const vigMapByName = new Map(dbVigilantes?.map(v => [v.nombres.trim().toUpperCase() + ' ' + v.apellidos.trim().toUpperCase(), v]));

  // 2. Parse Excel data
  console.log('Parsing Excel workbook...');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['JUNIO'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const excelPuestos = [];
  let currentPuesto = null;
  let inGuardRows = false;
  let headers = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    
    const titleVal = row.find(val => typeof val === 'string' && val.includes('PROGRAMACION DE TURNOS'));
    if (titleVal) {
      inGuardRows = false;
      currentPuesto = null;
      headers = null;
      continue;
    }

    const empresaIdx = row.findIndex(val => typeof val === 'string' && val.includes('EMPRESA / CLIENTE:'));
    if (empresaIdx !== -1) {
      const clientName = row[empresaIdx + 3] || row[empresaIdx + 2] || row[empresaIdx + 1];
      currentPuesto = {
        nombre: clientName ? clientName.trim() : '',
        servicio: '',
        guards: [],
        detectedShifts: new Set(['AM', 'PM'])
      };
      if (currentPuesto.nombre) {
        excelPuestos.push(currentPuesto);
      }
      continue;
    }

    const puestoIdx = row.findIndex(val => typeof val === 'string' && val.includes('PUESTO DE SERVICIO:'));
    if (puestoIdx !== -1 && currentPuesto) {
      currentPuesto.servicio = row[puestoIdx + 3] || row[puestoIdx + 2] || row[puestoIdx + 1] || '';
      continue;
    }

    const cedulaIdx = row.findIndex(val => typeof val === 'string' && val.includes('CEDULA'));
    if (cedulaIdx !== -1) {
      headers = row;
      inGuardRows = true;
      continue;
    }

    if (inGuardRows && currentPuesto) {
      const cedula = row[5];
      const nombre = row[6];
      
      if (cedula && nombre && typeof nombre === 'string' && nombre.trim()) {
        const nUpper = nombre.toUpperCase();
        if (nUpper.includes('HORARIO') || nUpper.includes('TURNO') || nUpper.includes('DESCANSO') || nUpper.includes('DISPONIBLE') || nUpper.includes('APELLIDOS')) {
          continue;
        }

        // Parse days
        const schedule = {};
        for (let colIdx = 9; colIdx <= 39; colIdx++) {
          const headerVal = headers[colIdx];
          if (headerVal) {
            const dayNum = parseInt(headerVal);
            const val = row[colIdx];
            if (val !== undefined && val !== null) {
              const code = String(val).trim().toUpperCase();
              if (code) {
                schedule[dayNum] = code;
                if (SHIFT_CONFIGS[code]) {
                  currentPuesto.detectedShifts.add(code);
                }
              }
            }
          }
        }

        currentPuesto.guards.push({
          cedula: String(cedula).trim(),
          nombre: nombre.trim().toUpperCase(),
          schedule
        });
      }
    }
  }

  console.log(`Excel analysis complete. Found ${excelPuestos.length} puestos blocks.`);

  // 3. Insert or Match Puestos
  console.log('\n--- Syncing Puestos ---');
  for (const ep of excelPuestos) {
    const key = ep.nombre.toUpperCase();
    if (!puestoMap.has(key)) {
      console.log(`Puesto "${ep.nombre}" not found in DB. Creating...`);
      const newUuid = crypto.randomUUID();
      
      // Build turnos_config array
      const turnosConfig = Array.from(ep.detectedShifts).map(code => {
        const s = SHIFT_CONFIGS[code];
        return s ? { id: s.id, nombre: s.nombre, inicio: s.inicio, fin: s.fin, color: s.color } : null;
      }).filter(Boolean);

      // Add default AM/PM if not present
      if (!turnosConfig.some(t => t.id === 'AM')) {
        turnosConfig.push({ id: 'AM', nombre: 'Turno Diurno', inicio: '06:00', fin: '18:00', color: '#0ea5e9' });
      }
      if (!turnosConfig.some(t => t.id === 'PM')) {
        turnosConfig.push({ id: 'PM', nombre: 'Turno Nocturno', inicio: '18:00', fin: '06:00', color: '#6366f1' });
      }

      const { data, error } = await sb.from('puestos').insert({
        id: newUuid,
        empresa_id: EMPRESA_ID,
        nombre: ep.nombre,
        tipo: 'edificio',
        estado: 'activo',
        prioridad: 'alta',
        zona: 'ZONA PRINCIPAL',
        turnos_config: turnosConfig,
        jornadas_custom: []
      }).select().single();

      if (error) {
        console.error(`Error inserting puesto ${ep.nombre}:`, error.message);
      } else {
        puestoMap.set(key, data);
      }
    } else {
      // Update turnos_config of existing puesto to include new shifts
      const p = puestoMap.get(key);
      const existingTurnos = p.turnos_config || [];
      let updated = false;
      
      Array.from(ep.detectedShifts).forEach(code => {
        const s = SHIFT_CONFIGS[code];
        if (s && !existingTurnos.some(t => t.id === s.id)) {
          existingTurnos.push({ id: s.id, nombre: s.nombre, inicio: s.inicio, fin: s.fin, color: s.color });
          updated = true;
        }
      });

      if (updated) {
        await sb.from('puestos').update({ turnos_config: existingTurnos }).eq('id', p.id);
      }
    }
  }

  // 4. Insert or Match Vigilantes
  console.log('\n--- Syncing Vigilantes ---');
  for (const ep of excelPuestos) {
    for (const eg of ep.guards) {
      if (!vigMapByCedula.has(eg.cedula)) {
        // Match by name as fallback
        const keyName = eg.nombre;
        if (vigMapByName.has(keyName)) {
          const matchedVig = vigMapByName.get(keyName);
          console.log(`Matched guard "${eg.nombre}" by name. Updating cedula to ${eg.cedula}...`);
          const { data, error } = await sb.from('vigilantes').update({ cedula: eg.cedula }).eq('id', matchedVig.id).select().single();
          if (!error) {
            vigMapByCedula.set(eg.cedula, data);
          }
          continue;
        }

        console.log(`Vigilante "${eg.nombre}" (Cedula: ${eg.cedula}) not found. Creating...`);
        const nameParts = eg.nombre.trim().split(' ');
        const nombres = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(' ');
        const apellidos = nameParts.slice(Math.ceil(nameParts.length / 2)).join(' ') || nombres;
        
        const { data, error } = await sb.from('vigilantes').insert({
          empresa_id: EMPRESA_ID,
          cedula: eg.cedula,
          nombres,
          apellidos,
          estado: 'activo'
        }).select().single();

        if (error) {
          console.error(`Error inserting vigilante ${eg.nombre}:`, error.message);
        } else {
          vigMapByCedula.set(eg.cedula, data);
          vigMapByName.set(eg.nombre, data);
        }
      }
    }
  }

  // 5. Insert Monthly Programmings & Assignments
  console.log('\n--- Syncing Monthly Board Schedules ---');
  
  const ANIO = 2026;
  const MES = 5; // June (0-indexed 5)

  for (const ep of excelPuestos) {
    const dbPuesto = puestoMap.get(ep.nombre.toUpperCase());
    if (!dbPuesto) continue;

    console.log(`Syncing monthly schedule for posto: "${ep.nombre}"...`);

    // Check if programming already exists
    let { data: prog, error: fetchErr } = await sb
      .from('programaciones_mensuales')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .eq('puesto_id', dbPuesto.id)
      .eq('anio', ANIO)
      .eq('mes', MES)
      .maybeSingle();

    const vigCount = {};
    const personalList = ep.guards.map(eg => {
      const dbVig = vigMapByCedula.get(eg.cedula);
      if (!dbVig) return null;
      
      const count = (vigCount[dbVig.id] || 0) + 1;
      vigCount[dbVig.id] = count;
      
      const rolId = `rol_${dbVig.id}_${count}`;
      // Find the first shift code they work to set as default turnoId
      const firstShiftCode = Object.values(eg.schedule)[0] || 'D12';
      const shift = SHIFT_CONFIGS[firstShiftCode] || SHIFT_CONFIGS['D12'];

      return {
        rol: rolId,
        vigilanteId: dbVig.id,
        turnoId: shift.id,
        displayName: `${dbVig.nombres} ${dbVig.apellidos}`.toUpperCase()
      };
    }).filter(Boolean);

    if (!prog) {
      // Create new programming
      const newUuid = crypto.randomUUID();
      const { data, error } = await sb.from('programaciones_mensuales').insert({
        id: newUuid,
        empresa_id: EMPRESA_ID,
        puesto_id: dbPuesto.id,
        anio: ANIO,
        mes: MES,
        estado: 'borrador',
        personal: personalList,
        version: 1,
        historial_cambios: []
      }).select().single();

      if (error) {
        console.error(`Error creating programming for posto ${ep.nombre}:`, error.message);
        continue;
      }
      prog = data;
    } else {
      // Update existing programming personal list
      const { data, error } = await sb.from('programaciones_mensuales').update({
        personal: personalList,
        updated_at: new Date().toISOString()
      }).eq('id', prog.id).select().single();
      
      if (!error) prog = data;
    }

    // Now insert the day assignments
    const asignaciones = [];
    const vigCountAsig = {};
    ep.guards.forEach(eg => {
      const dbVig = vigMapByCedula.get(eg.cedula);
      if (!dbVig) return;
      
      const count = (vigCountAsig[dbVig.id] || 0) + 1;
      vigCountAsig[dbVig.id] = count;
      
      const rolId = `rol_${dbVig.id}_${count}`;

      // Loop days of June (1 to 30)
      for (let day = 1; day <= 30; day++) {
        const cellVal = eg.schedule[day];
        const asig = mapCellToAssignment(cellVal, rolId, dbVig.id, day);
        
        asignaciones.push({
          programacion_id: prog.id,
          dia: asig.dia,
          vigilante_id: asig.vigilanteId,
          rol: asig.rol,
          turno: asig.turno,
          jornada: asig.jornada,
          inicio: asig.inicio,
          fin: asig.fin,
          codigo_personalizado: asig.codigo_personalizado
        });
      }
    });

    // Delete existing assignments for this monthly board to prevent UNIQUE conflicts
    console.log(`  Deleting existing assignments for board ID ${prog.id}...`);
    await sb.from('asignaciones_programacion').delete().eq('programacion_id', prog.id);

    // Upsert new assignments in chunks of 100 to prevent Supabase payload limits
    const BATCH_SIZE = 100;
    console.log(`  Inserting ${asignaciones.length} new assignments...`);
    for (let j = 0; j < asignaciones.length; j += BATCH_SIZE) {
      const chunk = asignaciones.slice(j, j + BATCH_SIZE);
      const { error: asigErr } = await sb
        .from('asignaciones_programacion')
        .insert(chunk);
      
      if (asigErr) {
        console.error(`  ❌ Error inserting assignments batch for posto ${ep.nombre}:`, asigErr.message);
      }
    }
    console.log(`  ✅ Finished syncing posto "${ep.nombre}".`);
  }

  console.log('\n=== 🎉 IMPORT COMPLETED SUCCESSFULLY 🎉 ===');
}

runImport().catch(err => console.error(err));
