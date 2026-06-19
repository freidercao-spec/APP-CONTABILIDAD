/**
 * Final verification + fix novedades with correct jornada values
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

async function main() {
  console.log('🔍 CORAZA — Final Verification & Novedad Fix\n');

  // 1. Get all puestos
  const allP = await supabaseReq('GET',
    `puestos?empresa_id=eq.${EMPRESA_ID}&select=id,nombre,instrucciones&order=created_at.asc`
  );
  console.log('All puestos in DB:');
  (allP.body || []).forEach(p => console.log(`  • ${p.nombre} (${p.id})`));
  
  const targetNames = [
    'Clínica San Juan de Dios', 'Central Cotraza',
    'Torre Empresarial Buenavista', 'Plaza Madeira'
  ];

  // 2. Check jornada constraint by looking at existing values
  const existAsig = await supabaseReq('GET', 'asignaciones_dia?limit=5&select=jornada');
  console.log('\nExisting jornada values:', [...new Set((existAsig.body||[]).map(a => a.jornada))]);

  // 3. Try to update jornada with different values
  const testAsig = await supabaseReq('GET', 'asignaciones_dia?limit=1&select=id,jornada');
  if (Array.isArray(testAsig.body) && testAsig.body.length > 0) {
    const testId = testAsig.body[0].id;
    const originalJornada = testAsig.body[0].jornada;
    
    // Try each novedad type
    const jornadaTests = ['licencia', 'suspension', 'accidente', 'incapacidad', 'vacacion'];
    for (const j of jornadaTests) {
      const r = await supabaseReq('PATCH', `asignaciones_dia?id=eq.${testId}`, { jornada: j });
      console.log(`  PATCH jornada='${j}': status=${r.status} ${r.status === 200 ? '✅' : `❌ ${JSON.stringify(r.body).slice(0,80)}`}`);
      if (r.status !== 200) break;
    }
    // Restore original
    await supabaseReq('PATCH', `asignaciones_dia?id=eq.${testId}`, { jornada: originalJornada });
  }

  // 4. Full verification for each target puesto
  console.log('\n\n📊 PUESTO SUMMARY:\n');
  for (const name of targetNames) {
    const pRow = (allP.body || []).find(p => p.nombre === name);
    if (!pRow) { console.log(`❌ MISSING: ${name}`); continue; }
    
    const zona = (pRow.instrucciones || '').split('|')[0]?.replace('ZONA:', '') || '—';
    
    // Count progs
    const progs = await supabaseReq('GET',
      `programacion_mensual?puesto_id=eq.${pRow.id}&anio=eq.${YEAR}&select=id,mes,estado&order=mes.asc`
    );
    const progCount = Array.isArray(progs.body) ? progs.body.length : 0;

    // Count total asigs (sample April)
    const aprilProg = Array.isArray(progs.body) ? progs.body.find(p => p.mes === 3) : null;
    let aprilAsigCount = 0;
    if (aprilProg) {
      const asigs = await supabaseReq('GET',
        `asignaciones_dia?programacion_id=eq.${aprilProg.id}&select=dia,rol,jornada`
      );
      aprilAsigCount = Array.isArray(asigs.body) ? asigs.body.length : 0;
      
      // Sample some jornadas
      if (Array.isArray(asigs.body)) {
        const jornadas = [...new Set(asigs.body.map(a => a.jornada))];
        console.log(`📍 ${name}`);
        console.log(`   Zona: ${zona}`);
        console.log(`   Programaciones ${YEAR}: ${progCount}/12`);
        console.log(`   Abril asignaciones: ${aprilAsigCount}`);
        console.log(`   Jornadas en Abril: ${jornadas.join(', ')}`);
        
        // Special cells
        const special = asigs.body.filter(a => !['normal','descanso_remunerado','descanso_no_remunerado','sin_asignar'].includes(a.jornada));
        if (special.length > 0) {
          console.log(`   ⭐ Novedades especiales: ${special.map(a => `d${a.dia}/${a.rol}=${a.jornada}`).join(', ')}`);
        }
      } else {
        console.log(`📍 ${name} — ${progCount}/12 progs, April asigs: ${aprilAsigCount}`);
      }
    } else {
      console.log(`📍 ${name}`);
      console.log(`   Zona: ${zona}`);
      console.log(`   Programaciones ${YEAR}: ${progCount}/12 (NO APRIL PROG)`);
    }
    console.log();
  }

  console.log('🎯 Verification complete!');
  console.log('🔗 App: https://coraza-cta-app.vercel.app\n');
}

main().catch(console.error);
