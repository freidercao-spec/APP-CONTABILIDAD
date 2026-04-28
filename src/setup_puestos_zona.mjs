
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const empresaId = 'a0000000-0000-0000-0000-000000000001';

const supabase = createClient(supabaseUrl, supabaseKey);

const PUESTOS_DATA = [
  { codigo: 'PST-0001', nombre: 'Clínica San Juan de Dios', zona: 'Zona Norte', direccion: 'Cra. 54 #67-23, Barranquilla', tipo: 'hospital' },
  { codigo: 'PST-0002', nombre: 'Central Cotraza', zona: 'Zona Centro', direccion: 'Calle 45 #32-12, Medellín', tipo: 'logistica' },
  { codigo: 'PST-0003', nombre: 'Torre Empresarial Buenavista', zona: 'Zona Sur', direccion: 'Calle 100 #52-10, Barranquilla', tipo: 'torre' },
  { codigo: 'PST-0004', nombre: 'Plaza Madeira', zona: 'Zona 20', direccion: 'Carrera 15 #124-30, Bogotá', tipo: 'retail' }
];

async function setup() {
  console.log('🚀 Iniciando configuración de puestos con Zona...');

  for (const p of PUESTOS_DATA) {
    console.log(`\n--- Procesando: ${p.nombre} (${p.codigo}) ---`);
    
    // Buscar si ya existe por nombre o código
    const { data: existing } = await supabase
      .from('puestos')
      .select('id, nombre, codigo, instrucciones')
      .or(`codigo.eq."${p.codigo}",nombre.ilike."%${p.nombre}%"`)
      .maybeSingle();

    const updateData = {
      nombre: p.nombre,
      codigo: p.codigo,
      direccion: p.direccion,
      tipo: p.tipo,
      instrucciones: `ZONA:${p.zona}`,
      empresa_id: empresaId,
      estado: 'Activo'
    };

    if (existing) {
      console.log(`✅ Puesto encontrado (ID: ${existing.id}). Actualizando...`);
      const { error } = await supabase
        .from('puestos')
        .update(updateData)
        .eq('id', existing.id);
      
      if (error) console.error('❌ Error al actualizar:', error.message);
      else console.log('✨ Actualización exitosa.');
    } else {
      console.log(`🆕 Puesto no encontrado. Creando nuevo...`);
      const { error } = await supabase
        .from('puestos')
        .insert([updateData]);
      
      if (error) console.error('❌ Error al crear:', error.message);
      else console.log('✨ Creación exitosa.');
    }
  }

  console.log('\n🏁 Configuración finalizada.');
}

setup();
