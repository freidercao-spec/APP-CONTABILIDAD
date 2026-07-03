import { createClient } from '@supabase/supabase-js';

const url = 'https://ykchpbqkjvmnddndkvno.supabase.co';
const key = 'sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E';
const sb = createClient(url, key);

async function inspect() {
  console.log('Inspecting public schema tables...');
  const tablesToTry = [
    'puestos',
    'vigilantes',
    'empresas',
    'programacion_mensual',
    'programaciones_mensuales',
    'personal_puesto',
    'asignaciones_dia',
    'asignaciones_programacion',
    'turnos_puesto',
    'historial_puesto',
    'audit_logs'
  ];

  for (const table of tablesToTry) {
    const { data, error } = await sb.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}' query error:`, error.message);
    } else {
      console.log(`✅ Table '${table}' queried successfully! Data:`, data);
    }
  }
}

inspect();
