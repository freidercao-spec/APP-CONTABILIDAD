import React from 'react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface MasterGridProps {
  anio: number;
  mes: number;
  filteredPuestos: any[];
  programaciones: any[];
  isInitialLoading: boolean;
  onSelectPuesto: (p: any) => void;
  onEditPuesto?: (p: any) => void;
}

export const MasterGrid = ({ anio, mes, filteredPuestos, programaciones, isInitialLoading, onSelectPuesto, onEditPuesto }: MasterGridProps) => {
  const totalDias = new Date(anio, mes + 1, 0).getDate();

  if (isInitialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#020617] rounded-[45px] m-6 border border-white/5 animate-pulse">
         <div className="size-24 rounded-[32px] bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/20">
            <span className="material-symbols-outlined text-[56px] text-indigo-500 animate-spin">sync</span>
         </div>
         <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.5em]">Reconstruyendo Red Táctica...</p>
      </div>
    );
  }

  // --- Helper: Determinar Color Táctico según turno ---
  const getTacticalColor = (jornada: string) => {
    const j = (jornada || '').toUpperCase();
    
    // NOVEDADES (Prioridad Alta)
    if (j === 'VACACION' || j === 'VAC' || j === 'VACACIONES') 
        return { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.5)', lg: 'from-pink-500/20 to-transparent', label: 'VAC' };
    
    if (j === 'DESCANSO_REMUNERADO' || j === 'DR') 
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', lg: 'from-emerald-500/20 to-transparent', label: 'DR' };
    
    if (j === 'DESCANSO_NO_REMUNERADO' || j === 'DNR') 
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.5)', lg: 'from-amber-500/20 to-transparent', label: 'DNR' };

    if (j.includes('DESCANSO')) 
        return { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.5)', lg: 'from-slate-500/20 to-transparent', label: 'DES' };

    // TURNOS OPERATIVOS
    if (j === '24H') 
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', lg: 'from-emerald-500/20 to-transparent', label: '24H' };

    if (j === 'PM' || j === 'N' || j === 'NOCHE') 
        return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.5)', lg: 'from-violet-500/20 to-transparent', label: 'NOCHE' };
    
    if (j === 'AM' || j === 'D' || j === 'DIA' || j === 'DÍA') 
        return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)', lg: 'from-blue-500/20 to-transparent', label: 'DÍA' };
    
    return { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.4)', lg: 'from-indigo-500/20 to-transparent', label: 'ACT' };
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#0f172a]/40 backdrop-blur-3xl rounded-[40px] border border-white/10 m-6 shadow-[0_24px_100px_rgba(0,0,0,0.6)] relative">
      <div className="overflow-auto custom-scrollbar flex-1">
        <table className="border-collapse border-none select-none" style={{ width: 'max-content', tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-50">
            <tr className="bg-[#0f172a] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <th className="sticky left-0 z-50 bg-[#0f172a] border-r border-white/10 p-8 text-left" style={{ width: 340 }}>
                <div className="flex items-center gap-4">
                  <div className="size-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                    <span className="material-symbols-outlined text-white text-[24px]">grid_view</span>
                  </div>
                  <div>
                    <span className="text-[14px] font-black text-white uppercase tracking-[0.2em] block leading-none">Matriz de Control</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block opacity-70">Sincronización Tactical Live</span>
                  </div>
                </div>
              </th>
              {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                const date = new Date(anio, mes, d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <th key={d} className={`px-2 py-6 border-r border-white/5 text-center transition-all ${isWeekend ? 'bg-indigo-950/40' : 'bg-[#1e293b]/40'}`} style={{ width: 75 }}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWeekend ? 'text-indigo-400 opacity-90' : 'text-slate-500 opacity-60'}`}>
                      {date.toLocaleDateString('es', { weekday: 'short' }).toUpperCase()}
                    </p>
                    <p className={`text-[20px] font-black italic tracking-tighter ${isWeekend ? 'text-white' : 'text-slate-200'}`}>{d}</p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredPuestos.map((p) => (
              <tr key={p.id} className="group hover:bg-white/[0.04] transition-all border-b border-white/[0.05]">
                <td className="sticky left-0 z-40 bg-[#070d19] group-hover:bg-[#0c152a] border-r border-white/10 px-8 py-7 transition-all">
                  <div className="flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-indigo-500/70 uppercase tracking-[0.3em] font-mono">{p.id}</span>
                        <div className="flex items-center gap-2">
                           <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase ${p.tipo ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                             {p.tipo || 'Operativo'}
                           </span>
                           {onEditPuesto && (
                             <button 
                               onClick={() => onEditPuesto(p)}
                               className="size-7 rounded-lg bg-white/5 hover:bg-indigo-600 text-slate-500 hover:text-white transition-all flex items-center justify-center border border-white/5"
                             >
                               <span className="material-symbols-outlined text-[15px]">edit_note</span>
                             </button>
                           )}
                        </div>
                     </div>
                    <div className="flex items-center gap-3">
                        <span 
                          onClick={() => onSelectPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                          className="text-[15px] font-black text-slate-100 tracking-tight truncate hover:text-indigo-400 cursor-pointer transition-all uppercase italic group-hover:translate-x-1"
                        >
                          {p.nombre}
                        </span>
                        {(() => {
                            const prog = programaciones.find(pg => pg.puestoId === (p.dbId || p.id) && pg.anio === anio && pg.mes === mes);
                            if (prog?.syncStatus === 'pending') return <span className="size-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" title="Sincronización pendiente" />;
                            if (prog?.syncStatus === 'error') return <span className="size-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" title="Error de sincronización" />;
                            return null;
                        })()}
                    </div>
                  </div>
                </td>
                {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                  const prog = programaciones.find(pg => pg.puestoId === (p.dbId || p.id) && pg.anio === anio && pg.mes === mes);
                  const asigs = prog?.asignaciones?.filter(a => a.dia === d && a.vigilanteId && a.jornada !== 'sin_asignar');
                  
                  return (
                    <td 
                      key={d} 
                      className="p-1 border-r border-white/5 cursor-pointer hover:bg-white/[0.03] transition-all group/cell"
                      onClick={() => onSelectPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                    >
                      <div className="h-16 w-full flex flex-col gap-1 items-center justify-center p-1">
                        {asigs && asigs.length > 0 ? (
                          asigs.map((asig, idx) => {
                            const tactical = getTacticalColor(asig.jornada);
                            return (
                              <div 
                                key={idx}
                                className={`w-full flex-1 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all hover:scale-105 shadow-xl bg-gradient-to-br ${tactical.lg}`}
                                style={{ 
                                  backgroundColor: tactical.bg, 
                                  borderColor: tactical.border, 
                                  color: tactical.color,
                                  boxShadow: `inset 0 0 12px ${tactical.border}33, 0 4px 12px rgba(0,0,0,0.5)`
                                }}
                              >
                                {tactical.label}
                              </div>
                            );
                          })
                        ) : (
                          <div className="size-2 rounded-full bg-white/[0.05] group-hover/cell:bg-indigo-500/30 transition-all"></div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* --- Footer legend for MasterGrid --- */}
      <div className="absolute bottom-6 right-10 flex gap-6 px-8 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-55 pointer-events-none">
         <div className="flex items-center gap-2">
           <div className="size-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Día</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="size-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"></div>
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Noche</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">24H</span>
         </div>
      </div>
    </div>
  );
};
