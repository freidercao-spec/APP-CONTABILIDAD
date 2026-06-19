import type { ProgramacionMensual, AsignacionDia } from './programacionTypes';

export const calculateCobertura = (prog: ProgramacionMensual): number => {
    if (!prog || !prog.asignaciones || prog.asignaciones.length === 0) return 0;
    const totalSlots = 31 * 3; // Estimado simplificado para cálculo rápido
    const cubiertos = prog.asignaciones.filter(a => a.vigilanteId).length;
    return Math.round((cubiertos / totalSlots) * 100);
};

export const getBusyDaysForVigilante = (programaciones: ProgramacionMensual[], vigilanteId: string, anio: number, mes: number): Set<number> => {
    const busy = new Set<number>();
    programaciones.forEach(p => {
        if (p.anio === anio && p.mes === mes) {
            p.asignaciones.forEach(a => {
                if (a.vigilanteId === vigilanteId) {
                    busy.add(a.dia);
                }
            });
        }
    });
    return busy;
};

export const checkConflictHelper = (
    programaciones: ProgramacionMensual[],
    progId: string,
    dia: number,
    vigilanteId: string,
    turno: string
): string | null => {
    for (const p of programaciones) {
        if (p.id === progId) continue; // Mismo puesto no es conflicto (es cambio de turno usualmente)
        const conflict = p.asignaciones.find(a => a.dia === dia && a.vigilanteId === vigilanteId);
        if (conflict) {
            return `Vigilante ya asignado en ${p.puestoId} el día ${dia}`;
        }
    }
    return null;
};
