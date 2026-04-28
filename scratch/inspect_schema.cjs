/**
 * Inspect DB schema - get real column names
 */
const https = require('https');
const SUPABASE_URL = 'ylcpizjfwupfvffsbjmz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

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
        'Prefer': 'return=representation',
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
  // Get one puesto row to see columns
  const r1 = await supabaseReq('GET', 'puestos?limit=1');
  console.log('PUESTOS columns:');
  if (Array.isArray(r1.body) && r1.body.length > 0) {
    console.log(JSON.stringify(r1.body[0], null, 2));
  } else {
    console.log(r1.status, r1.body);
  }

  // Get one programacion row
  const r2 = await supabaseReq('GET', 'programacion_mensual?limit=1');
  console.log('\nPROGRAMACION_MENSUAL columns:');
  if (Array.isArray(r2.body) && r2.body.length > 0) {
    console.log(JSON.stringify(r2.body[0], null, 2));
  } else {
    console.log(r2.status, r2.body);
  }

  // Try programaciones too
  const r3 = await supabaseReq('GET', 'programaciones?limit=1');
  console.log('\nPROGRAMACIONES table (alt):');
  console.log(r3.status, typeof r3.body === 'string' ? r3.body.slice(0,300) : JSON.stringify(r3.body).slice(0,300));
}

main().catch(console.error);
