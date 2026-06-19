/**
 * Add missing columns via Supabase RPC (SQL execution)
 * Then seed 4 puestos + 12 months + test novedades
 */
const https = require('https');
const SUPABASE_URL = 'ylcpizjfwupfvffsbjmz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const YEAR = 2026;

function supabaseReq(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_URL,
      path: path.startsWith('/') ? path : `/rest/v1/${path}`,
      method,
      headers: {
        'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...extraHeaders,
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

// Execute SQL via Supabase RPC exec_sql (if available) or migrations
async function execSQL(sql) {
  const r = await supabaseReq('POST', '/rest/v1/rpc/exec_sql', { sql });
  return r;
}

// ─── Cycle Engine ─────────────────────────────────────────────────────────────
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

const PUESTOS_DEF = [
  {
    nombre: 'Clínica San Juan de Dios',
    tipo: 'hospital', prioridad: 'alta', zona: 'Zona Norte',
    direccion: 'Cra. 54 #67-23, Barranquilla', latitud: 10.9878, longitud: -74.7889,
    instrucciones: 'Entrada principal, portería norte',
    roles: [{ rol: 'titular_a', startPos: 1 }, { rol: 'titular_b', startPos: 10 }],
  },
  {
    nombre: 'Central Cotraza',
    tipo: 'banco', prioridad: 'alta', zona: 'Zona Centro',
    direccion: 'Cl. 72 #45-10, Barranquilla', latitud: 10.9754, longitud: -74.8012,
    instrucciones: 'Lobby bancario, acceso cajeros', con_armamento: true,
    roles: [{ rol: 'titular_a', startPos: 10 }, { rol: 'titular_b', startPos: 1 }],
  },
  {
    nombre: 'Torre Empresarial Buenavista',
    tipo: 'oficina', prioridad: 'media', zona: 'Zona Sur',
    direccion: 'Cra. 53 #98-07, Barranquilla', latitud: 11.0123, longitud: -74.8201,
    instrucciones: 'Recepción principal piso 1',
    roles: [{ rol: 'titular_a', startPos: 1 }, { rol: 'titular_b', startPos: 7 }, { rol: 'relevante', startPos: 4 }],
  },
  {
    nombre: 'Plaza Madeira',
    tipo: 'centro_comercial', prioridad: 'alta', zona: 'Zona 20',
    direccion: 'Av. Circunvalar #38-55, Barranquilla', latitud: 10.9901, longitud: -74.7765,
    instrucciones: 'Parqueadero nivel -1, caseta de control',
    roles: [{ rol: 'titular_a', startPos: 10 }, { rol: 'titular_b', startPos: 14 }, { rol: 'relevante', startPos: 1 }],
  },
];

// Test novedades for April (mes=4)
const TEST_NOVEDADES = [
  { puestoIdx: 0, rol: 'titular_a', dia: 5,  jornada: 'licencia'   },
  { puestoIdx: 1, rol: 'titular_b', dia: 8,  jornada: 'suspension' },
  { puestoIdx: 2, rol: 'relevante', dia: 12, jornada: 'accidente'  },
  { puestoIdx: 3, rol: 'titular_a', dia: 15, jornada: 'incapacidad'},
];

async function main() {
  console.log('\n🛡️  CORAZA CTA — Corrected Seed Script\n');

  // ── Step 1: Add missing columns via RPC if available ─────────────────────────
  console.log('🔧 Step 1: Adding missing columns...');

  // Try exec_sql RPC
  const sqlZona = `ALTER TABLE puestos ADD COLUMN IF NOT EXISTS zona TEXT;`;
  const sqlCodigo = `ALTER TABLE asignaciones_dia ADD COLUMN IF NOT EXISTS codigo_personalizado TEXT;`;
  
  const r1 = await execSQL(sqlZona);
  if (r1.status === 200) {
    console.log('  ✅ Added zona column to puestos');
  } else {
    console.log('  ⚠️ exec_sql not available:', r1.status);
    
    // Alternative: try supabase-js style migration via REST
    // We'll use the instrucciones field to store zona as a workaround
    console.log('  ℹ️ Will store zona in instrucciones field as workaround');
  }

  const r2 = await execSQL(sqlCodigo);
  if (r2.status === 200) {
    console.log('  ✅ Added codigo_personalizado column to asignaciones_dia');
  } else {
    console.log('  ⚠️ codigo_personalizado not added via RPC');
  }

  // ── Step 2: Create / find puestos ─────────────────────────────────────────────
  console.log('\n📍 Step 2: Creating puestos...\n');
  const puestoIds = [];

  for (const p of PUESTOS_DEF) {
    // Check if exists
    const check = await supabaseReq('GET',
      `puestos?nombre=eq.${encodeURIComponent(p.nombre)}&empresa_id=eq.${EMPRESA_ID}&select=id,nombre,zona,instrucciones`
    );

    if (check.status === 200 && Array.isArray(check.body) && check.body.length > 0) {
      const existing = check.body[0];
      console.log(`  📌 ${p.nombre} → EXISTS (${existing.id})`);
      
      // Try to update zona and instrucciones
      const updPayload = {};
      // Try zona column first
      const tryZona = await supabaseReq('PATCH', `puestos?id=eq.${existing.id}`, { zona: p.zona });
      if (tryZona.status !== 400) {
        console.log(`     ✅ zona updated: ${p.zona}`);
      } else {
        // Fallback: store zona in instrucciones field
        const combined = `ZONA:${p.zona}|${p.instrucciones}`;
        await supabaseReq('PATCH', `puestos?id=eq.${existing.id}`, { instrucciones: combined });
        console.log(`     ↳ zona stored in instrucciones: ${p.zona}`);
      }
      
      puestoIds.push(existing.id);
      continue;
    }

    // Create new - use correct column names
    const payload = {
      empresa_id: EMPRESA_ID,
      nombre: p.nombre,
      tipo: p.tipo,
      direccion: p.direccion,
      latitud: p.latitud,
      longitud: p.longitud,
      prioridad: p.prioridad,
      estado: 'Activo',
      instrucciones: `ZONA:${p.zona}|${p.instrucciones}`,
      con_armamento: p.con_armamento || false,
      requerimiento_hombres: p.roles.filter(r => r.rol !== 'relevante').length,
    };

    // Try with zona column
    const withZona = { ...payload, zona: p.zona };
    let res = await supabaseReq('POST', 'puestos', withZona);
    
    if (res.status === 400 && JSON.stringify(res.body).includes('zona')) {
      // zona column doesn't exist, use without it
      res = await supabaseReq('POST', 'puestos', payload);
    }

    if (res.status === 201 && Array.isArray(res.body) && res.body.length > 0) {
      const newId = res.body[0].id;
      console.log(`  ✅ Created: ${p.nombre} → ${newId}`);
      puestoIds.push(newId);
    } else {
      console.log(`  ❌ Failed: ${p.nombre} → status ${res.status}: ${JSON.stringify(res.body).slice(0,150)}`);
      // Try to find it
      const retry = await supabaseReq('GET',
        `puestos?nombre=eq.${encodeURIComponent(p.nombre)}&empresa_id=eq.${EMPRESA_ID}&select=id`
      );
      if (Array.isArray(retry.body) && retry.body.length > 0) {
        puestoIds.push(retry.body[0].id);
        console.log(`     ↳ Found anyway: ${retry.body[0].id}`);
      } else {
        puestoIds.push(null);
      }
    }
  }

  console.log('\n📋 Puesto IDs:', puestoIds.map((id, i) => `${PUESTOS_DEF[i].nombre.split(' ')[0]}: ${id}`));

  // ── Step 3: Create programaciones + asignaciones ──────────────────────────────
  console.log('\n📅 Step 3: Generating 12 months programming...\n');

  for (let pIdx = 0; pIdx < PUESTOS_DEF.length; pIdx++) {
    const puestoId = puestoIds[pIdx];
    if (!puestoId) { console.log(`⚠️ Skipping puesto ${pIdx} - no ID`); continue; }

    const pData = PUESTOS_DEF[pIdx];
    const roles = pData.roles.map(r => ({ ...r })); // mutable copy
    
    console.log(`\n🏢 ${pData.nombre}`);

    for (let mes = 0; mes <= 11; mes++) {
      const mesNombre = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][mes];
      const daysInMonth = new Date(YEAR, mes + 1, 0).getDate();

      // Check existing programacion
      const checkProg = await supabaseReq('GET',
        `programacion_mensual?puesto_id=eq.${puestoId}&anio=eq.${YEAR}&mes=eq.${mes}&empresa_id=eq.${EMPRESA_ID}&select=id`
      );

      let progId;

      if (checkProg.status === 200 && Array.isArray(checkProg.body) && checkProg.body.length > 0) {
        progId = checkProg.body[0].id;
        process.stdout.write(`  [${mesNombre}] exists(${progId.slice(-8)}) `);
      } else {
        // Create programacion_mensual
        const progPayload = {
          empresa_id: EMPRESA_ID,
          puesto_id: puestoId,
          anio: YEAR,
          mes,
          estado: mes < 3 ? 'publicado' : 'borrador',
          version: 1,
        };

        const progRes = await supabaseReq('POST', 'programacion_mensual', progPayload);
        if (progRes.status === 201 && Array.isArray(progRes.body) && progRes.body.length > 0) {
          progId = progRes.body[0].id;
          process.stdout.write(`  [${mesNombre}] created(${progId.slice(-8)}) `);
        } else {
          console.log(`  [${mesNombre}] ❌ prog create failed: ${progRes.status}`);
          // Advance positions
          for (const r of roles) r.startPos += daysInMonth;
          continue;
        }
      }

      // Create personal_puesto records
      for (const role of roles) {
        const checkPP = await supabaseReq('GET',
          `personal_puesto?programacion_id=eq.${progId}&rol=eq.${role.rol}&select=id`
        );
        if (checkPP.status !== 200 || !Array.isArray(checkPP.body) || checkPP.body.length === 0) {
          await supabaseReq('POST', 'personal_puesto', {
            programacion_id: progId,
            rol: role.rol,
            vigilante_id: null,
          });
        }
      }

      // Check if asignaciones already exist
      const checkAsigs = await supabaseReq('GET',
        `asignaciones_dia?programacion_id=eq.${progId}&select=id&limit=1`
      );
      const hasAsigs = checkAsigs.status === 200 && Array.isArray(checkAsigs.body) && checkAsigs.body.length > 0;

      if (hasAsigs) {
        process.stdout.write('asigs_exist ');
        // Still advance positions
        for (const r of roles) r.startPos += daysInMonth;
      } else {
        // Batch insert asignaciones
        const asigsBatch = [];
        const rolesCopy = roles.map(r => ({ ...r })); // snapshot for this month

        for (const role of rolesCopy) {
          let pos = role.startPos;
          for (let d = 1; d <= daysInMonth; d++) {
            const { jornada, turno } = getJornada(pos);
            asigsBatch.push({
              programacion_id: progId,
              dia: d,
              rol: role.rol,
              vigilante_id: null,
              turno,
              jornada,
              inicio: turno === 'PM' ? '18:00' : '06:00',
              fin:   turno === 'PM' ? '06:00' : '18:00',
            });
            pos++;
          }
        }

        // Advance positions for next month
        for (const r of roles) r.startPos += daysInMonth;

        // Insert in batches of 50
        const BATCH = 50;
        let successCount = 0;
        for (let i = 0; i < asigsBatch.length; i += BATCH) {
          const chunk = asigsBatch.slice(i, i + BATCH);
          const insRes = await supabaseReq('POST', 'asignaciones_dia', chunk);
          if (insRes.status === 201) {
            successCount += chunk.length;
          } else {
            console.log(`\n  ⚠️ Batch insert failed at ${i}: ${insRes.status} ${JSON.stringify(insRes.body).slice(0,100)}`);
          }
        }
        process.stdout.write(`${successCount}asigs `);

        // Apply test novedades for April (mes=4)
        if (mes === 4) {
          const novedades = TEST_NOVEDADES.filter(n => n.puestoIdx === pIdx);
          for (const nov of novedades) {
            // Find the asignacion for this dia+rol
            const findAsig = await supabaseReq('GET',
              `asignaciones_dia?programacion_id=eq.${progId}&dia=eq.${nov.dia}&rol=eq.${nov.rol}&select=id`
            );
            if (findAsig.status === 200 && Array.isArray(findAsig.body) && findAsig.body.length > 0) {
              const asigId = findAsig.body[0].id;
              // Update jornada (and try codigo_personalizado)
              const updatePayload = { jornada: nov.jornada };
              
              // Try with codigo_personalizado
              const updateRes = await supabaseReq('PATCH',
                `asignaciones_dia?id=eq.${asigId}`,
                { ...updatePayload, codigo_personalizado: nov.jornada.toUpperCase().slice(0,2) }
              );
              if (updateRes.status === 400) {
                // Fallback without codigo_personalizado
                await supabaseReq('PATCH', `asignaciones_dia?id=eq.${asigId}`, updatePayload);
              }
              process.stdout.write(`[NOV:${nov.jornada.slice(0,2).toUpperCase()}d${nov.dia}] `);
            }
          }
        }
      }

      console.log('✅');
    }
  }

  // ── Step 4: Verify ─────────────────────────────────────────────────────────
  console.log('\n\n🔍 Step 4: Final Verification\n');

  for (let pIdx = 0; pIdx < PUESTOS_DEF.length; pIdx++) {
    const pId = puestoIds[pIdx];
    if (!pId) continue;
    const pData = PUESTOS_DEF[pIdx];

    // Count programaciones
    const vProgs = await supabaseReq('GET',
      `programacion_mensual?puesto_id=eq.${pId}&anio=eq.${YEAR}&select=id,mes,estado`
    );
    const progCount = Array.isArray(vProgs.body) ? vProgs.body.length : 0;

    // Count April asignaciones
    const aprilProg = Array.isArray(vProgs.body) ? vProgs.body.find(p => p.mes === 4) : null;
    let aprilAsigCount = 0;
    let novedadStatus = 'N/A';

    if (aprilProg) {
      const asigCheck = await supabaseReq('GET',
        `asignaciones_dia?programacion_id=eq.${aprilProg.id}&select=dia,rol,jornada&limit=200`
      );
      if (Array.isArray(asigCheck.body)) {
        aprilAsigCount = asigCheck.body.length;
        const nov = TEST_NOVEDADES.find(n => n.puestoIdx === pIdx);
        if (nov) {
          const cell = asigCheck.body.find(a => a.dia === nov.dia && a.rol === nov.rol);
          novedadStatus = cell ? `${nov.jornada}=${cell.jornada}(${cell.jornada === nov.jornada ? '✅' : '❌'})` : '⚠️ not found';
        }
      }
    }

    const pRow = await supabaseReq('GET', `puestos?id=eq.${pId}&select=nombre,instrucciones,zona`);
    const pInfo = Array.isArray(pRow.body) ? pRow.body[0] : {};
    const zonaFound = pInfo.zona || (pInfo.instrucciones || '').split('|')[0]?.replace('ZONA:', '') || '❌';

    console.log(`📍 ${pData.nombre}`);
    console.log(`   Zona detectada: ${zonaFound}`);
    console.log(`   Programaciones ${YEAR}: ${progCount}/12`);
    console.log(`   Asigs Abril: ${aprilAsigCount}`);
    console.log(`   Novedad prueba: ${novedadStatus}`);
    console.log();
  }

  console.log('🎯 Seed COMPLETO!\n');
  console.log('🔗 App: https://coraza-cta-app.vercel.app\n');
  
  console.log('📊 RESUMEN POR MES:');
  const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  console.log('  Por favor verifica en la app Vercel que:');
  console.log('  ✅ Los 4 puestos aparecen en "Gestión de Puestos"');
  console.log('  ✅ Al abrir cada puesto, los 12 meses tienen tablero');
  console.log('  ✅ En Abril, las celdas de novedad muestran el color especial');
  console.log('  ✅ El PDF/Excel incluye la zona en el encabezado\n');
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
