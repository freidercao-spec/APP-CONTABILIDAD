/**
 * Deep schema inspection - find asignaciones table and all related tables
 */
const https = require('https');
const SUPABASE_URL = 'ylcpizjfwupfvffsbjmz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';

function supabaseReq(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/${path}`,
      method: 'GET',
      headers: { 'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const tables = [
    'asignaciones_dia?limit=1',
    'asignacion_dia?limit=1',
    'turnos_dia?limit=1',
    'programacion_detalle?limit=1',
    'dias_programacion?limit=1',
    'personal_puesto?limit=1',
    'vigilantes?limit=1',
  ];

  for (const t of tables) {
    const r = await supabaseReq(t);
    const tableName = t.split('?')[0];
    if (r.status === 200) {
      console.log(`\n✅ TABLE: ${tableName}`);
      const row = Array.isArray(r.body) && r.body.length > 0 ? r.body[0] : r.body;
      console.log(JSON.stringify(row, null, 2));
    } else if (r.status === 404) {
      console.log(`❌ ${tableName} — not found`);
    } else {
      console.log(`⚠️ ${tableName} — status ${r.status}: ${JSON.stringify(r.body).slice(0,100)}`);
    }
  }

  // Also check programacion_mensual with a known prog id
  console.log('\n\n=== FULL PROG ROW ===');
  const prog = await supabaseReq('programacion_mensual?limit=1');
  console.log(JSON.stringify(prog.body, null, 2));
}

main().catch(console.error);
