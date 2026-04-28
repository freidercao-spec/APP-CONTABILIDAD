// VERSION 3.0 — EditCeldaModal con estados laborales completos + sincronización inmediata
import React, { useState, useMemo } from 'react';
import { AsignacionDia, TipoJornada, ESTADOS_LABORALES, getEstadoLaboral, CodigoEstado } from '../store/programacionTypes';
import type { TurnoConfig, JornadaConfig } from '../types';

interface Vigilante { id: string; dbId?: string; nombre: string; estado: string; }
interface Titular { rol: string; vigilanteId: string | null; turnoId?: string; }

interface EditCeldaModalProps {
    asig: AsignacionDia;
    vigilantes: Vigilante[];
    titularesId: string[];
    titulares?: Titular[];
    ocupados: Map<string, string[]>;
    turnosConfig: TurnoConfig[];
    jornadasCustom: JornadaConfig[];
    initialVigilanteId?: string;
    diaLabel?: string;
    onSave: (asig: AsignacionDia) => Promise<any> | void;
    onClose: () => void;
}

// ── Celdas de estado laboral ─────────────────────────────────────────────────
const EstadoBtn: React.FC<{
    estado: (typeof ESTADOS_LABORALES)[number];
    selected: boolean;
    onClick: () => void;
}> = ({ estado, selected, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`
            relative flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border-2 transition-all
            ${selected
                ? 'border-white/40 shadow-lg scale-[1.04]'
                : 'border-transparent bg-white/5 hover:bg-white/10 hover:border-white/10'}
        `}
        style={selected ? {
            background: `${estado.colorHex}22`,
            borderColor: `${estado.colorHex}55`,
            boxShadow: `0 0 16px ${estado.colorHex}33`,
        } : {}}
        title={estado.nombre}
    >
        {estado.esNovedad && (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 animate-pulse" />
        )}
        <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: selected ? estado.colorHex : '#64748b' }}
        >
            {estado.icono}
        </span>
        <span
            className="text-[9px] font-black uppercase tracking-wider"
            style={{ color: selected ? estado.colorHex : '#94a3b8' }}
        >
            {estado.codigo}
        </span>
        {selected && (
            <span className="text-[7px] font-bold text-center leading-tight" style={{ color: estado.colorHex }}>
                {estado.nombre.slice(0, 14)}
            </span>
        )}
    </button>
);

