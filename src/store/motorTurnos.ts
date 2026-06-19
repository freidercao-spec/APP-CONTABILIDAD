/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOTOR DE TURNOS — Gestión de Puestos / CORAZA CTA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor de ciclo continuo: 6D → 2R+1NR → 6N → 2R+1NR → repite sin fin.
 * El ciclo NO se reinicia al cambiar de mes. La posición en ciclo se
 * propaga entre meses de forma exacta e ininterrumpida.
 *
 * Ciclo completo = 18 días (6+3+6+3):
 *   Pos 0-5  : DIURNO   (D)       → jornada: 'normal',   turno: 'AM'
 *   Pos 6    : DESCANSO remunerado (R)
 *   Pos 7    : DESCANSO remunerado (R)
 *   Pos 8    : DESCANSO no remunerado (NR)
 *   Pos 9-14 : NOCTURNO (N)       → jornada: 'normal',   turno: 'PM'
 *   Pos 15   : DESCANSO remunerado (R)
 *   Pos 16   : DESCANSO remunerado (R)
 *   Pos 17   : DESCANSO no remunerado (NR)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsignacionDia, TipoJornada } from './programacionStore';

// ── Tipos públicos del motor ─────────────────────────────────────────────────

/** Valor de celda visible en el tablero */
export type ValorCelda = 'D' | 'N' | 'R' | 'NR';

/** Una celda del tablero con metadatos completos */
export interface CeldaTurno {
  dia: number;
  valor: ValorCelda;            // D | N | R | NR
  jornada: TipoJornada;
  turno: string;               // 'AM' | 'PM' | 'descanso'
  posicionCiclo: number;       // 0-17 en el ciclo de 18 días
}

/** Estado de un vigilante al final de un mes (para propagación) */
export interface EstadoFinMes {
  vigilanteId: string;
  puestoId: string;
  rol: string;
  anio: number;
  mes: number;
  ultimoDiaCalculado: number;
  posicionCicloFinal: number;  // 0-17: posición al terminar ese mes
  valorFinal: ValorCelda;
}

/** Resultado de generar el tablero de un mes */
export interface ResultadoTableroMes {
  puestoId: string;
  vigilanteId: string;
  rol: string;
  anio: number;
  mes: number;
  celdas: CeldaTurno[];        // longitud = días del mes
  posicionInicioMes: number;   // posición en ciclo el día 1
  posicionFinMes: number;      // posición en ciclo el último día
}

/** Alerta detectada por el motor */
export interface AlertaMotor {
  tipo: 'ciclo_violado' | 'doble_descanso' | 'puesto_critico' | 'cobertura_rota';
  puestoId: string;
  rol?: string;
  dia?: number;
  mensaje: string;
  severidad: 'warning' | 'error';
}

// ── Constantes del ciclo ─────────────────────────────────────────────────────

/** Longitud total del ciclo en días */
export const CICLO_TOTAL = 18;

/**
 * Mapa completo del ciclo de 18 posiciones.
 * Cada elemento define el valor visible y la jornada correspondiente.
 */
