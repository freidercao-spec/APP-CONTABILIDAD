export type TipoJornada = 'normal' | 'descanso_remunerado' | 'descanso_no_remunerado' | 'vacacion' | 'sin_asignar';
export type TurnoHora = 'AM' | 'PM' | '24H';
export type RolPuesto = 'titular_a' | 'titular_b' | 'relevante' | string;
export type EstadoProgramacion = 'borrador' | 'publicado' | 'anulado';

export interface AsignacionDia {
    dia: number;
    vigilanteId: string | null;
    turno: TurnoHora | string;
    jornada: TipoJornada;
    rol: RolPuesto;
    inicio?: string; 
    fin?: string;    
}

export interface PersonalPuesto {
    rol: RolPuesto;
    vigilanteId: string | null;
    turnoId?: string;
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