// ── Componente principal ─────────────────────────────────────────────────────
const EditCeldaModal: React.FC<EditCeldaModalProps> = ({
    asig,
    vigilantes,
    titularesId,
    titulares = [],
    ocupados,
    turnosConfig,
    jornadasCustom,
    initialVigilanteId,
    diaLabel,
    onSave,
    onClose,
}) => {
    const [vigilanteId, setVigilanteId] = useState<string | null>(
        initialVigilanteId ?? asig.vigilanteId
    );
    // Estado laboral seleccionado: derivar el código inicial desde la jornada actual
    const initialEstado = useMemo(
        () => getEstadoLaboral(asig.jornada || 'sin_asignar', asig.turno),
        []
    );
    const [codigoSeleccionado, setCodigoSeleccionado] = useState<CodigoEstado>(
        asig.codigo_personalizado ?? initialEstado.codigo
    );
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const estadoActual = ESTADOS_LABORALES.find(e => e.codigo === codigoSeleccionado)
        ?? ESTADOS_LABORALES[ESTADOS_LABORALES.length - 1];

    const selectedVig = vigilantes.find(v => v.id === vigilanteId || v.dbId === vigilanteId);

    // ── Validación de conflictos ─────────────────────────────────────────────
    const checkConflict = (vid: string | null): string | null => {
        if (!vid) return null;
        const slots = ocupados.get(vid) || [];
        const turno = asig.turno || 'AM';
        if (slots.includes(`${asig.dia}-24H`) || slots.includes(`${asig.dia}-${turno}`)) {
            const v = vigilantes.find(gv => gv.id === vid || gv.dbId === vid);
            return `${v?.nombre || 'Efectivo'} ya tiene turno el día ${asig.dia} (${turno})`;
        }
        return null;
    };

    // ── Mapeo código → jornada + turno ──────────────────────────────────────
    const codigoToAsig = (codigo: CodigoEstado): Partial<AsignacionDia> => {
        const estado = ESTADOS_LABORALES.find(e => e.codigo === codigo)!;
        const turno = codigo === 'N' ? 'PM' : codigo === 'D' ? 'AM' : asig.turno || 'AM';
        return {
            jornada: estado.jornada,
            turno,
            codigo_personalizado: codigo,
        };
    };

    // ── Guardar ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        const conflict = codigoSeleccionado !== '-' ? checkConflict(vigilanteId) : null;
        if (conflict) { setError(conflict); return; }

        setIsSaving(true);
        const patch = codigoToAsig(codigoSeleccionado);
        const updated: AsignacionDia = {
            ...asig,
            ...patch,
            vigilanteId,
            confirmado_por: (window as any).__usuario_actual || 'Operador',
            timestamp_confirmacion: new Date().toISOString(),
        };
        try {
            await onSave(updated);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Error al guardar. Intenta de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Grupos de estados ────────────────────────────────────────────────────
    const turnosActivos = ESTADOS_LABORALES.filter(e => ['D', 'N'].includes(e.codigo));
    const descansos    = ESTADOS_LABORALES.filter(e => ['DR', 'NR'].includes(e.codigo));
    const ausencias    = ESTADOS_LABORALES.filter(e => ['VAC', 'LC', 'SP', 'IN', 'AC'].includes(e.codigo));
    const sinAsignar   = ESTADOS_LABORALES.filter(e => e.codigo === '-');

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-[#0a1120] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-gradient-to-r from-primary/10 to-transparent shrink-0">
                    <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
                            Editor de Asignación
                        </p>
                        <h3 className="text-xl font-black text-white uppercase">
                            {diaLabel ?? `Día ${asig.dia}`} — {asig.rol?.replace('_', ' ').toUpperCase()}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Preview del estado seleccionado */}
                        <div
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl border-2 font-black text-sm tracking-wider"
                            style={{ background: `${estadoActual.colorHex}18`, borderColor: `${estadoActual.colorHex}44`, color: estadoActual.colorHex }}
                        >
                            <span className="material-symbols-outlined text-[18px]">{estadoActual.icono}</span>
                            {estadoActual.codigo}
                        </div>
                        <button
                            onClick={onClose}
                            className="size-9 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 animate-in slide-in-from-top-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            <span className="text-[11px] font-bold">{error}</span>
                        </div>
                    )}

                    {/* ── Selector de Vigilante ── */}
                    <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">
                            Personal Asignado
                        </label>
                        <select
                            value={vigilanteId || ''}
                            onChange={e => { setVigilanteId(e.target.value || null); setError(null); }}
                            className="w-full h-12 bg-white/5 border-2 border-white/10 rounded-2xl px-4 text-sm font-bold text-white outline-none focus:border-primary/50 focus:bg-primary/5 transition-all"
                        >
                            <option value="">— Sin Vigilante —</option>
                            <optgroup label="TITULARES DEL PUESTO">
                                {vigilantes
                                    .filter(v => titularesId.includes(v.id) || (v.dbId && titularesId.includes(v.dbId)))
                                    .map(v => (
                                        <option key={v.id} value={v.id}>⭐ {v.nombre}</option>
                                    ))}
                            </optgroup>
                            <optgroup label="REEMPLAZOS / OTROS">
                                {vigilantes
                                    .filter(v => !titularesId.includes(v.id) && !(v.dbId && titularesId.includes(v.dbId)))
                                    .map(v => (
                                        <option key={v.id} value={v.id}>{v.nombre} ({v.estado})</option>
                                    ))}
                            </optgroup>
                        </select>
                        {selectedVig && (
                            <p className="text-[10px] text-emerald-400 font-bold mt-2 ml-1">
                                ✓ {selectedVig.nombre} — {selectedVig.estado}
                            </p>
                        )}
                    </div>

                    {/* ── Estado Laboral ── */}
                    <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 block">
                            Estado Laboral
                        </label>

                        {/* Turnos activos */}
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2 mt-2">
                            Turnos Activos
                        </p>
                        <div className="grid grid-cols-5 gap-2 mb-3">
                            {turnosActivos.map(e => (
                                <EstadoBtn
                                    key={e.codigo}
                                    estado={e}
                                    selected={codigoSeleccionado === e.codigo}
                                    onClick={() => { setCodigoSeleccionado(e.codigo); setError(null); }}
                                />
                            ))}
                            {descansos.map(e => (
                                <EstadoBtn
                                    key={e.codigo}
                                    estado={e}
                                    selected={codigoSeleccionado === e.codigo}
                                    onClick={() => { setCodigoSeleccionado(e.codigo); setError(null); }}
                                />
                            ))}
                            {sinAsignar.map(e => (
                                <EstadoBtn
                                    key={e.codigo}
                                    estado={e}
                                    selected={codigoSeleccionado === e.codigo}
                                    onClick={() => { setCodigoSeleccionado(e.codigo); setError(null); }}
                                />
                            ))}
                        </div>

                        {/* Ausencias / Novedades */}
                        <p className="text-[8px] font-black text-rose-500/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span className="size-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                            Novedades — generan alerta automática
                        </p>
                        <div className="grid grid-cols-5 gap-2 p-3 rounded-2xl border border-rose-500/10 bg-rose-500/[0.03]">
                            {ausencias.map(e => (
                                <EstadoBtn
                                    key={e.codigo}
                                    estado={e}
                                    selected={codigoSeleccionado === e.codigo}
                                    onClick={() => { setCodigoSeleccionado(e.codigo); setError(null); }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Descripción del estado seleccionado */}
                    <div
                        className="flex items-center gap-4 p-4 rounded-2xl border"
                        style={{ background: `${estadoActual.colorHex}0d`, borderColor: `${estadoActual.colorHex}30` }}
                    >
                        <span
                            className="material-symbols-outlined text-[28px]"
                            style={{ color: estadoActual.colorHex }}
                        >
                            {estadoActual.icono}
                        </span>
                        <div>
                            <p className="text-sm font-black text-white">{estadoActual.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                Código: <span className="font-mono" style={{ color: estadoActual.colorHex }}>{estadoActual.codigo}</span>
                                {estadoActual.esNovedad && (
                                    <span className="ml-3 text-rose-400">⚠ Genera alerta en el tablero</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="border-t border-white/5 p-6 bg-black/20 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:bg-white/5 rounded-2xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-[2] py-4 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: estadoActual.colorHex, boxShadow: `0 8px 24px ${estadoActual.colorHex}33` }}
                    >
                        {isSaving ? (
                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        )}
                        {isSaving ? 'Guardando...' : 'Confirmar Despacho'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditCeldaModal;
