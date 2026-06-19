/**
 * Check asignaciones_dia full schema + check puestos zona column
 */
const https = require('https');
const SUPABASE_URL = 'ylcpizjfwupfvffsbjmz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';

function supabaseReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/${path}`,
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
  // Try adding zona to existing puesto
  const PUESTO_ID = 'd44ca75b-f3b0-4b9a-a59b-ef1f77a414e2';
  
  // Test PATCH with zona
  const r1 = await supabaseReq('PATCH', `puestos?id=eq.${PUESTO_ID}`, { zona: 'Zona Norte' });
  console.log('PATCH zona result:', r1.status, JSON.stringify(r1.body).slice(0,200));

  // Try alternate column names
  const r2 = await supabaseReq('PATCH', `puestos?id=eq.${PUESTO_ID}`, { zona_nombre: 'Zona Norte' });
  console.log('PATCH zona_nombre result:', r2.status, JSON.stringify(r2.body).slice(0,200));

  // Check asignaciones_dia for codigo_personalizado
  const r3 = await supabaseReq('GET', 'asignaciones_dia?limit=1&select=*');
  console.log('\nasignaciones_dia all cols:', r3.status, JSON.stringify(r3.body, null, 2));

  // Try PATCH asignacion with codigo_personalizado
  const testAsig = Array.isArray(r3.body) && r3.body.length > 0 ? r3.body[0] : null;
  if (testAsig) {
    const r4 = await supabaseReq('PATCH', `asignaciones_dia?id=eq.${testAsig.id}`, 
      { codigo_personalizado: 'DR' });
    console.log('\nPATCH codigo_personalizado test:', r4.status, JSON.stringify(r4.body).slice(0,200));
  }

  // Get puestos full columns using select=*
  const r5 = await supabaseReq('GET', `puestos?id=eq.${PUESTO_ID}&select=*`);
  console.log('\nPuesto full row:');
  console.log(JSON.stringify(r5.body, null, 2));
}

main().catch(console.error);
