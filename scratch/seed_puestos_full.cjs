/**
 * CORAZA CTA — Full Seed Script
 * Creates 4 puestos + 12-month programming + test states
 * Run: node scratch/seed_puestos_full.cjs
 */

const https = require('https');

const SUPABASE_URL = 'ylcpizjfwupfvffsbjmz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';
const YEAR = 2026;

// ─── Helper: HTTP request to Supabase REST API ───────────────────────────────
function supabaseReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
      },
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── TURNO CYCLE ENGINE ───────────────────────────────────────────────────────
// Cycle: 6D + 3REST(2R+1NR) + 6N + 3REST(2R+1NR) = 18 days
// Position 1-based: 1-6=D, 7=DR, 8=DR, 9=NR, 10-15=N, 16=DR, 17=DR, 18=NR
function getJornada(pos) {
  const p = ((pos - 1) % 18) + 1;
  if (p <= 6)  return { jornada: 'normal',                 turno: 'AM', codigo: 'D' };
  if (p === 7) return { jornada: 'descanso_remunerado',    turno: 'AM', codigo: 'DR' };
  if (p === 8) return { jornada: 'descanso_remunerado',    turno: 'AM', codigo: 'DR' };
  if (p === 9) return { jornada: 'descanso_no_remunerado', turno: 'AM', codigo: 'NR' };
  if (p <= 15) return { jornada: 'normal',                 turno: 'PM', codigo: 'N' };
  if (p === 16) return { jornada: 'descanso_remunerado',   turno: 'PM', codigo: 'DR' };
  if (p === 17) return { jornada: 'descanso_remunerado',   turno: 'PM', codigo: 'DR' };
  return         { jornada: 'descanso_no_remunerado',      turno: 'PM', codigo: 'NR' };
}

function genMonthAsignaciones(roles, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const asigs = [];

  for (const role of roles) {
    let pos = role.startPos;
    for (let d = 1; d <= daysInMonth; d++) {
      const { jornada, turno } = getJornada(pos);
      asigs.push({
        dia: d,
        rol: role.rol,
        vigilanteId: null,
        turno,
        jornada,
        inicio: turno === 'PM' ? '18:00' : '06:00',
        fin:   turno === 'PM' ? '06:00' : '18:00',
      });
      pos++;
    }
    // Advance startPos for next month
    role.startPos = pos;
  }
  return asigs;
}

// ─── PUESTOS DATA ─────────────────────────────────────────────────────────────
const PUESTOS = [
  {
    id: 'pst-0001-clinica-san-juan',
    nombre: 'Clínica San Juan de Dios',
    tipo: 'hospital',
    direccion: 'Cra. 54 #67-23, Barranquilla',
    lat: 10.9878, lng: -74.7889,
    zona: 'Zona Norte',
    prioridad: 'alta',
    cliente: 'Clínica San Juan de Dios',
    estado: 'activo',
    instrucciones: 'Entrada principal, portería norte',
    conArmamento: false,
    empresaId: EMPRESA_ID,
    roles: [
      { rol: 'titular_a', startPos: 1  },
      { rol: 'titular_b', startPos: 10 },
    ],
  },
  {
    id: 'pst-0002-central-cotraza',
    nombre: 'Central Cotraza',
    tipo: 'banco',
    direccion: 'Cl. 72 #45-10, Barranquilla',
    lat: 10.9754, lng: -74.8012,
    zona: 'Zona Centro',
    prioridad: 'alta',
    cliente: 'Central Cotraza',
    estado: 'activo',
    instrucciones: 'Lobby bancario, acceso cajeros',
    conArmamento: true,
    empresaId: EMPRESA_ID,
    roles: [
      { rol: 'titular_a', startPos: 10 },
      { rol: 'titular_b', startPos: 1  },
    ],
  },
  {
    id: 'pst-0003-torre-buenavista',
    nombre: 'Torre Empresarial Buenavista',
    tipo: 'edificio_corporativo',
    direccion: 'Cra. 53 #98-07, Barranquilla',
    lat: 11.0123, lng: -74.8201,
    zona: 'Zona Sur',
    prioridad: 'media',
    cliente: 'Torre Buenavista S.A.',
    estado: 'activo',
    instrucciones: 'Recepción principal piso 1',
    conArmamento: false,
    empresaId: EMPRESA_ID,
    roles: [
      { rol: 'titular_a', startPos: 1 },
      { rol: 'titular_b', startPos: 7 },
      { rol: 'relevante', startPos: 4 }, // offset +3
    ],
  },
  {
    id: 'pst-0004-plaza-madeira',
    nombre: 'Plaza Madeira',
    tipo: 'centro_comercial',
    direccion: 'Av. Circunvalar #38-55, Barranquilla',
    lat: 10.9901, lng: -74.7765,
    zona: 'Zona 20',
    prioridad: 'alta',
    cliente: 'Plaza Madeira S.A.S.',
    estado: 'activo',
    instrucciones: 'Parqueadero nivel -1, caseta de control',
    conArmamento: false,
    empresaId: EMPRESA_ID,
    roles: [
      { rol: 'titular_a', startPos: 10 },
      { rol: 'titular_b', startPos: 14 }, // offset +4 from pos 10
      { rol: 'relevante', startPos: 1  },
    ],
  },
];

