import React, { useMemo, useState } from 'react';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { useProgramacionStore, type ProgramacionMensual, type RolPuesto } from '../../store/programacionStore';
import { showTacticalToast } from '../../utils/tacticalToast';

interface CoordinationPanelProps {
  currentProg: ProgramacionMensual | null;
  freshCProg: ProgramacionMensual | null;
  compareVigilanteId: string | null;
  setCompareVigilanteId: (id: string | null) => void;
  showEntireStaff: boolean;
  setShowEntireStaff: (v: boolean) => void;
  daysArr: number[];
  onOpenEdit: (p: { asig: any; progId: string; preSelectVigilanteId: string; sourceProgId?: string; sourceRol?: string }) => void;
}

export const CoordinationPanel = ({
  currentProg,
  freshCProg,
  compareVigilanteId,
  setCompareVigilanteId,
  showEntireStaff,
  setShowEntireStaff,
  daysArr,
  onOpenEdit
}: CoordinationPanelProps) => {
  const vigilantes = useVigilanteStore(s => s.vigilantes);
  const vMap = useVigilanteStore(s => s.vigilanteMap);
  const idsMatch = useProgramacionStore.getState().idsMatch;
  const [searchTerm, setSearchTerm] = useState("");
  const [displayCount, setDisplayCount] = useState(40);

  // PRE-OPTIMIZACIÓN NÚCLEO: Mapear personal en ORIGEN (Tablero A)
  const originStaffVids = useMemo(() => (currentProg?.personal || []).map(p => p.vigilanteId), [currentProg]);
  
  // PRE-OPTIMIZACIÓN NÚCLEO: Mapear asignaciones por vigilante en ORIGEN para búsqueda O(1)
  const originAsigsMap = useMemo(() => {
    const m = new Map<string, Set<number>>();
    currentProg?.asignaciones.forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar') {
            if (!m.has(a.vigilanteId)) m.set(a.vigilanteId, new Set());
            m.get(a.vigilanteId)!.add(a.dia);
        }
    });
    return m;
  }, [currentProg]);

  // PRE-OPTIMIZACIÓN NÚCLEO: Mapear asignaciones por día en DESTINO (Tablero B)
  const destAsigsMap = useMemo(() => {
    const m = new Map<number, any[]>();
    (freshCProg?.asignaciones || []).forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar') {
            if (!m.has(a.dia)) m.set(a.dia, []);
            m.get(a.dia)!.push(a);
        }
    });
    return m;
  }, [freshCProg]);

  const uniqueVids = useMemo(() => {
    const base = new Set(originStaffVids);
    if (showEntireStaff || searchTerm) {
        // Si hay búsqueda or showEntire, incluimos más, pero limitamos para no colapsar el DOM
        const q = searchTerm.toLowerCase();
        let added = 0;
        for (const v of vigilantes) {
            if (added > 200) break; // Límite de seguridad
            if (v.nombre.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)) {
                base.add(v.id);
                added++;
            }
        }
    }
    return Array.from(base).filter(Boolean);
  }, [originStaffVids, showEntireStaff, searchTerm, vigilantes]);

  const sortedVids = useMemo(() => {
    return [...uniqueVids].sort((a, b) => {
      const aIn = originStaffVids.includes(a);
      const bIn = originStaffVids.includes(b);
      if (aIn && !bIn) return -1;
      if (!aIn && bIn) return 1;
      return 0;
    }).slice(0, displayCount);
  }, [uniqueVids, originStaffVids, displayCount]);

  return (
    <div className="mt-8 bg-slate-900 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
      <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Panel de <span className="text-indigo-400">Coordinación Táctica</span></h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Comparando disponibilidad entre Tableros Origen y Destino</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">search</span>
                <input 
                  type="text" 
                  placeholder="Filtrar vigilante..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-10 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all w-48"
                />
             </div>
             <button 
               onClick={() => setShowEntireStaff(!showEntireStaff)}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showEntireStaff ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
             >
                <span className="material-symbols-outlined text-[16px]">{showEntireStaff ? 'visibility' : 'visibility_off'}</span>
                {showEntireStaff ? 'Todo el Personal ON' : 'Ver Todo el Personal'}
             </button>
          </div>
      </div>

      <div className="overflow-x-auto p-6 scrollbar-hide">
         <div className="min-w-max">
            {/* LEYENDA */}
            <div className="flex items-center gap-6 mb-8 px-6 py-3 bg-white/[0.03] rounded-2xl border border-white/5">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-emerald-500"/> <span className="text-[9px] font-black text-emerald-400/80 uppercase">Libre Ambas ✓</span></div>
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-red-500"/> <span className="text-[9px] font-black text-red-400/80 uppercase">Ocupado Origen</span></div>
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-yellow-400"/> <span className="text-[9px] font-black text-yellow-400/80 uppercase">Destino Lleno</span></div>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                {sortedVids.map(vid => {
                   const vig = vMap.get(vid);
                   const isSelected = compareVigilanteId === vid;
                   const isDimmed = !!compareVigilanteId && !isSelected;
                   const asigsVigA = originAsigsMap.get(vid);

                   return (
                     <div key={vid} className={`flex gap-1 items-center transition-all rounded-xl py-1 relative ${isSelected ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : isDimmed ? 'opacity-20' : 'hover:bg-white/[0.04]'}`}>
                        <button 
                          onClick={() => setCompareVigilanteId(isSelected ? null : vid)}
                          className={`sticky left-0 z-20 w-44 text-left px-3 py-2 rounded-xl border flex items-center gap-2 shrink-0 transition-all ${isSelected ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-800 border-white/5 hover:border-white/20'}`}
                        >
                           <div className="size-6 rounded bg-black/20 flex items-center justify-center text-[10px] font-black text-white">{vig?.nombre?.[0] || '?'}</div>
                           <div className="min-w-0">
                              <p className="text-[10px] font-black text-white truncate">{vig?.nombre || vid}</p>
                              <p className="text-[7px] font-bold text-white/50 uppercase">{originStaffVids.includes(vid) ? 'Staff Origen' : 'Externo'}</p>
                           </div>
                        </button>

                        {daysArr.map(d => {
                           const ocupadoA = asigsVigA?.has(d);
                           const asigB = destAsigsMap.get(d)?.[0]; // Simplificación: primer asig del día
                           const ocupadoB = !!asigB;

                           let bg = "rgba(255,255,255,0.03)";
                           let ring = "rgba(255,255,255,0.06)";
                           
                           if (isSelected) {
                              if (ocupadoA && ocupadoB) { bg = "rgba(100,116,139,0.3)"; ring = "rgba(100,116,139,0.5)"; }
                              else if (ocupadoA) { bg = "rgba(239,68,68,0.25)"; ring = "rgba(239,68,68,0.5)"; }
                              else if (ocupadoB) { bg = "rgba(234,179,8,0.25)"; ring = "rgba(234,179,8,0.5)"; }
                              else { bg = "rgba(34,197,94,0.4)"; ring = "rgba(34,197,94,0.8)"; }
                           }

                           return (
                             <button
                               key={d}
                               onClick={() => {
                                  if (!isSelected) return;
                                  if (ocupadoA || ocupadoB) {
                                     showTacticalToast({ title: "Acción Bloqueda", message: ocupadoA ? "Efectivo ocupado en origen." : "Destino ya ocupado.", type: "warning" });
                                     return;
                                  }
                                  const targetAsig = freshCProg?.asignaciones.find(a => a.dia === d && (!a.vigilanteId || a.jornada === 'sin_asignar'));
                                  if (targetAsig) {
                                     onOpenEdit({ asig: targetAsig, progId: freshCProg!.id, preSelectVigilanteId: vid });
                                  }
                               }}
                               className="size-8 rounded-lg flex items-center justify-center transition-all border shrink-0"
                               style={{ background: bg, borderColor: ring }}
                             >
                                {isSelected && !ocupadoA && !ocupadoB && <span className="material-symbols-outlined text-[12px] text-emerald-400">check_circle</span>}
                                {isSelected && (ocupadoA || ocupadoB) && <span className="text-[8px] font-black text-white/40">{ocupadoA ? 'A' : 'B'}</span>}
                             </button>
                           );
                        })}
                     </div>
                   );
                })}
                {uniqueVids.length > displayCount && (
                  <button 
                    onClick={() => setDisplayCount(c => c + 100)}
                    className="w-full py-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:bg-white/5 rounded-2xl border border-dashed border-white/10"
                  >
                    Cargar más personal ({uniqueVids.length - displayCount} restantes)
                  </button>
                )}
            </div>
         </div>
      </div>
    </div>
  );
};
