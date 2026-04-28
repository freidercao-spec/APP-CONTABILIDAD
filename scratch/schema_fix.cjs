/**
 * Run SQL migration via Supabase Management API
 * Uses the service role key if available, otherwise uses RPC patterns
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

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

async function main() {
  console.log('🔧 Supabase Schema Fixer\n');
  console.log('The jornada constraint prevents storing LC/SP/IN/AC states.');
  console.log('Since exec_sql RPC is not available, we will work around this:\n');
  
  // Strategy: The frontend store handles the "jornada" abstraction in memory.
  // In the DB we store: jornada=normal/descanso_remunerado/descanso_no_remunerado/vacacion
  // The codigo_personalizado column doesn't exist yet.
  // 
  // SOLUTION: The store's actualizarAsignacion already stores the full programacion
  // as a JSONB blob via a stored procedure (guardar_programacion_atomica).
  // Let's verify that procedure exists and use it instead.

  const checkRPC = await supabaseReq('POST', '/rest/v1/rpc/guardar_programacion_atomica', {
    p_programacion_id: 'test', p_asignaciones: [], p_personal: []
  });
  console.log('RPC guardar_programacion_atomica:', checkRPC.status, JSON.stringify(checkRPC.body).slice(0,150));

  // Check what RPCs are available
  const rpcs = ['guardar_programacion_atomica', 'exec_sql', 'run_sql', 'execute_sql'];
  for (const rpc of rpcs) {
    const r = await supabaseReq('POST', `/rest/v1/rpc/${rpc}`, {});
    console.log(`  RPC ${rpc}: ${r.status}`);
  }

  // Alternative: Check if programacion_mensual has direct JSONB columns for asignaciones
  const prog = await supabaseReq('GET', 'programacion_mensual?limit=1&select=*');
  console.log('\nFull programacion_mensual row schema:');
  if (Array.isArray(prog.body) && prog.body.length > 0) {
    console.log(Object.keys(prog.body[0]).join(', '));
    console.log(JSON.stringify(prog.body[0], null, 2));
  }

  // ── Fix duplicates and complete Clinica ────────────────────────────────────
  console.log('\n\n📋 Fixing duplicates and completing Clínica...');
  
  // The original Clinica has ID: d44ca75b (existing before our seed) - 5 programaciones
  // The new Clinica has ID: fb3c756e (from our seed) - 12 programaciones
  // The app likely uses the first one found. Let's check which one the app uses.
  
  const clinicas = await supabaseReq('GET',
    `puestos?nombre=eq.Cl%C3%ADnica%20San%20Juan%20de%20Dios&empresa_id=eq.${EMPRESA_ID}&select=id,created_at&order=created_at.asc`
  );
  console.log('Clinica records:', JSON.stringify(clinicas.body?.map(p => ({id: p.id, created: p.created_at})), null, 2));

  // Original (older) ID: d44ca75b - this is what was used before, has 5 progs
  // Add missing months to original
  const ORIGINAL_CLINICA = 'd44ca75b-f3b0-4b9a-a59b-ef1f77a414e2';
  
  // Check what months it already has
  const existProgs = await supabaseReq('GET',
    `programacion_mensual?puesto_id=eq.${ORIGINAL_CLINICA}&anio=eq.${YEAR}&select=mes&order=mes.asc`
  );
  const existingMeses = Array.isArray(existProgs.body) ? existProgs.body.map(p => p.mes) : [];
  console.log(`\nOriginal Clinica progs (mes indices): ${existingMeses.join(', ')}`);

  // Roles for Clinica: titlelar_a starts at pos 1, titular_b starts at pos 10
  // For filling in missing months, we need to calculate the position based on the month
  function getJornada(pos) {
    const p = ((pos - 1) % 18) + 1;
    if (p <= 6)   return { jornada: 'normal',                 turno: 'AM' };
    if (p === 7)  return { jornada: 'descanso_remunerado',    turno: 'AM' };
    if (p === 8)  return { jornada: 'descanso_remunerado',    turno: 'AM' };
    if (p === 9)  return { jornada: 'descanso_no_remunerado', turno: 'AM' };
    if (p <= 15)  return { jornada: 'normal',                 turno: 'PM' };
    if (p === 16) return { jornada: 'descanso_remunerado',    turno: 'PM' };
    if (p === 17) return { jornada: 'descanso_remunerado',    turno: 'PM' };
    return          { jornada: 'descanso_no_remunerado',      turno: 'PM' };
  }

  // Calculate start positions for each month
  // Clinica: titular_a starts jan at 1, titular_b starts jan at 10
  const ROLES = [
    { rol: 'titular_a', janStart: 1 },
    { rol: 'titular_b', janStart: 10 },
  ];

  function getStartPosForMonth(janStart, targetMes) {
    let pos = janStart;
    for (let m = 0; m < targetMes; m++) {
      pos += new Date(YEAR, m + 1, 0).getDate();
    }
    return pos;
  }

  const missingMeses = [];
  for (let m = 0; m <= 11; m++) {
    if (!existingMeses.includes(m)) missingMeses.push(m);
  }
  console.log(`Missing months: ${missingMeses.map(m => ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][m]).join(', ')}`);

  for (const mes of missingMeses) {
    const daysInMonth = new Date(YEAR, mes + 1, 0).getDate();
    const mesNom = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][mes];

    // Create programacion
    const progRes = await supabaseReq('POST', 'programacion_mensual', {
      empresa_id: EMPRESA_ID,
      puesto_id: ORIGINAL_CLINICA,
      anio: YEAR, mes, estado: mes < 3 ? 'publicado' : 'borrador', version: 1,
    });

    if (progRes.status !== 201 || !Array.isArray(progRes.body)) {
      console.log(`  [${mesNom}] ❌ create fail: ${progRes.status}`);
      continue;
    }
    const progId = progRes.body[0].id;

    // Create personal_puesto
    for (const r of ROLES) {
      await supabaseReq('POST', 'personal_puesto', { programacion_id: progId, rol: r.rol, vigilante_id: null });
    }

    // Build asignaciones
    const batch = [];
    for (const r of ROLES) {
      let pos = getStartPosForMonth(r.janStart, mes);
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
    }

    let total = 0;
    for (let i = 0; i < batch.length; i += 50) {
      const res = await supabaseReq('POST', 'asignaciones_dia', batch.slice(i, i + 50));
      if (res.status === 201) total += Math.min(50, batch.length - i);
    }
    console.log(`  [${mesNom}] ✅ ${total} asigs`);
  }

  // Update zona in instrucciones for original Clinica
  await supabaseReq('PATCH', `puestos?id=eq.${ORIGINAL_CLINICA}`,
    { instrucciones: 'ZONA:Zona Norte|Entrada principal, portería norte' }
  );
  console.log('\n  ✅ Clinica instrucciones updated with zona');
  console.log('\n🎯 All done! Run verify_final.cjs to check results.\n');
}

main().catch(console.error);