// Test novedades to apply after seeding (for QA validation)
const TEST_NOVEDADES = [
  { puestoIdx: 0, rol: 'titular_a', dia: 5,  mes: 4, jornada: 'licencia',     turno: 'AM', codigo: 'LC' },
  { puestoIdx: 1, rol: 'titular_b', dia: 8,  mes: 4, jornada: 'suspension',   turno: 'AM', codigo: 'SP' },
  { puestoIdx: 2, rol: 'relevante', dia: 12, mes: 4, jornada: 'accidente',    turno: 'AM', codigo: 'AC' },
  { puestoIdx: 3, rol: 'titular_a', dia: 15, mes: 4, jornada: 'incapacidad',  turno: 'AM', codigo: 'IN' },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🛡️  CORAZA CTA — Full Seed Starting...\n');

  const createdPuestoIds = [];

  // ── PHASE 1: Create / upsert puestos ────────────────────────────────────────
  for (const p of PUESTOS) {
    console.log(`📍 Creating puesto: ${p.nombre}`);

    // Check if already exists
    const check = await supabaseReq('GET', `puestos?nombre=eq.${encodeURIComponent(p.nombre)}&empresa_id=eq.${EMPRESA_ID}`);
    let existingId = null;
    if (check.status === 200 && Array.isArray(check.body) && check.body.length > 0) {
      existingId = check.body[0].id;
      console.log(`  ↳ Already exists with id: ${existingId}`);
      // Update zona if missing
      const upd = await supabaseReq('PATCH', `puestos?id=eq.${existingId}`, { zona: p.zona });
      console.log(`  ↳ Updated zona: ${p.zona} (status ${upd.status})`);
      createdPuestoIds.push(existingId);
      continue;
    }

    // Create new
    const payload = {
      nombre: p.nombre,
      tipo: p.tipo,
      direccion: p.direccion,
      lat: p.lat,
      lng: p.lng,
      zona: p.zona,
      prioridad: p.prioridad,
      cliente: p.cliente,
      estado: p.estado,
      instrucciones: p.instrucciones,
      con_armamento: p.conArmamento,
      empresa_id: EMPRESA_ID,
      created_at: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };

    const res = await supabaseReq('POST', 'puestos', payload);
    if (res.status === 201 && Array.isArray(res.body) && res.body.length > 0) {
      const newId = res.body[0].id;
      console.log(`  ✅ Created! ID: ${newId}`);
      createdPuestoIds.push(newId);
    } else {
      console.log(`  ⚠️ Response ${res.status}:`, JSON.stringify(res.body).slice(0, 200));
      // Try to find the created puesto anyway
      const retry = await supabaseReq('GET', `puestos?nombre=eq.${encodeURIComponent(p.nombre)}&empresa_id=eq.${EMPRESA_ID}`);
      if (retry.status === 200 && Array.isArray(retry.body) && retry.body.length > 0) {
        const retryId = retry.body[0].id;
        console.log(`  ↳ Found after retry: ${retryId}`);
        createdPuestoIds.push(retryId);
      } else {
        createdPuestoIds.push(null);
        console.log(`  ❌ Could not verify creation`);
      }
    }
  }

  console.log('\n📋 Puesto IDs:', createdPuestoIds);

  // ── PHASE 2: Create programaciones (12 months) ───────────────────────────────
  console.log('\n📅 Generating 12 months of programming...\n');

  for (let pIdx = 0; pIdx < PUESTOS.length; pIdx++) {
    const puestoId = createdPuestoIds[pIdx];
    if (!puestoId) { console.log(`⚠️ Skipping puesto ${pIdx} - no ID`); continue; }

    const pData = PUESTOS[pIdx];
    // Deep copy roles with mutable startPos
    const roles = pData.roles.map(r => ({ ...r }));

    console.log(`\n🏢 ${pData.nombre} (${puestoId})`);

    for (let mes = 0; mes <= 11; mes++) {
      const mesNombre = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][mes];

      // Check if programming already exists
      const checkProg = await supabaseReq('GET',
        `programaciones?puesto_id=eq.${puestoId}&anio=eq.${YEAR}&mes=eq.${mes}&empresa_id=eq.${EMPRESA_ID}`
      );

      if (checkProg.status === 200 && Array.isArray(checkProg.body) && checkProg.body.length > 0) {
        const existProg = checkProg.body[0];
        console.log(`  [${mesNombre}] Already exists (${existProg.id}), advancing cycle positions...`);
        // Still need to advance positions for next month
        const daysInMonth = new Date(YEAR, mes + 1, 0).getDate();
        for (const r of roles) r.startPos += daysInMonth;
        continue;
      }

      // Generate asignaciones
      const asignaciones = genMonthAsignaciones(roles, YEAR, mes);

      const personal = pData.roles.map(r => ({
        rol: r.rol,
        vigilanteId: null,
        turnoId: r.rol.toLowerCase().includes('b') || r.rol === 'titular_b' ? 'PM' : 'AM',
      }));

      const progPayload = {
        puesto_id: puestoId,
        empresa_id: EMPRESA_ID,
        anio: YEAR,
        mes,
        estado: mes < 4 ? 'publicado' : 'borrador',
        personal,
        asignaciones,
        historial_cambios: [],
        created_at: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      };

      const progRes = await supabaseReq('POST', 'programaciones', progPayload);
      if (progRes.status === 201) {
        const progId = Array.isArray(progRes.body) ? progRes.body[0]?.id : progRes.body?.id;
        process.stdout.write(`  [${mesNombre}] ✅ ${asignaciones.length} asigs `);

        // Apply test novedades for mes=4 (April, index 4)
        if (mes === 4 && progId) {
          const relevantNovedades = TEST_NOVEDADES.filter(n => n.puestoIdx === pIdx);
          for (const nov of relevantNovedades) {
            // Update that specific asignacion
            const updated = progPayload.asignaciones.map(a =>
              (a.dia === nov.dia && a.rol === nov.rol)
                ? { ...a, jornada: nov.jornada, turno: nov.turno, codigo_personalizado: nov.codigo }
                : a
            );
            await supabaseReq('PATCH', `programaciones?id=eq.${progId}`,
              { asignaciones: updated }
            );
            process.stdout.write(`[NOVEDAD ${nov.codigo} d${nov.dia}] `);
          }
        }
        console.log();
      } else {
        console.log(`  [${mesNombre}] ⚠️ status ${progRes.status}:`, JSON.stringify(progRes.body).slice(0, 150));
      }
    }
  }

  // ── PHASE 3: Verify ──────────────────────────────────────────────────────────
  console.log('\n🔍 Final Verification...\n');

  for (let pIdx = 0; pIdx < PUESTOS.length; pIdx++) {
    const pId = createdPuestoIds[pIdx];
    if (!pId) continue;
    const pData = PUESTOS[pIdx];

    // Verify puesto
    const vPuesto = await supabaseReq('GET', `puestos?id=eq.${pId}`);
    const pRow = Array.isArray(vPuesto.body) ? vPuesto.body[0] : null;
    console.log(`📍 ${pData.nombre}`);
    console.log(`   Zona: ${pRow?.zona || '❌ MISSING'}`);
    console.log(`   Estado: ${pRow?.estado}`);

    // Verify programaciones count
    const vProgs = await supabaseReq('GET', `programaciones?puesto_id=eq.${pId}&anio=eq.${YEAR}`);
    const progCount = Array.isArray(vProgs.body) ? vProgs.body.length : 0;
    console.log(`   Programaciones ${YEAR}: ${progCount}/12`);

    // Spot-check April novedades
    const aprilProg = Array.isArray(vProgs.body)
      ? vProgs.body.find(p => p.mes === 4)
      : null;
    if (aprilProg) {
      const novedad = TEST_NOVEDADES.find(n => n.puestoIdx === pIdx);
      if (novedad) {
        const asigs = aprilProg.asignaciones || [];
        const cell = asigs.find(a => a.dia === novedad.dia && a.rol === novedad.rol);
        if (cell && cell.codigo_personalizado === novedad.codigo) {
          console.log(`   ✅ Novedad[día ${novedad.dia}] ${novedad.codigo} → OK`);
        } else {
          console.log(`   ⚠️ Novedad[día ${novedad.dia}] expected ${novedad.codigo}, got: ${cell?.codigo_personalizado || cell?.jornada}`);
        }
      }
    }
    console.log();
  }

  console.log('🎯 Seed Complete!\n');
  console.log('🔗 Open the app: https://coraza-cta-app.vercel.app');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
