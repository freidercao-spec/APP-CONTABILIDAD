import React, { useMemo, useState } from 'react';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { useProgramacionStore, type ProgramacionMensual, type RolPuesto, idsMatch, translateToUuid } from '../../store/programacionStore';
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
  onOpenEdit,
  hideBusyGuards = true,
  setHideBusyGuards
}: CoordinationPanelProps & { hideBusyGuards?: boolean; setHideBusyGuards?: (v: boolean) => void }) => {
  const vigilantes = useVigilanteStore(s => s.vigilantes);
  const vMap = useVigilanteStore(s => s.vigilanteMap);
  const _busyMap = useProgramacionStore(s => s._busyMap);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayCount, setDisplayCount] = useState(40);

  // PRE-OPTIMIZACIÓN NÚCLEO: Mapear personal en ORIGEN (Tablero A)
  const originStaffVids = useMemo(() => (currentProg?.personal || []).map(p => p.vigilanteId), [currentProg]);
  
  // PRE-OPTIMIZACIÓN NÚCLEO: Mapear asignaciones por vigilante en ORIGEN para búsqueda O(1)
  const originAsigsMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    currentProg?.asignaciones.forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar') {
            const vid = translateToUuid(a.vigilanteId);
            if (!vid) return;
            if (!m.has(vid)) m.set(vid, new Set());
            const j = (a.jornada || (a as any).turno || 'normal') as string;
            if (j === '24H') { m.get(vid)!.add(`${a.dia}-AM`); m.get(vid)!.add(`${a.dia}-PM`); m.get(vid)!.add(`${a.dia}-24H`); }
            else { m.get(vid)!.add(`${a.dia}-${j}`); }
            m.get(vid)!.add(`${a.dia}`); // Legacy support
        }
    });
    return m;
  }, [currentProg]);

  // PRE-OPTIMIZACIÓN NÚCLEO: Mapear asignaciones por día en DESTINO (Tablero B)
  const destAsigsMap = useMemo(() => {
    const m = new Map<number, Set<string>>();
    (freshCProg?.asignaciones || []).forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar') {
            if (!m.has(a.dia)) m.set(a.dia, new Set());
            const j = a.jornada || (a as any).turno || 'normal';
            m.get(a.dia)!.add(j);
        }
    });
    return m;
  }, [freshCProg]);

  const uniqueVids = useMemo(() => {
    const base = new Set(originStaffVids.map(id => translateToUuid(id)).filter(Boolean) as string[]);
    if (showEntireStaff || searchTerm) {
        const q = searchTerm.toLowerCase();
        let added = 0;
        for (const v of vigilantes) {
            if (added > 200) break;
            const vid = v.dbId || v.id;
            if (v.nombre.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)) {
                base.add(vid);
                added++;
            }
        }
    }
    return Array.from(base);
  }, [originStaffVids, showEntireStaff, searchTerm, vigilantes]);

  const sortedVids = useMemo(() => {
    let result = [...uniqueVids];
    
    // FILTRO TÁCTICO: No Repetir (Ocultar si están ocupados en el tablero origen o destino generales)
    if (hideBusyGuards && _busyMap) {
      result = result.filter(vid => {
        // Si ya está en el staff del puesto actual, lo permitimos (para ver sus turnos)
        if (originStaffVids.some(id => translateToUuid(id) === vid)) return true;
        
        // Si tiene asignaciones registradas (vía _busyMap o local), lo ocultamos 
        // para mantener el "tablero limpio" de repeticiones.
        const isBusyInStore = _busyMap.has(`${vid}-${currentProg?.anio}-${currentProg?.mes}`);
        return !isBusyInStore;
      });
    }

    return result.sort((a, b) => {
      const aIn = originStaffVids.some(id => translateToUuid(id) === a);
      const bIn = originStaffVids.some(id => translateToUuid(id) === b);
      if (aIn && !bIn) return -1;
      if (!aIn && bIn) return 1;
      return 0;
    }).slice(0, displayCount);
  }, [uniqueVids, originStaffVids, displayCount, hideBusyGuards, _busyMap, currentProg]);

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
                 {showEntireStaff ? 'Staff Extendido ON' : 'Ver Todo el Personal'}
              </button>

              <button 
                onClick={() => setHideBusyGuards?.(!hideBusyGuards)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${hideBusyGuards ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                 <span className="material-symbols-outlined text-[16px]">{hideBusyGuards ? 'lock' : 'lock_open'}</span>
                 {hideBusyGuards ? 'No Repetir ON' : 'Permitir Repeticiones'}
              </button>
          </div>
      </div>

      <div className="overflow-x-auto p-6 scrollbar-hide">
         <div className="min-w-max">
            {/* LEYENDA */}
            <div className="flex items-center gap-6 mb-8 px-6 py-3 bg-white/[0.03] rounded-2xl border border-white/5">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-emerald-500"/> <span className="text-[9px] font-black text-emerald-400/80 uppercase">Libre Ambas ✓</span></div>
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-red-500"/> <span className="text-[9px] font-black text-red-400/80 uppercase">Ocupado Origen</span></div>
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-blue-500"/> <span className="text-[9px] font-black text-blue-400/80 uppercase">Solo Mañana</span></div>
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-purple-500"/> <span className="text-[9px] font-black text-purple-400/80 uppercase">Solo Tarde</span></div>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                {sortedVids.map(vid => {
                   if (!vid) return null;
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
                              <p className="text-[7px] font-bold text-white/50 uppercase">{originStaffVids.some(id => translateToUuid(id) === vid) ? 'Staff Origen' : 'Externo'}</p>
                           </div>
                        </button>

                        {daysArr.map(d => {
                           const hasAM = asigsVigA?.has(`${d}-AM`);
                           const hasPM = asigsVigA?.has(`${d}-PM`);
                           const has24 = asigsVigA?.has(`${d}-24H`);
                           const ocupadoA = hasAM || hasPM || has24;
                           
                           const asigsBSet = destAsigsMap.get(d);
                           const ocupadoB = !!asigsBSet?.size;

                           let bg = "rgba(255,255,255,0.03)";
                           let ring = "rgba(255,255,255,0.06)";
                           
                           if (isSelected) {
                              if (has24 || (hasAM && hasPM)) { bg = "rgba(239,68,68,0.4)"; ring = "rgba(239,68,68,0.8)"; } // FULL RED
                              else if (hasAM) { bg = "linear-gradient(135deg, rgba(59,130,246,0.5) 50%, rgba(34,197,94,0.3) 50%)"; ring = "rgba(59,130,246,0.8)"; } // BLUE (AM) + GREEN (PM)
                              else if (hasPM) { bg = "linear-gradient(135deg, rgba(34,197,94,0.3) 50%, rgba(168,85,247,0.5) 50%)"; ring = "rgba(168,85,247,0.8)"; } // GREEN (AM) + PURPLE (PM)
                              else if (ocupadoB) { bg = "rgba(234,179,8,0.25)"; ring = "rgba(234,179,8,0.5)"; }
                              else { bg = "rgba(34,197,94,0.4)"; ring = "rgba(34,197,94,0.8)"; }
                           }

                           return (
                             <button
                               key={d}
                               onClick={() => {
                                   if (!isSelected || !vid) return;
                                   if (has24 || (hasAM && hasPM)) {
                                      showTacticalToast({ title: "Sin Disponibilidad", message: "Efectivo ocupado tando en AM como en PM.", type: "warning" });
                                   }
                                   // Buscamos cualquier asig para este día (vacío o no) para editarlo
                                   const targetAsig = freshCProg?.asignaciones.find(a => a.dia === d);
                                   if (targetAsig) {
                                      onOpenEdit({ asig: targetAsig, progId: freshCProg!.id, preSelectVigilanteId: vid });
                                   } else if (freshCProg) { 
                                      showTacticalToast({ title: "Aviso", message: "No hay ranura disponible.", type: "error" });
                                   }
                               }}
                               className="size-8 rounded-lg flex items-center justify-center transition-all border shrink-0 overflow-hidden"
                               style={{ background: bg, borderColor: ring }}
                             >
                                {isSelected && !ocupadoA && !ocupadoB && <span className="material-symbols-outlined text-[12px] text-emerald-400">check_circle</span>}
                                {isSelected && ocupadoA && !has24 && !(hasAM && hasPM) && <span className="text-[7px] font-black text-white/80">{hasAM ? 'AM' : 'PM'}</span>}
                                {isSelected && (has24 || (hasAM && hasPM)) && <span className="text-[7px] font-black text-white/50">BUSY</span>}
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
