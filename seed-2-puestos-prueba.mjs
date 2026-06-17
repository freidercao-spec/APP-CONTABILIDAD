/**
 * seed-2-puestos-prueba.mjs
 * Usa la API REST de Supabase directamente (sin npm install).
 * Crea "CORAZA CONTROL" y "ALTOS DEL PINO" + programacion Junio 2026.
 *
 * Uso: node seed-2-puestos-prueba.mjs
 */

const SUPABASE_URL = 'https://ylcpizjfwupfvffsbjmz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsY3Bpempmd3VwZnZmZnNiam16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDMzNjgsImV4cCI6MjA4ODk3OTM2OH0.6V6DS0JsGj-TPs0grZ-pathS_TXAMr4a4ym1pMKJBnE';
const EMPRESA_ID = 'a0000000-0000-0000-0000-000000000001';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function query(path, method = 'GET', body = null, extra = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const opts = { method, headers: { ...HEADERS, ...extra } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const ANIO = 2026;
const MES = 5; // Junio (0-indexed)

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

const TURNOS_CONFIG = [
  { id: 'AM', nombre: 'Turno Diurno',   inicio: '06:00', fin: '18:00', color: '#0ea5e9' },
  { id: 'PM', nombre: 'Turno Nocturno', inicio: '18:00', fin: '06:00', color: '#6366f1' },
];

async function run() {
  console.log('🚀 Iniciando seed de 2 puestos de prueba (via REST API)...\n');

  const puestosCreados = [];

  for (const p of PUESTOS_SEED) {
    // Verificar si ya existe
    const existing = await query(
      `puestos?empresa_id=eq.${EMPRESA_ID}&nombre=ilike.${encodeURIComponent(p.nombre)}&select=id,codigo,nombre&limit=1`
    );

    if (existing && existing.length > 0) {
      console.log(`⚠️  "${p.nombre}" ya existe → Código: ${existing[0].codigo}. Reutilizando.`);
      puestosCreados.push({ ...p, id: existing[0].id, codigo: existing[0].codigo });
      continue;
    }

    const inserted = await query('puestos', 'POST', {
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
      turnos_config: TURNOS_CONFIG,
    });

    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    console.log(`✅ Puesto creado: ${row.codigo} — ${row.nombre}`);

    // Historial de creación
    await query('historial_puesto', 'POST', {
      puesto_id: row.id,
      accion: 'creacion',
      detalles: `Puesto ${row.nombre} creado para prueba de programación Junio 2026`,
    }, { 'Prefer': 'return=minimal' });

    puestosCreados.push({ ...p, id: row.id, codigo: row.codigo });
  }

  console.log(`\n📋 Puestos disponibles: ${puestosCreados.length}\n`);

  for (const puesto of puestosCreados) {
    console.log(`📅 Configurando programación: ${puesto.nombre} → Junio 2026`);

    // Buscar si ya existe la programación
    const existingProg = await query(
      `programaciones_mensuales?puesto_id=eq.${puesto.id}&anio=eq.${ANIO}&mes=eq.${MES}&select=id&limit=1`
    );

    let progId;

    const personalBase = [
      { rol: 'titular_a', vigilanteId: null, turnoId: 'AM' },
      { rol: 'titular_b', vigilanteId: null, turnoId: 'PM' },
      { rol: 'relevante', vigilanteId: null, turnoId: 'AM' },
    ];

    const historialInicial = [{
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      usuario: 'Sistema',
      descripcion: `Tablero de ${puesto.nombre} inicializado para Junio 2026`,
      tipo: 'sistema',
    }];

    if (existingProg && existingProg.length > 0) {
      progId = existingProg[0].id;
      console.log(`   ⚠️  Programación ya existe (${progId})`);
    } else {
      const newProg = await query('programaciones_mensuales', 'POST', {
        puesto_id: puesto.id,
        empresa_id: EMPRESA_ID,
        anio: ANIO,
        mes: MES,
        estado: 'borrador',
        personal: personalBase,
        version: 1,
        historial_cambios: historialInicial,
      });

      const progRow = Array.isArray(newProg) ? newProg[0] : newProg;
      progId = progRow.id;
      console.log(`   ✅ Programación creada: ${progId}`);
    }

    // Crear asignaciones para los 30 días de Junio 2026
    const existingAsigs = await query(
      `asignaciones_programacion?programacion_id=eq.${progId}&select=dia,rol`
    );

    const existingKeys = new Set((existingAsigs || []).map(a => `${a.dia}-${a.rol}`));
    const asignacionesNuevas = [];
    const diasJunio = 30;

    for (let dia = 1; dia <= diasJunio; dia++) {
      const diaSemana = new Date(ANIO, MES, dia).getDay();
      const esFinde = diaSemana === 0 || diaSemana === 6;

      const rolesDelDia = [
        { rol: 'titular_a', turno: 'AM', jornada: esFinde ? 'descanso_remunerado' : 'normal' },
        { rol: 'titular_b', turno: 'PM', jornada: esFinde ? 'descanso_remunerado' : 'normal' },
        { rol: 'relevante', turno: 'AM', jornada: 'descanso_remunerado' },
      ];

      for (const r of rolesDelDia) {
        const key = `${dia}-${r.rol}`;
        if (!existingKeys.has(key)) {
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
    }

    if (asignacionesNuevas.length > 0) {
      // Insertar en lotes de 50
      for (let i = 0; i < asignacionesNuevas.length; i += 50) {
        const batch = asignacionesNuevas.slice(i, i + 50);
        await query('asignaciones_programacion', 'POST', batch, { 'Prefer': 'return=minimal' });
      }
      console.log(`   ✅ ${asignacionesNuevas.length} asignaciones de Junio creadas`);
    } else {
      console.log(`   ⚠️  Asignaciones ya existían`);
    }
  }

  console.log('\n🎉 ¡Seed completado exitosamente!');
  console.log('   → Abre la app y ve a PUESTOS');
  console.log('   → Verás: CORAZA CONTROL y ALTOS DEL PINO');
  console.log('   → Haz clic en cada uno → tablero Junio 2026 con 30 días programados');
}

run().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