const CICLO: ReadonlyArray<{ valor: ValorCelda; jornada: TipoJornada; turno: string }> = [
  // ─── 6 días DIURNOS (pos 0-5) ───────────────────────────────────────────
  { valor: 'D', jornada: 'normal', turno: 'AM' },
  { valor: 'D', jornada: 'normal', turno: 'AM' },
  { valor: 'D', jornada: 'normal', turno: 'AM' },
  { valor: 'D', jornada: 'normal', turno: 'AM' },
  { valor: 'D', jornada: 'normal', turno: 'AM' },
  { valor: 'D', jornada: 'normal', turno: 'AM' },
  // ─── 3 días DESCANSO diurno (pos 6-8): 2R + 1NR ─────────────────────────
  { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
  { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
  { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
  // ─── 6 días NOCTURNOS (pos 9-14) ─────────────────────────────────────────
  { valor: 'N', jornada: 'normal', turno: 'PM' },
  { valor: 'N', jornada: 'normal', turno: 'PM' },
  { valor: 'N', jornada: 'normal', turno: 'PM' },
  { valor: 'N', jornada: 'normal', turno: 'PM' },
  { valor: 'N', jornada: 'normal', turno: 'PM' },
  { valor: 'N', jornada: 'normal', turno: 'PM' },
  // ─── 3 días DESCANSO nocturno (pos 15-17): 2R + 1NR ─────────────────────
  { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
  { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
  { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
] as const;

// ── Funciones primitivas del ciclo ───────────────────────────────────────────

/**
 * Normaliza cualquier número de día de ciclo al rango [0, 17].
 * Maneja negativos y valores mayores a 17 correctamente.
 */
export function normalizarPosicion(pos: number): number {
  return ((pos % CICLO_TOTAL) + CICLO_TOTAL) % CICLO_TOTAL;
}

/**
 * Obtiene el estado del ciclo en una posición dada.
 */
export function estadoCiclo(pos: number): (typeof CICLO)[number] {
  return CICLO[normalizarPosicion(pos)];
}

/**
 * Determina qué fase del ciclo corresponde a una posición.
 * Útil para mostrar el bloque actual al usuario.
 */
export function faseCiclo(pos: number): 'DIURNO' | 'DESCANSO_D' | 'NOCTURNO' | 'DESCANSO_N' {
  const p = normalizarPosicion(pos);
  if (p <= 5)  return 'DIURNO';
  if (p <= 8)  return 'DESCANSO_D';
  if (p <= 14) return 'NOCTURNO';
  return 'DESCANSO_N';
}

/**
 * Calcula el valor de celda visible: D, N, R, o NR.
 */
export function valorCelda(pos: number): ValorCelda {
  return CICLO[normalizarPosicion(pos)].valor;
}

// ── Generador de tablero mensual ─────────────────────────────────────────────

/**
 * @param posicionDia1 — posición en el ciclo (0-17) del día 1 del mes.
 * @param anio
 * @param mes           — 0-indexed (0=enero, 11=diciembre)
 * @param vigilanteId
 * @param rol
 * @param puestoId
 * @returns ResultadoTableroMes completo con todas las celdas del mes.
 */
export function generarTableroMes(
  posicionDia1: number,
  anio: number,
  mes: number,
  vigilanteId: string,
  rol: string,
  puestoId: string,
): ResultadoTableroMes {
  const diasTotales = new Date(anio, mes + 1, 0).getDate();
  const posInicio = normalizarPosicion(posicionDia1);
  const celdas: CeldaTurno[] = [];

  for (let d = 0; d < diasTotales; d++) {
    const pos = normalizarPosicion(posInicio + d);
    const estado = CICLO[pos];
    celdas.push({
      dia: d + 1,
      valor: estado.valor,
      jornada: estado.jornada,
      turno: estado.turno,
      posicionCiclo: pos,
    });
  }

  return {
    puestoId,
    vigilanteId,
    rol,
    anio,
    mes,
    celdas,
    posicionInicioMes: posInicio,
    posicionFinMes: normalizarPosicion(posInicio + diasTotales - 1),
  };
}

/**
 * Calcula la posición en ciclo del día 1 del mes siguiente,
 * dada la posición del último día del mes actual.
 *
 * @param posicionUltimoDia — posición (0-17) del último día del mes
 * @returns posición (0-17) del día 1 del mes siguiente
 */
export function posicionDia1MesSiguiente(posicionUltimoDia: number): number {
  return normalizarPosicion(posicionUltimoDia + 1);
}

// ── Conversión entre AsignacionDia ↔ CeldaTurno ──────────────────────────────

/**
 * Convierte una CeldaTurno del motor a AsignacionDia del store,
 * manteniendo el vigilanteId y rol originales.
 */
export function celdaToAsignacion(
  celda: CeldaTurno,
  vigilanteId: string | null,
  rol: string,
): AsignacionDia {
  return {
    dia: celda.dia,
    vigilanteId,
    turno: celda.turno === 'descanso' ? (rol === 'titular_b' ? 'PM' : 'AM') : celda.turno,
    jornada: celda.jornada,
    rol,
  };
}

/**
 * Extrae la posición en ciclo de una celda existente (AsignacionDia)
 * usando el valor de jornada y turno.
 * Útil para reconstruir el estado del ciclo desde datos guardados.
 *
 * NOTA: Este método es una inferencia heurística. La fuente de verdad
 * es `EstadoFinMes.posicionCicloFinal`.
 */
export function inferirPosicionDesdeCelda(asig: AsignacionDia): number | null {
  const { jornada, turno } = asig;

  if (jornada === 'normal' && turno === 'AM')            return 0; // D — comenzamos en pos 0 del bloque
  if (jornada === 'normal' && turno === 'PM')            return 9; // N — comenzamos en pos 9 del bloque
  if (jornada === 'descanso_remunerado')                return 6; // R
  if (jornada === 'descanso_no_remunerado')             return 8; // NR
  return null;
}

// ── Extractor de estado fin de mes desde asignaciones guardadas ───────────────

/**
 * Dado el array de asignaciones guardadas de un mes,
 * extrae el estado final de ciclo de cada vigilante.
 *
 * Primero intenta leer el campo `posicionCiclo` si fue guardado.
 * Si no existe, lo reconstruye desde jornada/turno del último día.
 */
export function extraerEstadosFinMes(
  asignaciones: AsignacionDia[],
  anio: number,
  mes: number,
  puestoId: string,
): EstadoFinMes[] {
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const porVigilante = new Map<string, AsignacionDia[]>();

  asignaciones.forEach((a) => {
    if (!a.vigilanteId) return;
    const key = `${a.vigilanteId}::${a.rol}`;
    if (!porVigilante.has(key)) porVigilante.set(key, []);
    porVigilante.get(key)!.push(a);
  });

  const estados: EstadoFinMes[] = [];

  porVigilante.forEach((asigs, key) => {
    const [vigilanteId, rol] = key.split('::');
    // Ordenar por día descendente para obtener el último día asignado
    const sorted = [...asigs].sort((a, b) => b.dia - a.dia);
    const ultimaAsig = sorted[0];

    if (!ultimaAsig) return;

    // Si la celda tiene posición explícita (guardada por el motor), la usamos
    const posExplicita = (ultimaAsig as any).posicionCiclo;
    const posicionFinal = typeof posExplicita === 'number'
      ? normalizarPosicion(posExplicita)
      : reconstruirPosicionDesdeHistorial(asigs, diasMes);

    estados.push({
      vigilanteId,
      puestoId,
      rol,
      anio,
      mes,
      ultimoDiaCalculado: ultimaAsig.dia,
      posicionCicloFinal: posicionFinal,
      valorFinal: valorCelda(posicionFinal),
    });
  });

  return estados;
}

/**
 * Reconstruye la posición en ciclo del último día del mes,
 * analizando el historial completo de asignaciones del vigilante.
 *
 * Si hay datos suficientes (>= 2 celdas), se puede determinar la posición
 * vía diferencia de días. Si no, se hace una estimación desde el valor final.
 */
function reconstruirPosicionDesdeHistorial(
  asigs: AsignacionDia[],
  diasMes: number,
): number {
  const sorted = [...asigs].sort((a, b) => a.dia - b.dia);

  // Buscar la primera celda con un valor reconocible de jornada
  const primera = sorted.find(
    (a) => a.jornada !== 'sin_asignar' && a.jornada !== 'vacacion',
  );
  if (!primera) return 0;

  // Inferir la posición de esa primera celda
  const posPrimera = inferirPosicionDesdeCelda(primera);
  if (posPrimera === null) return 0;

  // La posición del último día es: posPrimera + (diaPrimera - 1) de diferencia
  // hasta el último día del mes
  const offsetHastaFin = diasMes - primera.dia;
  return normalizarPosicion(posPrimera + offsetHastaFin);
}

// ── Motor de transición de mes ────────────────────────────────────────────────

/**
 * Calcula la posición en ciclo del día 1 de un nuevo mes,
 * tomando como base los estados finales del mes anterior.
 *
 * @param estadosFinMesAnterior — array de EstadoFinMes del mes que termina
 * @param vigilanteId
 * @param rol
 * @param anioAnterior          — año del mes anterior
 * @param mesAnterior           — mes anterior (0-indexed)
 * @returns posición (0-17) para el día 1 del nuevo mes
 */
export function calcularPosicionNuevoMes(
  estadosFinMesAnterior: EstadoFinMes[],
  vigilanteId: string,
  rol: string,
  anioAnterior: number,
  mesAnterior: number,
): number {
  const estado = estadosFinMesAnterior.find(
    (e) =>
      e.vigilanteId === vigilanteId &&
      e.rol === rol &&
      e.anio === anioAnterior &&
      e.mes === mesAnterior,
  );

  if (!estado) {
    // Sin datos previos: comenzar desde el inicio del ciclo
    console.warn(
      `[MotorTurnos] ⚠️ Sin estado previo para ${vigilanteId}::${rol}. Iniciando desde pos 0.`,
    );
    return 0;
  }

  return posicionDia1MesSiguiente(estado.posicionCicloFinal);
}

// ── Generador multi-rol para un puesto completo ───────────────────────────────

/**
 * Genera el tablero completo de un puesto para un mes dado,
 * calculando ciclos independientes por cada rol/vigilante.
 *
 * @param puestoId
 * @param anio
 * @param mes
 * @param personalConfig  — Array de { rol, vigilanteId, posicionDia1 }
 * @returns Map de rol → ResultadoTableroMes
 */
export function generarTableroCompletoPuesto(
  puestoId: string,
  anio: number,
  mes: number,
  personalConfig: Array<{
    rol: string;
    vigilanteId: string | null;
    posicionDia1: number;
  }>,
): Map<string, ResultadoTableroMes> {
  const resultado = new Map<string, ResultadoTableroMes>();

  personalConfig.forEach(({ rol, vigilanteId, posicionDia1 }) => {
    if (!vigilanteId) return; // Vacante: sin ciclo que calcular
    const tablero = generarTableroMes(
      posicionDia1,
      anio,
      mes,
      vigilanteId,
      rol,
      puestoId,
    );
    resultado.set(rol, tablero);
  });

  return resultado;
}

// ── Conversión a AsignacionDia[] (compatible con el store) ───────────────────

/**
 * Convierte un ResultadoTableroMes en el array AsignacionDia[]
 * que espera el programacionStore.
 */
export function tableroToAsignaciones(tablero: ResultadoTableroMes): AsignacionDia[] {
  return tablero.celdas.map((celda) =>
    celdaToAsignacion(celda, tablero.vigilanteId, tablero.rol),
  );
}

/**
 * Convierte todos los tableros de un puesto en AsignacionDia[],
 * fusionando los resultados de todos los roles en un solo array.
 */
export function tablerosToAsignaciones(
  tableros: Map<string, ResultadoTableroMes>,
): AsignacionDia[] {
  const asignaciones: AsignacionDia[] = [];
  tableros.forEach((tablero) => {
    asignaciones.push(...tableroToAsignaciones(tablero));
  });
  return asignaciones;
}

// ── Validaciones ─────────────────────────────────────────────────────────────

/**
 * Valida el tablero de un mes, detectando violaciones al ciclo obligatorio.
 * Retorna lista de alertas.
 */
export function validarTableroMes(
  tableros: Map<string, ResultadoTableroMes>,
  puestoId: string,
): AlertaMotor[] {
  const alertas: AlertaMotor[] = [];

  // 1. Verificar que todos los roles tengan cobertura activa
  const tieneCoberturaDiurna = Array.from(tableros.values()).some((t) =>
    t.celdas.some((c) => c.valor === 'D'),
  );
  const tieneCoberturaNoct = Array.from(tableros.values()).some((t) =>
    t.celdas.some((c) => c.valor === 'N'),
  );

  if (!tieneCoberturaDiurna && tableros.size > 0) {
    alertas.push({
      tipo: 'cobertura_rota',
      puestoId,
      mensaje: 'No hay cobertura diurna en ningún día del mes.',
      severidad: 'error',
    });
  }

  if (!tieneCoberturaNoct && tableros.size > 0) {
    alertas.push({
      tipo: 'cobertura_rota',
      puestoId,
      mensaje: 'No hay cobertura nocturna en ningún día del mes.',
      severidad: 'error',
    });
  }

  // 2. Verificar que no haya dos roles en descanso simultáneo (el mismo día)
  const diasMes = Array.from(tableros.values())[0]?.celdas.length ?? 31;

  for (let dia = 1; dia <= diasMes; dia++) {
    let descansando = 0;
    let enActivo = 0;

    tableros.forEach((t, rol) => {
      const celda = t.celdas.find((c) => c.dia === dia);
      if (!celda) return;
      if (celda.valor === 'R' || celda.valor === 'NR') descansando++;
      else enActivo++;
    });

    if (descansando > 0 && enActivo === 0 && tableros.size > 0) {
      alertas.push({
        tipo: 'doble_descanso',
        puestoId,
        dia,
        mensaje: `Día ${dia}: todos los vigilantes activos están en descanso — PUESTO SIN COBERTURA.`,
        severidad: 'error',
      });
    }
  }

  // 3. Verificar que ningún vigilante supere 6 días consecutivos del mismo turno
  tableros.forEach((t, rol) => {
    let consecutivos = 0;
    let turnoActual: ValorCelda | null = null;

    t.celdas.forEach((celda) => {
      if (celda.valor === turnoActual && (celda.valor === 'D' || celda.valor === 'N')) {
        consecutivos++;
        if (consecutivos > 6) {
          alertas.push({
            tipo: 'ciclo_violado',
            puestoId,
            rol,
            dia: celda.dia,
            mensaje: `Rol ${rol}: violación de ciclo — ${consecutivos} días consecutivos de turno ${celda.valor} (máx. 6).`,
            severidad: 'error',
          });
        }
      } else {
        turnoActual = celda.valor;
        consecutivos = celda.valor === 'D' || celda.valor === 'N' ? 1 : 0;
      }
    });
  });

  // 4. Puesto sin personal en absoluto
  if (tableros.size === 0) {
    alertas.push({
      tipo: 'puesto_critico',
      puestoId,
      mensaje: 'PUESTO CRÍTICO: sin personal asignado.',
      severidad: 'error',
    });
  }

  return alertas;
}

// ── Resumen de fin de mes para JSON de plantilla ──────────────────────────────

/**
 * Genera el JSON resumen de estado final del mes,
 * listo para guardar como plantilla del mes siguiente.
 *
 * Este JSON es la "plantilla" descrita en la especificación del sistema.
 */
export function generarResumenFinMes(
  tableros: Map<string, ResultadoTableroMes>,
  puestoId: string,
  anio: number,
  mes: number,
): object {
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const puestosData: Record<string, object> = {};

  tableros.forEach((tablero, rol) => {
    const ultimaCelda = tablero.celdas[tablero.celdas.length - 1];
    puestosData[rol] = {
      vigilanteId: tablero.vigilanteId,
      ultimo_dia_mes: diasMes,
      posicion_en_ciclo: ultimaCelda.posicionCiclo,
      turno_actual: ultimaCelda.valor,
      fase_actual: faseCiclo(ultimaCelda.posicionCiclo),
      posicion_dia1_mes_siguiente: posicionDia1MesSiguiente(ultimaCelda.posicionCiclo),
    };
  });

  const MONTH_NAMES_ES = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ];

  return {
    mes: MONTH_NAMES_ES[mes],
    anio,
    puestoId,
    puestos: puestosData,
    generadoEn: new Date().toISOString(),
    version_motor: '2.0',
  };
}

// ── Helper para aplicar motor al store ───────────────────────────────────────

/**
 * Entry point para que `programacionStore.crearOObtenerProgramacion`
 * y el componente GestionPuestos usen el motor de turnos.
 *
 * Dado el mes anterior (si existe), calcula las posiciones de cada rol
 * y genera el array de AsignacionDia[] listo para el store.
 *
 * @param puestoId
 * @param anio              — año del nuevo mes a generar
 * @param mes               — mes del nuevo mes (0-indexed)
 * @param personal          — Array de { rol, vigilanteId }
 * @param asignacionesMesAnterior — asignaciones guardadas del mes anterior (puede ser vacío)
 * @param anioMesAnterior  — año del mes anterior
 * @param mesMesAnterior   — mes anterior (0-indexed)
 * @returns AsignacionDia[] completo, o null si no hay personal
 */
export function aplicarMotorTurnos(
  puestoId: string,
  anio: number,
  mes: number,
  personal: Array<{ rol: string; vigilanteId: string | null }>,
  asignacionesMesAnterior: AsignacionDia[],
  anioMesAnterior: number,
  mesMesAnterior: number,
): AsignacionDia[] | null {
  if (!personal || personal.length === 0) return null;

  // 1. Extraer estados finales del mes anterior (si existen)
  const estadosPrevios: EstadoFinMes[] = asignacionesMesAnterior.length > 0
    ? extraerEstadosFinMes(asignacionesMesAnterior, anioMesAnterior, mesMesAnterior, puestoId)
    : [];

  // 2. Calcular posición inicial del día 1 para cada rol
  const personalConfig = personal
    .filter((p) => p.vigilanteId)
    .map((p) => {
      const posicion = calcularPosicionNuevoMes(
        estadosPrevios,
        p.vigilanteId!,
        p.rol,
        anioMesAnterior,
        mesMesAnterior,
      );
      return {
        rol: p.rol,
        vigilanteId: p.vigilanteId,
        posicionDia1: posicion,
      };
    });

  if (personalConfig.length === 0) return null;

  // 3. Generar tablero completo del puesto
  const tableros = generarTableroCompletoPuesto(puestoId, anio, mes, personalConfig);

  // 4. Convertir a AsignacionDia[]
  return tablerosToAsignaciones(tableros);
}

// ── Display helpers para la UI ────────────────────────────────────────────────

/** Colores CSS para cada valor de celda */
export const COLORES_CELDA: Record<ValorCelda, string> = {
  D:  'bg-sky-500/20 text-sky-300 border-sky-500/30',
  N:  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  R:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  NR: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

/** Etiquetas legibles para la UI */
export const ETIQUETAS_CELDA: Record<ValorCelda, string> = {
  D:  'Diurno',
  N:  'Nocturno',
  R:  'Descanso R.',
  NR: 'Descanso NR',
};

/** Convierte una AsignacionDia del store al ValorCelda del motor */
export function asignacionToValorCelda(asig: AsignacionDia): ValorCelda {
  if (asig.jornada === 'descanso_remunerado')    return 'R';
  if (asig.jornada === 'descanso_no_remunerado') return 'NR';
  if (asig.jornada === 'normal' && asig.turno === 'PM') return 'N';
  if (asig.jornada === 'normal' && asig.turno === 'AM') return 'D';
  // Fallback
  if (asig.turno === 'PM') return 'N';
  return 'D';
}

/**
 * Sincroniza el motor con cambios manuales del usuario.
 * Cuando se modifica una celda, recalcula el offset del ciclo
 * para los días siguientes dentro del mismo mes.
 *
 * NOTA: Los cambios manuales rompen el ciclo automático para esa celda.
 * El motor registra la desviación pero continúa calculando los días
 * restantes desde la posición natural del ciclo.
 * El ciclo no se recalcula en cascada — solo se advierte al operador.
 */
export function validarCambioManual(
  asig: AsignacionDia,
  tableroActual: ResultadoTableroMes,
): { esValido: boolean; advertencia?: string } {
  const celdaMotor = tableroActual.celdas.find((c) => c.dia === asig.dia);
  if (!celdaMotor) return { esValido: true };

  const valorNuevo = asignacionToValorCelda(asig);
  const valorMotor = celdaMotor.valor;

  if (valorNuevo !== valorMotor) {
    return {
      esValido: true, // Permitimos el cambio pero advertimos
      advertencia: `Día ${asig.dia}: se asignó "${valorNuevo}" cuando el ciclo indica "${valorMotor}". ` +
        `El cambio queda guardado en la plantilla del mes. El ciclo no se recalcula en cascada.`,
    };
  }

  return { esValido: true };
}
