/**
 * apply_migration.mjs
 * Ejecuta la migración 006 directamente en Supabase via REST API.
 * Uso: node apply_migration.mjs <SERVICE_ROLE_KEY>
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const SUPABASE_URL = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const MIGRATION_FILE = './supabase/migrations/20260410120000_006_guardar_programacion_atomica.sql';

const serviceKey = process.argv[2];
if (!serviceKey) {
    console.error('\n❌ ERROR: Falta la Service Role Key de Supabase.');
    console.error('   Uso: node apply_migration.mjs <SERVICE_ROLE_KEY>');
    console.error('   Encuéntrala en: Supabase Dashboard → Settings → API → service_role key\n');
    process.exit(1);
}

const sql = readFileSync(MIGRATION_FILE, 'utf-8');

console.log('\n🛡️  CORAZA CTA - Aplicando migración 006...');
console.log(`📡 Conectando a: ${SUPABASE_URL}`);
console.log(`📄 Archivo: ${MIGRATION_FILE}\n`);

const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
    }
});

// El endpoint REST no permite SQL directo, usamos el Management API
const mgmtResp = await fetch(`https://api.supabase.com/v1/projects/ylcpizjfwupfvffsbjmz/database/query`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql })
});

if (mgmtResp.ok) {
    console.log('✅ Migración aplicada exitosamente vía Management API');
    const data = await mgmtResp.json().catch(() => ({}));
    console.log('Respuesta:', JSON.stringify(data, null, 2));
} else {
    // Intentar con pg directa (Supabase SQL editor endpoint)
    const body = await mgmtResp.text();
    console.log(`⚠️  Management API respondió: ${mgmtResp.status}`);
    console.log('Respuesta:', body.slice(0, 500));
    
    console.log('\n📋 INSTRUCCIONES MANUALES:');
    console.log('1. Ve a https://supabase.com/dashboard/project/ylcpizjfwupfvffsbjmz/sql/new');
    console.log('2. Copia y pega el contenido del archivo:');
    console.log(`   ${path.resolve(MIGRATION_FILE)}`);
    console.log('3. Haz clic en "Run"\n');
}
