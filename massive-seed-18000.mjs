import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const sb = createClient(supabaseUrl, supabaseAnonKey);

async function massiveSeed() {
  console.log('🚀 INICIANDO MEGA-SEEDER DE 6.000 PUESTOS Y 18.000 VIGILANTES...');
  console.log('-----------------------------------------------------------');

  const BATCH_SIZE = 400; // Smaller batches to avoid timeouts

  // 1. GENERAR PUESTOS
  console.log(`\n📦 Creando 6000 Puestos...`);
  const ZONA_ID = 'fdd22bf6-402c-4436-a4d8-2a4577ad29af'; // Direct from stress_test_data.sql
  
  for (let b = 0; b < 6000; b += BATCH_SIZE) {
    const batch = [];
    for (let i = 1; i <= BATCH_SIZE && (b + i) <= 6000; i++) {
        const id = b + i;
        const code = `MED-${id.toString().padStart(4, '0')}`;
        batch.push({
            codigo: code,
            nombre: `Puesto Tactico ${id}`,
            tipo: i % 2 === 0 ? 'hospital' : 'comando',
            lat: 6.2442 + (Math.random() - 0.5) * 0.1,
            lng: -75.5812 + (Math.random() - 0.5) * 0.1,
            elevacion: 1495,
            estado: 'Activo',
            empresa_id: EMPRESA_ID,
            zona_id: ZONA_ID
        });
    }
    const { error } = await sb.from('puestos').upsert(batch, { onConflict: 'codigo' });
    if (error) {

        console.error(`❌ Error en batch Puestos ${b}:`, error.message);
    } else {
        process.stdout.write(`| Puestos: ${b + BATCH_SIZE} OK `);
    }
  }

  // 2. GENERAR VIGILANTES
  console.log(`\n\n👮 Creando 18000 Vigilantes...`);
  for (let b = 0; b < 18000; b += BATCH_SIZE) {
    const batch = [];
    for (let i = 1; i <= BATCH_SIZE && (b + i) <= 18000; i++) {
        const id = b + i;
        batch.push({
            codigo: `C-${id.toString().padStart(5, '0')}`,
            nombres: `Guardia ${id}`,
            apellidos: `Supervisor`,
            cedula: `111000${id.toString().padStart(5, '0')}`,
            rango: 'Vigilante',
            estado: 'disponible',
            empresa_id: EMPRESA_ID
        });
    }
    const { error } = await sb.from('vigilantes').upsert(batch, { onConflict: 'codigo' });
    if (error) {
        console.error(`❌ Error en batch Vigilantes ${b}:`, error.message);
    } else {
        process.stdout.write(`| Vigilantes: ${b + BATCH_SIZE} OK `);
    }
  }

  console.log('\n\n✅ MEGA-SEED COMPLETADO EXITOSAMENTE.');
  process.exit(0);
}

massiveSeed().catch(err => {
  console.error('💥 ERROR CRITICO:', err);
  process.exit(1);
});
