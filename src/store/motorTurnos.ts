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

export type TipoCiclo = '12x3' | '10x5' | '2x2' | '13x2';

/** Una celda del tablero con metadatos completos */
export interface CeldaTurno {
  dia: number;
  valor: ValorCelda;            // D | N | R | NR
  jornada: TipoJornada;
  turno: string;               // 'AM' | 'PM' | 'descanso'
  posicionCiclo: number;       // posición en el ciclo
}

/** Estado de un vigilante al final de un mes (para propagación) */
export interface EstadoFinMes {
  vigilanteId: string;
  puestoId: string;
  rol: string;
  anio: number;
  mes: number;
  ultimoDiaCalculado: number;
  posicionCicloFinal: number;  // posición al terminar ese mes
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
  tipoCiclo?: TipoCiclo;       // ciclo usado para esta generación
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

/** Longitud total del ciclo en días (Mantenido por compatibilidad histórica) */
export const CICLO_TOTAL = 15;

/**
 * Mapa de las configuraciones de los 4 ciclos soportados
 */
export const CONFIGURACIONES_CICLOS: Record<TipoCiclo, {
  nombre: string;
  totalDias: number;
  fases: ReadonlyArray<{ valor: ValorCelda; jornada: TipoJornada; turno: string }>;
}> = {
  '12x3': {
    nombre: 'Ciclo 12x3 (6D-6N-3Desc)',
    totalDias: 15,
    fases: [
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
      { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
    ]
  },
  '10x5': {
    nombre: 'Ciclo 10x5 (5D-5N-5Desc)',
    totalDias: 15,
    fases: [
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
      { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
      { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
      { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
    ]
  },
  '2x2': {
    nombre: 'Ciclo 2x2 (2D-2N-2Desc NR)',
    totalDias: 6,
    fases: [
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
      { valor: 'NR', jornada: 'descanso_no_remunerado',  turno: 'descanso' },
    ]
  },
  '13x2': {
    nombre: 'Ciclo 13x2 (13D-2R-13N-2R)',
    totalDias: 30,
    fases: [
      // 13 días de día
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      { valor: 'D',  jornada: 'normal',                 turno: 'AM' },
      // 2 descansos remunerados
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
      // 13 días de noche
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      { valor: 'N',  jornada: 'normal',                 turno: 'PM' },
      // 2 descansos remunerados
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
      { valor: 'R',  jornada: 'descanso_remunerado',     turno: 'descanso' },
    ]
  }
};

/**
 * Mapa completo del ciclo original (Mantenido por compatibilidad)
 */
const CICLO = CONFIGURACIONES_CICLOS['12x3'].fases;

// ── Funciones primitivas del ciclo ───────────────────────────────────────────

/**
 * Normaliza cualquier número de día de ciclo al rango del ciclo indicado.
 */
export function normalizarPosicion(pos: number, tipoCiclo: TipoCiclo = '12x3'): number {
  const config = CONFIGURACIONES_CICLOS[tipoCiclo] || CONFIGURACIONES_CICLOS['12x3'];
  const total = config.totalDias;
  return ((pos % total) + total) % total;
}

/**
 * Obtiene el estado del ciclo en una posición dada.
 */
export function estadoCiclo(pos: number, tipoCiclo: TipoCiclo = '12x3'): { valor: ValorCelda; jornada: TipoJornada; turno: string } {
  const config = CONFIGURACIONES_CICLOS[tipoCiclo] || CONFIGURACIONES_CICLOS['12x3'];
  return config.fases[normalizarPosicion(pos, tipoCiclo)];
}

/**
 * Determina qué fase del ciclo corresponde a una posición.
 * Útil para mostrar el bloque actual al usuario.
 */
export function faseCiclo(pos: number, tipoCiclo: TipoCiclo = '12x3'): 'DIURNO' | 'DESCANSO_D' | 'NOCTURNO' | 'DESCANSO_N' {
  const config = CONFIGURACIONES_CICLOS[tipoCiclo] || CONFIGURACIONES_CICLOS['12x3'];
  const p = normalizarPosicion(pos, tipoCiclo);

  if (tipoCiclo === '13x2') {
    if (p <= 12) return 'DIURNO';
    if (p <= 14) return 'DESCANSO_D';
    if (p <= 27) return 'NOCTURNO';
    return 'DESCANSO_N';
  }
  if (tipoCiclo === '10x5') {
    if (p <= 4) return 'DIURNO';
    if (p <= 9) return 'NOCTURNO';
    return 'DESCANSO_N';
  }
  if (tipoCiclo === '2x2') {
    if (p <= 1) return 'DIURNO';
    if (p <= 3) return 'NOCTURNO';
    return 'DESCANSO_N';
  }
  
  // 12x3 default
  if (p <= 5)  return 'DIURNO';
  if (p <= 11) return 'NOCTURNO';
  return 'DESCANSO_N';
}

/**
 * Calcula el valor de celda visible: D, N, R, o NR.
 */
export function valorCelda(pos: number, tipoCiclo: TipoCiclo = '12x3'): ValorCelda {
  const config = CONFIGURACIONES_CICLOS[tipoCiclo] || CONFIGURACIONES_CICLOS['12x3'];
  return config.fases[normalizarPosicion(pos, tipoCiclo)].valor;
}

// ── Generador de tablero mensual ─────────────────────────────────────────────

/**
 * Genera el tablero de un mes para un ciclo específico
 */
export function generarTableroMes(
  posicionDia1: number,
  anio: number,
  mes: number,
  vigilanteId: string,
  rol: string,
  puestoId: string,
  tipoCiclo: TipoCiclo = '12x3',
): ResultadoTableroMes {
  const diasTotales = new Date(anio, mes + 1, 0).getDate();
  const posInicio = normalizarPosicion(posicionDia1, tipoCiclo);
  const config = CONFIGURACIONES_CICLOS[tipoCiclo] || CONFIGURACIONES_CICLOS['12x3'];
  const celdas: CeldaTurno[] = [];

  for (let d = 0; d < diasTotales; d++) {
    const pos = normalizarPosicion(posInicio + d, tipoCiclo);
    const estado = config.fases[pos];
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
    posicionFinMes: normalizarPosicion(posInicio + diasTotales - 1, tipoCiclo),
    tipoCiclo,
  };
}

/**
 * Calcula la posición en ciclo del día 1 del mes siguiente
 */
export function posicionDia1MesSiguiente(posicionUltimoDia: number, tipoCiclo: TipoCiclo = '12x3'): number {
  return normalizarPosicion(posicionUltimoDia + 1, tipoCiclo);
}

// ── Conversión entre AsignacionDia ↔ CeldaTurno ──────────────────────────────

/**
 * Convierte una CeldaTurno del motor a AsignacionDia del store
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
    posicionCiclo: celda.posicionCiclo,
  };
}

/**
 * Extrae la posición en ciclo de una celda existente (AsignacionDia)
 */
export function inferirPosicionDesdeCelda(asig: AsignacionDia, tipoCiclo: TipoCiclo = '12x3'): number | null {
  const { jornada, turno } = asig;
  const config = CONFIGURACIONES_CICLOS[tipoCiclo] || CONFIGURACIONES_CICLOS['12x3'];
  const fases = config.fases;

  const isDescRem = (jornada === 'descanso_remunerado');
  const isDescNoRem = (jornada === 'descanso_no_remunerado');
  const isDiurno = (jornada === 'normal' && turno === 'AM');
  const isNocturno = (jornada === 'normal' && turno === 'PM');

  for (let i = 0; i < fases.length; i++) {
    const f = fases[i];
    if (isDiurno && f.valor === 'D') return i;
    if (isNocturno && f.valor === 'N') return i;
    if (isDescRem && f.valor === 'R') return i;
    if (isDescNoRem && f.valor === 'NR') return i;
  }
  return null;
}

// ── Extractor de estado fin de mes desde asignaciones guardadas ───────────────

/**
 * Dado el array de asignaciones guardadas de un mes,
 * extrae el estado final de ciclo de cada vigilante.
 */
export function extraerEstadosFinMes(
  asignaciones: AsignacionDia[],
  anio: number,
  mes: number,
  puestoId: string,
  personalMesAnterior?: Array<{ rol: string; vigilanteId: string | null; tipoCiclo?: TipoCiclo }>,
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
    const sorted = [...asigs].sort((a, b) => b.dia - a.dia);
    const ultimaAsig = sorted[0];

    if (!ultimaAsig) return;

    // Buscar tipo de ciclo en el personal del mes anterior
    const rConfig = personalMesAnterior?.find(p => p.rol === rol);
    const tCiclo = rConfig?.tipoCiclo || '12x3';
    const config = CONFIGURACIONES_CICLOS[tCiclo] || CONFIGURACIONES_CICLOS['12x3'];

    const posExplicita = (ultimaAsig as any).posicionCiclo;
    const posicionFinal = typeof posExplicita === 'number'
      ? normalizarPosicion(posExplicita, tCiclo)
      : reconstruirPosicionDesdeHistorial(asigs, diasMes, tCiclo);

    estados.push({
      vigilanteId,
      puestoId,
      rol,
      anio,
      mes,
      ultimoDiaCalculado: ultimaAsig.dia,
      posicionCicloFinal: posicionFinal,
      valorFinal: config.fases[posicionFinal]?.valor || 'D',
    });
  });

  return estados;
}

/**
 * Reconstruye la posición en ciclo del último día del mes
 */
function reconstruirPosicionDesdeHistorial(
  asigs: AsignacionDia[],
  diasMes: number,
  tipoCiclo: TipoCiclo = '12x3',
): number {
  const sorted = [...asigs].sort((a, b) => a.dia - b.dia);
  if (sorted.length === 0) return 0;

  const valores = new Array<ValorCelda | null>(diasMes + 1).fill(null);
  sorted.forEach(a => {
    if (a.dia >= 1 && a.dia <= diasMes) {
      valores[a.dia] = asignacionToValorCelda(a);
    }
  });

  const config = CONFIGURACIONES_CICLOS[tipoCiclo] || CONFIGURACIONES_CICLOS['12x3'];
  const fases = config.fases;
  const cicloLen = config.totalDias;

  for (let d = 1; d < diasMes; d++) {
    const v1 = valores[d];
    const v2 = valores[d + 1];
    if (!v1 || !v2) continue;

    const matches: number[] = [];
    for (let i = 0; i < cicloLen; i++) {
      if (fases[i].valor === v1 && fases[(i + 1) % cicloLen].valor === v2) {
        matches.push(i);
      }
    }

    if (matches.length === 1) {
      const posAtD = matches[0];
      const posLast = posAtD + (diasMes - d);
      return ((posLast % cicloLen) + cicloLen) % cicloLen;
    }
  }

  const primera = sorted.find(
    (a) => a.jornada !== 'sin_asignar' && a.jornada !== 'vacacion',
  );
  if (!primera) return 0;

  const valPrimera = asignacionToValorCelda(primera);
  const firstIndex = fases.findIndex(f => f.valor === valPrimera);
  const posPrimera = firstIndex >= 0 ? firstIndex : 0;

  const offsetHastaFin = diasMes - primera.dia;
  return ((posPrimera + offsetHastaFin) % cicloLen + cicloLen) % cicloLen;
}

// ── Motor de transición de mes ────────────────────────────────────────────────

/**
 * Calcula la posición en ciclo del día 1 de un nuevo mes
 */
export function calcularPosicionNuevoMes(
  estadosFinMesAnterior: EstadoFinMes[],
  vigilanteId: string,
  rol: string,
  anioAnterior: number,
  mesAnterior: number,
  tipoCicloNuevo: TipoCiclo = '12x3',
): number {
  const estado = estadosFinMesAnterior.find(
    (e) =>
      (vigilanteId ? e.vigilanteId === vigilanteId : true) &&
      e.rol === rol &&
      e.anio === anioAnterior &&
      e.mes === mesAnterior,
  );

  if (!estado) {
    console.warn(
      `[MotorTurnos] ⚠️ Sin estado previo para ${vigilanteId}::${rol}. Iniciando desde pos 0.`,
    );
    return 0;
  }

  return posicionDia1MesSiguiente(estado.posicionCicloFinal, tipoCicloNuevo);
}

// ── Generador multi-rol para un puesto completo ───────────────────────────────

/**
 * Genera el tablero completo de un puesto para un mes dado
 */
export function generarTableroCompletoPuesto(
  puestoId: string,
  anio: number,
  mes: number,
  personalConfig: Array<{
    rol: string;
    vigilanteId: string | null;
    posicionDia1: number;
    tipoCiclo?: TipoCiclo;
  }>,
): Map<string, ResultadoTableroMes> {
  const resultado = new Map<string, ResultadoTableroMes>();

  personalConfig.forEach(({ rol, vigilanteId, posicionDia1, tipoCiclo }) => {
    if (!vigilanteId) return;
    const tablero = generarTableroMes(
      posicionDia1,
      anio,
      mes,
      vigilanteId,
      rol,
      puestoId,
      tipoCiclo || '12x3',
    );
    resultado.set(rol, tablero);
  });

  return resultado;
}

// ── Conversión a AsignacionDia[] (compatible con el store) ───────────────────

/**
 * Convierte un ResultadoTableroMes en el array AsignacionDia[]
 */
export function tableroToAsignaciones(tablero: ResultadoTableroMes): AsignacionDia[] {
  return tablero.celdas.map((celda) =>
    celdaToAsignacion(celda, tablero.vigilanteId, tablero.rol),
  );
}

/**
 * Convierte todos los tableros de un puesto en AsignacionDia[]
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
    const tCiclo = tablero.tipoCiclo || '12x3';
    puestosData[rol] = {
      vigilanteId: tablero.vigilanteId,
      ultimo_dia_mes: diasMes,
      posicion_en_ciclo: ultimaCelda.posicionCiclo,
      turno_actual: ultimaCelda.valor,
      fase_actual: faseCiclo(ultimaCelda.posicionCiclo, tCiclo),
      posicion_dia1_mes_siguiente: posicionDia1MesSiguiente(ultimaCelda.posicionCiclo, tCiclo),
      tipo_ciclo: tCiclo,
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
  personal: Array<{ rol: string; vigilanteId: string | null; tipoCiclo?: TipoCiclo }>,
  asignacionesMesAnterior: AsignacionDia[],
  anioMesAnterior: number,
  mesMesAnterior: number,
  personalMesAnterior?: Array<{ rol: string; vigilanteId: string | null; tipoCiclo?: TipoCiclo }>,
): AsignacionDia[] | null {
  if (!personal || personal.length === 0) return null;

  // 1. Extraer estados finales del mes anterior (si existen)
  const estadosPrevios: EstadoFinMes[] = asignacionesMesAnterior.length > 0
    ? extraerEstadosFinMes(asignacionesMesAnterior, anioMesAnterior, mesMesAnterior, puestoId, personalMesAnterior)
    : [];

  // 2. Calcular posición inicial del día 1 para cada rol (incluyendo roles vacantes)
  const personalConfig = personal
    .map((p) => {
      const posicion = calcularPosicionNuevoMes(
        estadosPrevios,
        p.vigilanteId || '',
        p.rol,
        anioMesAnterior,
        mesMesAnterior,
        p.tipoCiclo || '12x3',
      );
      return {
        rol: p.rol,
        vigilanteId: p.vigilanteId || null,
        posicionDia1: posicion,
        tipoCiclo: p.tipoCiclo || '12x3',
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
