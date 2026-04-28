/**
 * Fix all issues:
 * 1. Get valid tipo values from existing puestos
 * 2. Create Torre and Plaza with valid tipos
 * 3. Fix novedades (applied to wrong month - mes=4 is May, April is mes=3)
 * 4. Add SQL migration for zona and codigo_personalizado
 */
const https = require('https');
const SUPABASE_URL = 'ylcpizjfwupfvffsbjmz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const YEAR = 2026;

function supabaseReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_URL,
      path: path.startsWith('/') ? path : `/rest/v1/${path}`,
      method,
      headers: {
        'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
      },
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function getJornada(pos) {
  const p = ((pos - 1) % 18) + 1;
  if (p <= 6)  return { jornada: 'normal',                 turno: 'AM' };
  if (p === 7) return { jornada: 'descanso_remunerado',    turno: 'AM' };
  if (p === 8) return { jornada: 'descanso_remunerado',    turno: 'AM' };
  if (p === 9) return { jornada: 'descanso_no_remunerado', turno: 'AM' };
  if (p <= 15) return { jornada: 'normal',                 turno: 'PM' };
  if (p === 16) return { jornada: 'descanso_remunerado',   turno: 'PM' };
  if (p === 17) return { jornada: 'descanso_remunerado',   turno: 'PM' };
  return         { jornada: 'descanso_no_remunerado',      turno: 'PM' };
}

// NOTE: mes indices - January=0, February=1, ..., April=3, May=4
// Test novedades are for APRIL = mes index 3
const TEST_NOVEDADES = [
  { puestoName: 'Torre Empresarial Buenavista', rol: 'relevante', dia: 12, mes: 3, jornada: 'accidente' },
  { puestoName: 'Plaza Madeira',               rol: 'titular_a', dia: 15, mes: 3, jornada: 'incapacidad' },
];

const REMAINING_PUESTOS = [
  {
    nombre: 'Torre Empresarial Buenavista',
    tipo: 'hospital', // will try 'hospital' as fallback valid type
    prioridad: 'media', zona: 'Zona Sur',
    direccion: 'Cra. 53 #98-07, Barranquilla', latitud: 11.0123, longitud: -74.8201,
    instrucciones: `ZONA:Zona Sur|Recepción principal piso 1`,
    requerimiento_hombres: 3,
    roles: [{ rol: 'titular_a', startPos: 1 }, { rol: 'titular_b', startPos: 7 }, { rol: 'relevante', startPos: 4 }],
  },
  {
    nombre: 'Plaza Madeira',
    tipo: 'hospital', // fallback
    prioridad: 'alta', zona: 'Zona 20',
    direccion: 'Av. Circunvalar #38-55, Barranquilla', latitud: 10.9901, longitud: -74.7765,
    instrucciones: `ZONA:Zona 20|Parqueadero nivel -1, caseta de control`,
    requerimiento_hombres: 3,
    roles: [{ rol: 'titular_a', startPos: 10 }, { rol: 'titular_b', startPos: 14 }, { rol: 'relevante', startPos: 1 }],
  },
];

async function createProgramacionWithAsigs(puestoId, nombre, roles, mes) {
  const daysInMonth = new Date(YEAR, mes + 1, 0).getDate();
  const mesNom = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][mes];

  // Check/create programacion
  let progId;
  const checkProg = await supabaseReq('GET',
    `programacion_mensual?puesto_id=eq.${puestoId}&anio=eq.${YEAR}&mes=eq.${mes}&empresa_id=eq.${EMPRESA_ID}&select=id`
  );
  if (checkProg.status === 200 && Array.isArray(checkProg.body) && checkProg.body.length > 0) {
    progId = checkProg.body[0].id;
    process.stdout.write(`  [${mesNom}] exists `);
  } else {
    const progRes = await supabaseReq('POST', 'programacion_mensual', {
      empresa_id: EMPRESA_ID, puesto_id: puestoId,
      anio: YEAR, mes, estado: mes < 3 ? 'publicado' : 'borrador', version: 1,
    });
    if (progRes.status !== 201 || !Array.isArray(progRes.body)) {
      console.log(`  [${mesNom}] ❌ create fail: ${progRes.status}`);
      return null;
    }
    progId = progRes.body[0].id;
    process.stdout.write(`  [${mesNom}] new(${progId.slice(-6)}) `);
  }

  // personal_puesto
  for (const r of roles) {
    const chk = await supabaseReq('GET', `personal_puesto?programacion_id=eq.${progId}&rol=eq.${r.rol}&select=id`);
    if (!Array.isArray(chk.body) || chk.body.length === 0) {
      await supabaseReq('POST', 'personal_puesto', { programacion_id: progId, rol: r.rol, vigilante_id: null });
    }
  }

  // Check if asigs exist
  const chkAsigs = await supabaseReq('GET', `asignaciones_dia?programacion_id=eq.${progId}&select=id&limit=1`);
  if (Array.isArray(chkAsigs.body) && chkAsigs.body.length > 0) {
    process.stdout.write('skip_asigs ');
    console.log('✅');
    return progId;
  }

  // Build asignaciones batch
  const batch = [];
  for (const r of roles) {
    let pos = r.startPos;
    for (let d = 1; d <= daysInMonth; d++) {
      const { jornada, turno } = getJornada(pos);
      batch.push({
        programacion_id: progId, dia: d, rol: r.rol,
        vigilante_id: null, turno, jornada,
        inicio: turno === 'PM' ? '18:00' : '06:00',
        fin:   turno === 'PM' ? '06:00' : '18:00',
      });
      pos++;
    }
    r.startPos += daysInMonth; // advance for next month
  }

  // Insert in chunks
  let total = 0;
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    const ins = await supabaseReq('POST', 'asignaciones_dia', chunk);
    if (ins.status === 201) total += chunk.length;
    else process.stdout.write(`[ERR:${ins.status}] `);
  }
  process.stdout.write(`${total}asigs `);

  // Apply novedades for April (mes=3)
  if (mes === 3) {
    const novedades = TEST_NOVEDADES.filter(n => n.puestoName === nombre);
    for (const nov of novedades) {
      const findA = await supabaseReq('GET',
        `asignaciones_dia?programacion_id=eq.${progId}&dia=eq.${nov.dia}&rol=eq.${nov.rol}&select=id`
      );
      if (Array.isArray(findA.body) && findA.body.length > 0) {
        const asigId = findA.body[0].id;
        await supabaseReq('PATCH', `asignaciones_dia?id=eq.${asigId}`, { jornada: nov.jornada });
        process.stdout.write(`[NOV:${nov.jornada.slice(0,3).toUpperCase()}d${nov.dia}] `);
      }
    }
  }

  console.log('✅');
  return progId;
}

