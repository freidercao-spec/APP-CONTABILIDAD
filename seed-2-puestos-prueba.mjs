/**
 * seed-2-puestos-prueba.mjs
 * Crea los puestos "Coraza Control" y "Altos del Pino" con programacion
 * de Junio 2026 lista para verificar en el tablero.
 * 
 * Uso: node seed-2-puestos-prueba.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mes de prueba: Junio 2026 (0-indexed = mes 5)
const ANIO = 2026;
const MES = 5; // Junio

const PUESTOS_SEED = [
  {
    nombre: 'CORAZA CONTROL',
    tipo: 'comando',
    latitud: 6.255958,
    longitud: -75.596207,
    direccion: 'Cra. 81 #49 - 24, Calasanz, Medellín',
    contacto: 'Control Central',
    telefono: '311 3836939',
    prioridad: 'critica',
    zona: 'ZONA NORTE',
  },
  {
    nombre: 'ALTOS DEL PINO',
    tipo: 'edificio',
    latitud: 6.2442,
    longitud: -75.5700,
    direccion: 'Altos del Pino, Medellín, Antioquia',
    contacto: 'Administración',
    telefono: '311 0000001',
    prioridad: 'alta',
    zona: 'ZONA SUR',
  },
];

async function run() {
  console.log('🚀 Iniciando seed de 2 puestos de prueba...\n');

  const puestosCreados = [];

  for (const p of PUESTOS_SEED) {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('puestos')
      .select('id, codigo, nombre')
      .eq('empresa_id', EMPRESA_ID)
      .ilike('nombre', p.nombre)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`⚠️  "${p.nombre}" ya existe (${existing[0].codigo}). Reutilizando.`);
      puestosCreados.push({ ...existing[0], ...p });
      continue;
    }

    const { data: inserted, error } = await supabase
      .from('puestos')
      .insert({
        empresa_id: EMPRESA_ID,
        nombre: p.nombre,
        tipo: p.tipo,
        latitud: p.latitud,
        longitud: p.longitud,
        direccion: p.direccion,
        contacto: p.contacto,
        telefono: p.telefono,
        prioridad: p.prioridad,
        zona: p.zona,
        turnos_config: [
          { id: 'AM', nombre: 'Turno Diurno', inicio: '06:00', fin: '18:00', color: '#0ea5e9' },
          { id: 'PM', nombre: 'Turno Nocturno', inicio: '18:00', fin: '06:00', color: '#6366f1' },
        ],
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creando "${p.nombre}":`, error.message);
      continue;
    }

    console.log(`✅ Puesto creado: ${inserted.codigo} — ${inserted.nombre}`);

    // Historial de creación
    await supabase.from('historial_puesto').insert({
      puesto_id: inserted.id,
      accion: 'creacion',
      detalles: `Puesto ${inserted.nombre} creado para prueba de programación`,
    });

    puestosCreados.push(inserted);
  }

  console.log(`\n📋 Puestos disponibles: ${puestosCreados.length}`);

  // Crear programaciones para cada puesto
  for (const puesto of puestosCreados) {
    const puestoId = puesto.id;
    const puestoCodigo = puesto.codigo || puesto.id;
    const puestoNombre = puesto.nombre;

    console.log(`\n📅 Creando programación para: ${puestoNombre} (${ANIO}/${MES + 1})`);

    // Verificar si ya existe la programación
    const { data: existingProg } = await supabase
      .from('programaciones_mensuales')
      .select('id')
      .eq('puesto_id', puestoId)
      .eq('anio', ANIO)
      .eq('mes', MES)
      .limit(1);

    let progId;

    if (existingProg && existingProg.length > 0) {
      progId = existingProg[0].id;
      console.log(`   ⚠️  Programación ya existe (${progId}). Actualizando...`);
    } else {
      // Crear nueva programación
      const { data: newProg, error: progError } = await supabase
        .from('programaciones_mensuales')
        .insert({
          puesto_id: puestoId,
          empresa_id: EMPRESA_ID,
          anio: ANIO,
          mes: MES,
          estado: 'borrador',
          personal: [
            { rol: 'titular_a', vigilanteId: null, turnoId: 'AM' },
            { rol: 'titular_b', vigilanteId: null, turnoId: 'PM' },
            { rol: 'relevante', vigilanteId: null, turnoId: 'AM' },
          ],
          version: 1,
          historial_cambios: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              usuario: 'Sistema',
              descripcion: `Tablero de ${puestoNombre} inicializado para Junio 2026`,
              tipo: 'sistema',
            },
          ],
        })
        .select()
        .single();

      if (progError) {
        console.error(`   ❌ Error creando programación:`, progError.message);
        continue;
      }

      progId = newProg.id;
      console.log(`   ✅ Programación creada: ${progId}`);
    }

    // Crear asignaciones para los 30 días de Junio 2026
    const diasJunio = 30;
    const asignacionesExistentes = [];

    const { data: existingAsigs } = await supabase
      .from('asignaciones_programacion')
      .select('dia, rol')
      .eq('programacion_id', progId);

    if (existingAsigs) {
      existingAsigs.forEach(a => asignacionesExistentes.push(`${a.dia}-${a.rol}`));
    }

    const asignacionesNuevas = [];

    for (let dia = 1; dia <= diasJunio; dia++) {
      const fecha = new Date(ANIO, MES, dia);
      const diaSemana = fecha.getDay(); // 0=Dom, 6=Sab

      // Patrón: titular_a trabaja D(lun-vie), DR(sab-dom)
      //         titular_b trabaja N(lun-vie), DR(sab-dom)  
      //         relevante: DR toda la semana (pool de descanso)

      const esFinde = diaSemana === 0 || diaSemana === 6;

      const rolesDelDia = [
        {
          rol: 'titular_a',
          turno: 'AM',
          jornada: esFinde ? 'descanso_remunerado' : 'normal',
        },
        {
          rol: 'titular_b',
          turno: 'PM',
          jornada: esFinde ? 'descanso_remunerado' : 'normal',
        },
        {
          rol: 'relevante',
          turno: 'AM',
          jornada: 'descanso_remunerado',
        },
      ];

      for (const r of rolesDelDia) {
        const key = `${dia}-${r.rol}`;
        if (asignacionesExistentes.includes(key)) continue;

        asignacionesNuevas.push({
          programacion_id: progId,
          empresa_id: EMPRESA_ID,
          dia,
          rol: r.rol,
          turno: r.turno,
          jornada: r.jornada,
          vigilante_id: null,
        });
      }
    }

    if (asignacionesNuevas.length > 0) {
      // Insertar en lotes de 50
      for (let i = 0; i < asignacionesNuevas.length; i += 50) {
        const batch = asignacionesNuevas.slice(i, i + 50);
        const { error: asigError } = await supabase
          .from('asignaciones_programacion')
          .insert(batch);

        if (asigError) {
          console.error(`   ❌ Error insertando asignaciones (batch ${i}):`, asigError.message);
        }
      }
      console.log(`   ✅ ${asignacionesNuevas.length} asignaciones creadas para los 30 días`);
    } else {
      console.log(`   ⚠️  Asignaciones ya existían, no se duplicaron`);
    }
  }

  console.log('\n🎉 ¡Seed completado! Los puestos y su programación de Junio 2026 están listos.');
  console.log('   Abre la app → PUESTOS → verás "CORAZA CONTROL" y "ALTOS DEL PINO"');
  console.log('   Haz clic en cada uno para ver el tablero mensual de Junio 2026.');
}

run().catch(console.error);
