import type { Puesto, HistorialPuesto } from '../../store/puestoStore';
import { useVigilanteStore } from '../../store/vigilanteStore';

interface PuestoDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    puesto: Puesto;
}

const ACTION_CONFIG: Record<HistorialPuesto['action'], { label: string; color: string; icon: string }> = {
    creacion:  { label: 'Creacion',    color: 'bg-primary/10 text-primary border-primary/20',   icon: 'add_circle' },
    asignacion:{ label: 'Asignacion',  color: 'bg-success/10 text-success border-success/20',   icon: 'person_add' },
    remocion:  { label: 'Remocion',    color: 'bg-danger/10 text-danger border-danger/20',       icon: 'person_remove' },
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl bg-[#0f172a]/90 border border-white/10 rounded-[48px] shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ backdropFilter: 'blur(32px)' }}
      >
        {/* HEADER OPERACIONAL */}
        <div className="relative bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent px-10 py-8 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="size-16 rounded-[24px] bg-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                <span className="material-symbols-outlined text-white text-[32px] notranslate">analytics</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-[0.2em]">{puesto.tipo || 'Puesto Estándar'}</span>
                  <span className={`px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${puesto.estado === 'cubierto' ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {puesto.estado}
                  </span>
                </div>
                <h4 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{puesto.nombre}</h4>
              </div>
            </div>
            <button onClick={onClose} className="size-14 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all flex items-center justify-center border border-white/5">
              <span className="material-symbols-outlined text-[28px] notranslate">close</span>
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-10 py-8 space-y-10">
          
          {/* VIGILANTES ASIGNADOS - CARDS PREMIUM */}
          <section>
            <div className="flex items-center gap-4 mb-6">
               <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em]">Fuerza de Reacción</span>
               <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent"></div>
            </div>

            {turnosEnriquecidos.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-white/10 rounded-[32px]">
                <span className="material-symbols-outlined text-[48px] text-slate-700 notranslate">person_off</span>
                <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mt-4">Sin personal activo actualmente</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {turnosEnriquecidos.map((t, i) => {
                  const [ih, im] = t.horaInicio.split(':').map(Number);
                  const [fh, fm] = t.horaFin.split(':').map(Number);
                  const durMin = (fh * 60 + fm) - (ih * 60 + im);
                  const dur = durMin > 0 ? `${Math.floor(durMin / 60)}h ${durMin % 60 > 0 ? durMin % 60 + 'm' : ''}` : '24h';
                  
                  return (
                    <div key={t.vigilanteId} className="group relative p-6 bg-white/[0.03] border border-white/5 rounded-[32px] flex items-center justify-between hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all overflow-hidden shadow-xl">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex items-center gap-5 relative">
                        <div className="size-16 rounded-[20px] bg-white/5 border border-white/10 p-1 shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-2xl">
                          <img
                            src={t.v?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.nombre)}&background=4f46e5&color=fff&bold=true&size=128`}
                            alt=""
                            className="w-full h-full object-cover rounded-[14px]"
                          />
                        </div>
                        <div>
                          <p className="text-[16px] font-black text-white uppercase tracking-tight leading-none mb-2">{t.nombre}</p>
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg uppercase">Titular</span>
                             <span className="text-[10px] font-bold text-slate-500 font-mono">{t.v?.documento || 'ID: 00000'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-2 relative">
                         <div className="flex items-center gap-3 bg-black/40 px-5 py-2.5 rounded-2xl border border-white/5 shadow-inner">
                            <span className="material-symbols-outlined text-indigo-400 text-[18px]">schedule</span>
                            <span className="text-[14px] font-black text-white font-mono">{t.horaInicio} - {t.horaFin}</span>
                         </div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{dur} de jornada</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* HISTORIAL TÁCTICO - TIMELINE MODERN */}
          <section>
            <div className="flex items-center gap-4 mb-8">
               <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em]">Audit / Historial Local</span>
               <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent"></div>
            </div>

            <div className="relative pl-10 space-y-6">
              <div className="absolute left-4 top-0 bottom-4 w-px bg-gradient-to-b from-indigo-500/30 via-indigo-500/10 to-transparent" />
              
              {sortedHistory.slice(0, 8).map((event, i) => {
                const cfg = ACTION_CONFIG[event.action] || ACTION_CONFIG.cambio;
                const guardName = event.vigilanteId ? getGuardName(event.vigilanteId) : null;
                
                return (
                  <div key={event.id} className="relative group">
                    {/* Dot Indicator */}
                    <div className={`absolute -left-[30px] top-6 size-4 rounded-full border-4 border-[#0f172a] shadow-lg z-10 transition-transform group-hover:scale-125 ${i === 0 ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                    
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[28px] hover:bg-white/[0.04] transition-all">
                       <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2">
                             <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border flex items-center gap-2 ${cfg.color?.replace('bg-','text-').replace('/10','')}`}>
                                <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                                {cfg.label}
                             </span>
                             {guardName && (
                               <span className="text-[9px] font-black text-slate-400 bg-white/5 px-3 py-1 rounded-full uppercase truncate max-w-[140px]">
                                 {guardName}
                               </span>
                             )}
                          </div>
                          <span className="text-[10px] font-black text-slate-600 font-mono">
                             {new Date(event.timestamp).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                       </div>
                       <p className="text-[13px] font-medium text-slate-400 leading-relaxed pr-8">{event.details}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* FOOTER ACCIÓN */}
        <div className="px-10 py-8 bg-black/20 border-t border-white/5 flex items-center justify-between gap-6 flex-shrink-0">
           <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-[20px]">verified</span>
              </div>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest max-w-[200px]">AUDITORÍA INTERNA SYNC LIVE ACTIVA</p>
           </div>
           <button 
             onClick={onClose} 
             className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-indigo-900/40 active:scale-95"
           >
             Cerrar Informe
           </button>
        </div>
      </div>
    </div>
    );
};

export default PuestoDetailModal;
