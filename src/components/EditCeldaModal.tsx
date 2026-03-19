// VERSION 2.1 - Cleaned and isolated EditCeldaModal component
import React, { useState } from 'react';
import { AsignacionPuesto, Vigilante, TurnoConfig, JornadaConfig } from '../types';

interface EditCeldaModalProps {
    asig: AsignacionPuesto;
    vigilantes: Array<{ id: string; dbId?: string; nombre: string; estado: string }>;
    titularesId: string[];
    ocupados: Map<string, string[]>;
    turnosConfig: TurnoConfig[];
    jornadasCustom: JornadaConfig[];
    onSave: (asig: AsignacionPuesto) => void;
    onClose: () => void;
}

const EditCeldaModal: React.FC<EditCeldaModalProps> = ({ asig, vigilantes, titularesId, ocupados, turnosConfig, jornadasCustom, onSave, onClose }) => {
    const [vigilanteId, setVigilanteId] = useState<string | null>(asig.vigilanteId);
    const [jornada, setJornada] = useState<string>(asig.jornada);
    const [error, setError] = useState<string | null>(null);

    const jornadasList = (jornadasCustom.length ? jornadasCustom : [
        { id: 'normal', nombre: 'Normal', short: 'N', color: '#4318FF' },
        { id: 'descanso_remunerado', nombre: 'Descanso Rem.', short: 'DR', color: '#10b981' },
        { id: 'descanso_no_remunerado', nombre: 'Descanso No R.', short: 'DNR', color: '#f59e0b' },
        { id: 'sin_asignar', nombre: 'Sin Asignar', short: '-', color: '#f1f5f9' },
    ]);

    const checkConflict = (vid: string | null, t: string) => {
        if (!vid) return null;
        const slots = ocupados.get(vid) || [];
        if (slots.includes(`${asig.dia}-${t}`)) {
            const v = vigilantes.find(gv => gv.id === vid || gv.dbId === vid);
            return `${v?.nombre || 'Efectivo'} ya tiene turno el dia ${asig.dia} (${t})`;
        }
        return null;
    };

    const handleSave = () => {
        const conflict = checkConflict(vigilanteId, asig.turno || 'AM');
        if (conflict) {
            setError(conflict);
            return;
        }
        onSave({ ...asig, vigilanteId, jornada });
    };

    const selectedVig = vigilantes.find(v => v.id === vigilanteId || v.dbId === vigilanteId);
    const jornadaActual = jornadasList.find(j => j.id === jornada) ?? jornadasList[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in transition-all">
            <div className="bg-white max-w-lg w-full rounded-[32px] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
                <div className="p-8 flex-1 space-y-6">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Editor de Asignacion</p>
                            <h3 className="text-xl font-black text-slate-900 uppercase">DIA {asig.dia} - {asig.turno}</h3>
                        </div>
                        <button onClick={onClose} className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-600 animate-in slide-in-from-top-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            <span className="text-[11px] font-bold">{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Personal Asignado</label>
                            <select
                                value={vigilanteId || ''}
                                onChange={e => { setVigilanteId(e.target.value || null); setError(null); }}
                                className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-primary/30 focus:bg-white transition-all shadow-sm"
                            >
                                <option value="">- Sin Vigilante -</option>
                                <optgroup label="TITULARES DEL PUESTO">
                                    {vigilantes.filter(v => titularesId.includes(v.id) || (v.dbId && titularesId.includes(v.dbId))).map(v => (
                                        <option key={v.id} value={v.id}>⭐ {v.nombre}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="REEMPLAZOS / OTROS">
                                    {vigilantes.filter(v => !titularesId.includes(v.id) && !(v.dbId && titularesId.includes(v.dbId))).map(v => (
                                        <option key={v.id} value={v.id}>{v.nombre} ({v.estado})</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tipo de Jornada</label>
                            <div className="grid grid-cols-2 gap-2">
                                {jornadasList.map(j => (
                                    <button
                                        key={j.id}
                                        onClick={() => { setJornada(j.id); setError(null); }}
                                        className={`px-4 py-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${jornada === j.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'}`}
                                    >
                                        <div className="size-3 rounded-full shrink-0" style={{ background: j.color }} />
                                        <div className="text-left">
                                            <p className={`text-[11px] font-black uppercase ${jornada === j.id ? 'text-primary' : 'text-slate-600'}`}>{j.nombre}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button onClick={onClose} className="flex-1 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
                        <button onClick={handleSave} className="flex-[2] py-4 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all">Confirmar Cambios</button>
                    </div>
                </div>

                <div className="w-full md:w-56 bg-slate-50 p-8 border-t md:border-t-0 md:border-l border-slate-100">
                    <div className="space-y-6">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Vigilante Seleccionado</p>
                            <div className="aspect-square rounded-3xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-[48px] text-slate-200">person</span>
                            </div>
                            <p className="mt-3 text-xs font-black text-slate-900 line-clamp-2 leading-tight">{selectedVig?.nombre || 'VACANTE'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">{selectedVig?.estado || 'Sin asignar'}</p>
                        </div>
                        <div className="pt-4 border-t border-slate-200">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Turno & Jornada</p>
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-1 rounded-md bg-white border border-slate-100 text-[10px] font-black text-slate-700">{asig.turno}</div>
                                <div className="px-2 py-1 rounded-md text-[10px] font-black text-white" style={{ background: jornadaActual.color }}>{jornadaActual.short}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditCeldaModal;
