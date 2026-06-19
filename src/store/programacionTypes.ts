// ── Jornadas laborales extendidas ─────────────────────────────────────────────
export type TipoJornada =
    | 'normal'                 // D / N — turno ordinario
    | 'descanso_remunerado'    // DR — descanso remunerado
    | 'descanso_no_remunerado' // NR — descanso no remunerado
    | 'vacacion'               // VAC — vacaciones / licencia ordinaria
    | 'licencia'               // LC — licencia / calamidades
    | 'suspension'             // SP — suspensión disciplinaria
    | 'incapacidad'            // IN — incapacidad médica
    | 'accidente'              // AC — accidente de trabajo
    | 'sin_asignar';           // — celda vacía

export type CodigoEstado = 'D' | 'N' | 'DR' | 'NR' | 'VAC' | 'LC' | 'SP' | 'IN' | 'AC' | '-';

export type TurnoHora = 'AM' | 'PM' | '24H';
export type RolPuesto = 'titular_a' | 'titular_b' | 'relevante' | string;
export type EstadoProgramacion = 'borrador' | 'publicado' | 'anulado';

// ── Catálogo de estados laborales (para el selector del modal) ────────────────
export interface EstadoLaboral {
    codigo: CodigoEstado;
    nombre: string;
    jornada: TipoJornada;
    colorBg: string;    // Tailwind bg class
    colorText: string;  // Tailwind text class
    colorHex: string;   // Para jspdf / exceljs
    icono: string;      // Material symbol
    esNovedad: boolean; // true → genera alerta automática
}

export const ESTADOS_LABORALES: EstadoLaboral[] = [
    { codigo: 'D',   nombre: 'Normal (Diurno)',        jornada: 'normal',                 colorBg: 'bg-sky-500/20',     colorText: 'text-sky-300',     colorHex: '#0ea5e9', icono: 'wb_sunny',        esNovedad: false },
    { codigo: 'N',   nombre: 'Normal (Nocturno)',       jornada: 'normal',                 colorBg: 'bg-indigo-600/20',  colorText: 'text-indigo-300',  colorHex: '#4f46e5', icono: 'brightness_3',    esNovedad: false },
    { codigo: 'DR',  nombre: 'Desc. Remunerado',        jornada: 'descanso_remunerado',    colorBg: 'bg-slate-500/20',   colorText: 'text-slate-300',   colorHex: '#64748b', icono: 'hotel',           esNovedad: false },
    { codigo: 'NR',  nombre: 'Desc. No Remunerado',     jornada: 'descanso_no_remunerado', colorBg: 'bg-orange-700/20',  colorText: 'text-orange-400',  colorHex: '#c2410c', icono: 'block',           esNovedad: false },
    { codigo: 'VAC', nombre: 'Vacaciones / Licencia',   jornada: 'vacacion',               colorBg: 'bg-emerald-500/20', colorText: 'text-emerald-300', colorHex: '#10b981', icono: 'beach_access',    esNovedad: false },
    { codigo: 'LC',  nombre: 'Licencia / Calamidades',  jornada: 'licencia',               colorBg: 'bg-yellow-500/20',  colorText: 'text-yellow-300',  colorHex: '#eab308', icono: 'report',          esNovedad: true  },
    { codigo: 'SP',  nombre: 'Suspensión',              jornada: 'suspension',             colorBg: 'bg-red-900/30',     colorText: 'text-red-400',     colorHex: '#7f1d1d', icono: 'gavel',           esNovedad: true  },
    { codigo: 'IN',  nombre: 'Incapacidad',             jornada: 'incapacidad',            colorBg: 'bg-purple-700/20',  colorText: 'text-purple-300',  colorHex: '#7c3aed', icono: 'medical_services', esNovedad: true },
    { codigo: 'AC',  nombre: 'Accidente de Trabajo',    jornada: 'accidente',              colorBg: 'bg-rose-500/20',    colorText: 'text-rose-300',    colorHex: '#f43f5e', icono: 'emergency',       esNovedad: true  },
    { codigo: '-',   nombre: 'Sin Asignar',             jornada: 'sin_asignar',            colorBg: 'bg-slate-900/20',   colorText: 'text-slate-500',   colorHex: '#1e293b', icono: 'person_off',      esNovedad: false },
];

// Helpers rápidos
export const getEstadoLaboral = (jornada: TipoJornada, turno?: string): EstadoLaboral => {
    if (jornada === 'normal') return turno === 'PM'
        ? ESTADOS_LABORALES.find(e => e.codigo === 'N')!
        : ESTADOS_LABORALES.find(e => e.codigo === 'D')!;
    const map: Partial<Record<TipoJornada, CodigoEstado>> = {
        descanso_remunerado:    'DR',
        descanso_no_remunerado: 'NR',
        vacacion:               'VAC',
        licencia:               'LC',
        suspension:             'SP',
        incapacidad:            'IN',
        accidente:              'AC',
        sin_asignar:            '-',
    };
    const codigo = map[jornada] ?? '-';
    return ESTADOS_LABORALES.find(e => e.codigo === codigo) ?? ESTADOS_LABORALES[ESTADOS_LABORALES.length - 1];
};

export interface AsignacionDia {
    dia: number;
    vigilanteId: string | null;
    turno: TurnoHora | string;
    jornada: TipoJornada;
    rol: RolPuesto;
    codigo_personalizado?: CodigoEstado | null; // Código explícito elegido en el modal
    inicio?: string;
    fin?: string;
    confirmado_por?: string;           // Usuario que confirmó
    timestamp_confirmacion?: string;   // ISO8601
}

export interface PersonalPuesto {
    rol: RolPuesto;
    vigilanteId: string | null;
    turnoId?: string;
    displayName?: string; // Etiqueta visible personalizada (para roles con ID UUID-style)
}

export interface CambioProgramacion {
    id: string;
    timestamp: string;
    usuario: string;
    descripcion: string;
    tipo: 'asignacion' | 'publicacion' | 'borrador' | 'personal' | 'rechazo_ia' | 'sistema';
    reglaViolada?: string;
}

export interface ProgramacionMensual {
    id: string;
    puestoId: string;
    anio: number;
    mes: number;
    personal: PersonalPuesto[];
    asignaciones: AsignacionDia[];
    estado: EstadoProgramacion;
    creadoEn: string;
    actualizadoEn: string;
    version: number;
    historialCambios: CambioProgramacion[];
    isDetailLoaded?: boolean;
    isFetching?: boolean;
    syncStatus?: 'synced' | 'pending' | 'error';
}

export interface TemplateProgramacion {
    id: string;
    nombre: string;
    puestoId: string;
    puestoNombre: string;
    personal: PersonalPuesto[];
    patron: Array<{ diaRelativo: number; rol: RolPuesto; turno: string; jornada: TipoJornada; vigilanteId: string | null }>;
    creadoEn: string;
    creadoPor: string;
}

export interface ResultadoValidacion {
    permitido: boolean;
    tipo: 'bloqueo' | 'advertencia' | 'ok';
    mensaje: string;
    regla?: string;
}

export interface SyncResult {
    success: boolean;
    serverVersion: number;
    serverUpdatedAt: string | null;
}