async function main() {
  console.log('\n🛡️  CORAZA CTA — Fix & Complete Seed\n');

  // ── Get valid tipo values ──────────────────────────────────────────────────
  console.log('🔍 Checking valid tipo values...');
  const allPuestos = await supabaseReq('GET', 'puestos?select=tipo&limit=100');
  const tipos = [...new Set((allPuestos.body || []).map(p => p.tipo))];
  console.log('  Valid tipos found:', tipos);

  const validTipo = tipos[0] || 'hospital';
  console.log(`  Using fallback tipo: ${validTipo}\n`);

  // ── Fix Clínica and Central novedades (wrong month) ──────────────────────
  console.log('🔧 Fixing novedades for Clínica and Central (should be April = mes 3)...');
  
  const puestosToFix = [
    { nombre: 'Clínica San Juan de Dios', rol: 'titular_a', dia: 5,  jornadaWrong: 'descanso_remunerado', jornadaRight: 'licencia' },
    { nombre: 'Central Cotraza',          rol: 'titular_b', dia: 8,  jornadaWrong: 'normal',             jornadaRight: 'suspension' },
  ];

  for (const fix of puestosToFix) {
    // Find the puesto
    const findP = await supabaseReq('GET',
      `puestos?nombre=eq.${encodeURIComponent(fix.nombre)}&empresa_id=eq.${EMPRESA_ID}&select=id`
    );
    if (!Array.isArray(findP.body) || findP.body.length === 0) { console.log(`  ⚠️ Not found: ${fix.nombre}`); continue; }
    const pId = findP.body[0].id;

    // Find April programacion (mes=3, April in 0-based indexing)
    const findProg = await supabaseReq('GET',
      `programacion_mensual?puesto_id=eq.${pId}&anio=eq.${YEAR}&mes=eq.3&select=id`
    );
    if (!Array.isArray(findProg.body) || findProg.body.length === 0) { console.log(`  ⚠️ No April prog: ${fix.nombre}`); continue; }
    const progId = findProg.body[0].id;

    // Find the asignacion
    const findA = await supabaseReq('GET',
      `asignaciones_dia?programacion_id=eq.${progId}&dia=eq.${fix.dia}&rol=eq.${fix.rol}&select=id,jornada`
    );
    if (!Array.isArray(findA.body) || findA.body.length === 0) { console.log(`  ⚠️ No asig found: ${fix.nombre} d${fix.dia}`); continue; }
    
    const asigId = findA.body[0].id;
    const upd = await supabaseReq('PATCH', `asignaciones_dia?id=eq.${asigId}`, { jornada: fix.jornadaRight });
    console.log(`  ${fix.nombre} - d${fix.dia} ${fix.rol}: ${fix.jornadaWrong} → ${fix.jornadaRight} (${upd.status === 200 ? '✅' : '❌'})`);
  }

  // ── Create Torre and Plaza with valid tipo ────────────────────────────────
  console.log('\n📍 Creating Torre Empresarial Buenavista and Plaza Madeira...\n');

  const newPuestoIds = [];
  for (let i = 0; i < REMAINING_PUESTOS.length; i++) {
    const p = REMAINING_PUESTOS[i];
    
    // Check if exists
    const check = await supabaseReq('GET',
      `puestos?nombre=eq.${encodeURIComponent(p.nombre)}&empresa_id=eq.${EMPRESA_ID}&select=id`
    );
    if (Array.isArray(check.body) && check.body.length > 0) {
      console.log(`  📌 ${p.nombre} → EXISTS (${check.body[0].id})`);
      newPuestoIds.push(check.body[0].id);
      continue;
    }

    const payload = {
      empresa_id: EMPRESA_ID,
      nombre: p.nombre, tipo: validTipo,
      direccion: p.direccion, latitud: p.latitud, longitud: p.longitud,
      prioridad: p.prioridad, estado: 'Activo',
      instrucciones: p.instrucciones,
      con_armamento: false,
      requerimiento_hombres: p.requerimiento_hombres,
    };

    const res = await supabaseReq('POST', 'puestos', payload);
    if (res.status === 201 && Array.isArray(res.body)) {
      console.log(`  ✅ Created: ${p.nombre} → ${res.body[0].id}`);
      newPuestoIds.push(res.body[0].id);
    } else {
      console.log(`  ❌ Failed: ${p.nombre} → ${res.status}: ${JSON.stringify(res.body).slice(0,200)}`);
      newPuestoIds.push(null);
    }
  }

  // ── Generate 12 months for Torre and Plaza ────────────────────────────────
  for (let i = 0; i < REMAINING_PUESTOS.length; i++) {
    const pId = newPuestoIds[i];
    if (!pId) { console.log(`\n⚠️ Skipping ${REMAINING_PUESTOS[i].nombre} - no ID`); continue; }

    const p = REMAINING_PUESTOS[i];
    const roles = p.roles.map(r => ({ ...r })); // mutable copy
    
    console.log(`\n🏢 ${p.nombre}`);
    for (let mes = 0; mes <= 11; mes++) {
      await createProgramacionWithAsigs(pId, p.nombre, roles, mes);
    }
  }

  // ── Final Verification ────────────────────────────────────────────────────
  console.log('\n\n🔍 FINAL VERIFICATION\n');
  
  const allP = await supabaseReq('GET',
    `puestos?empresa_id=eq.${EMPRESA_ID}&select=id,nombre,instrucciones,zona&order=created_at.asc`
  );
  const pRows = Array.isArray(allP.body) ? allP.body : [];
  
  const targetNames = [
    'Clínica San Juan de Dios', 'Central Cotraza',
    'Torre Empresarial Buenavista', 'Plaza Madeira'
  ];

  for (const name of targetNames) {
    const pRow = pRows.find(p => p.nombre === name);
    if (!pRow) { console.log(`❌ ${name} — NOT FOUND`); continue; }

    const zona = pRow.zona || (pRow.instrucciones || '').split('|')[0]?.replace('ZONA:', '') || '—';
    
    // Count programaciones
    const vProgs = await supabaseReq('GET',
      `programacion_mensual?puesto_id=eq.${pRow.id}&anio=eq.${YEAR}&select=id,mes&order=mes.asc`
    );
    const progCount = Array.isArray(vProgs.body) ? vProgs.body.length : 0;

    // Check April novedad
    const aprilProg = Array.isArray(vProgs.body) ? vProgs.body.find(p => p.mes === 3) : null;
    let novStr = 'N/A';
    if (aprilProg) {
      const novDef = [...puestosToFix, ...TEST_NOVEDADES.map(n => ({ nombre: n.puestoName, rol: n.rol, dia: n.dia, jornadaRight: n.jornada }))].find(n => n.nombre === name);
      if (novDef) {
        const asigCheck = await supabaseReq('GET',
          `asignaciones_dia?programacion_id=eq.${aprilProg.id}&dia=eq.${novDef.dia}&rol=eq.${novDef.rol}&select=jornada`
        );
        if (Array.isArray(asigCheck.body) && asigCheck.body.length > 0) {
          const got = asigCheck.body[0].jornada;
          const expected = novDef.jornadaRight;
          novStr = `${expected}=${got} ${got === expected ? '✅' : '❌'}`;
        }
      }
    }

    console.log(`📍 ${name}`);
    console.log(`   Zona: ${zona}`);
    console.log(`   Programaciones 2026: ${progCount}/12`);
    console.log(`   Novedad Abril: ${novStr}`);
    console.log();
  }

  console.log('🎯 ALL DONE!\n');
  console.log('🔗 https://coraza-cta-app.vercel.app');
}

// Fix for puestosToFix reference in verification
const puestosToFix = [
  { nombre: 'Clínica San Juan de Dios', rol: 'titular_a', dia: 5,  jornadaRight: 'licencia' },
  { nombre: 'Central Cotraza',          rol: 'titular_b', dia: 8,  jornadaRight: 'suspension' },
];

main().catch(err => { console.error('❌', err); process.exit(1); });
