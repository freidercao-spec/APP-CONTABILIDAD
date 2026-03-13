import type { Puesto, HistorialPuesto } from '../../store/puestoStore';
import { useVigilanteStore } from '../../store/vigilanteStore';

interface PuestoDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    puesto: Puesto;
}

const ACTION_CONFIG: Record<HistorialPuesto['action'], { label: string; color: string; icon: string }> = {
    creacion:  { label: 'Creación',    color: 'bg-primary/10 text-primary border-primary/20',   icon: 'add_circle' },
    asignacion:{ label: 'Asignación',  color: 'bg-success/10 text-success border-success/20',   icon: 'person_add' },
    remocion:  { label: 'Remoción',    color: 'bg-danger/10 text-danger border-danger/20',       icon: 'person_remove' },
    cambio:    { label: 'Cambio',      color: 'bg-warning/10 text-warning border-warning/20',   icon: 'swap_horiz' },
    cobertura: { label: 'Cobertura',   color: 'bg-blue-100 text-blue-600 border-blue-200',      icon: 'schedule' },
};

const PuestoDetailModal = ({ isOpen, onClose, puesto }: PuestoDetailModalProps) => {
    const vigilantes = useVigilanteStore(s => s.vigilantes);

    if (!isOpen) return null;

    const getGuardName = (id?: string) => {
        if (!id) return 'Desconocido';
        const v = vigilantes.find(v => v.id === id);
        return v ? v.nombre : id;
    };

    const sortedHistory = [...puesto.historial].reverse();

    // Current assignments for the turno panel
    const turnosEnriquecidos = (puesto.turnos || []).map(t => ({
        ...t,
        nombre: getGuardName(t.vigilanteId),
        v: vigilantes.find(v => v.id === t.vigilanteId),
    }));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-[#070d1d]/95 backdrop-blur-2xl" />

            <div
                className="relative w-full max-w-2xl bg-[#0b1424] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[92vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/15 to-transparent px-8 py-5 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                            <span className="material-symbols-outlined text-primary text-2xl notranslate">hub</span>
                        </div>
                        <div>
                            <h4 className="text-base font-black text-white uppercase tracking-tight">{puesto.nombre}</h4>
                            <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] font-mono">{puesto.id} · {puesto.tipo}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`size-1.5 rounded-full ${puesto.estado === 'cubierto' ? 'bg-success' : puesto.estado === 'alerta' ? 'bg-warning animate-pulse' : 'bg-danger animate-pulse'}`} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{puesto.estado}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-10 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90">
                        <span className="material-symbols-outlined notranslate">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Current Shifts Panel */}
                    <div className="p-6 border-b border-white/5">
                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[16px] notranslate">schedule</span>
                            Turnos Actuales ({turnosEnriquecidos.length} vigilantes)
                        </h5>
                        {turnosEnriquecidos.length === 0 ? (
                            <div className="text-center py-8 opacity-40">
                                <span className="material-symbols-outlined text-3xl notranslate">person_off</span>
                                <p className="text-xs font-bold uppercase tracking-widest mt-2">Sin vigilantes asignados</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {turnosEnriquecidos.map((t, i) => {
                                    const [ih, im] = t.horaInicio.split(':').map(Number);
                                    const [fh, fm] = t.horaFin.split(':').map(Number);
                                    const durMin = (fh * 60 + fm) - (ih * 60 + im);
                                    const dur = durMin > 0 ? `${Math.floor(durMin / 60)}h ${durMin % 60 > 0 ? durMin % 60 + 'm' : ''}` : '–';
                                    return (
                                        <div key={t.vigilanteId} className="flex items-center justify-between gap-3 bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-primary/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-xl overflow-hidden border border-primary/20 shrink-0">
                                                    <img
                                                        src={t.v?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nombre)}&background=4318FF&color=fff&bold=true&size=80`}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-[12px] font-bold text-white">{t.nombre}</p>
                                                    <p className="text-[9px] font-mono text-slate-500">{t.vigilanteId} · {t.v?.rango || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-right">
                                                <div>
                                                    <p className="text-[11px] font-bold text-white">{t.horaInicio} → {t.horaFin}</p>
                                                    <p className="text-[9px] text-slate-500">{dur} de turno</p>
                                                </div>
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${i % 2 === 0 ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success'}`}>
                                                    T{i + 1}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* History Timeline */}
                    <div className="p-6">
                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[16px] notranslate">history</span>
                            Historial del Puesto ({sortedHistory.length} eventos)
                        </h5>

                        {sortedHistory.length === 0 ? (
                            <div className="text-center py-12 opacity-40">
                                <span className="material-symbols-outlined text-4xl notranslate">history_off</span>
                                <p className="text-xs font-bold uppercase tracking-widest mt-3">Sin historial registrado</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
                                <ul className="space-y-4 pl-14">
                                    {sortedHistory.map((event, i) => {
                                        const cfg = ACTION_CONFIG[event.action] || ACTION_CONFIG.cambio;
                                        const guardName = event.vigilanteId ? getGuardName(event.vigilanteId) : null;
                                        return (
                                            <li key={event.id} className="relative">
                                                <div className={`absolute -left-9 top-1 size-4 rounded-full border-2 border-[#0b1424] ${i === 0 ? 'bg-primary' : 'bg-slate-700'}`} />
                                                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-primary/20 transition-colors">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${cfg.color}`}>
                                                                {cfg.label}
                                                            </span>
                                                            {guardName && (
                                                                <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                                                                    {guardName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">
                                                            {new Date(event.timestamp).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400">{event.details}</p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 flex-shrink-0">
                    <button onClick={onClose} className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20">
                        Cerrar Vista de Puesto
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PuestoDetailModal;
