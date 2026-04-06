import React, { useMemo, useState } from 'react';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { useProgramacionStore, type ProgramacionMensual, type RolPuesto, translateToUuid } from '../../store/programacionStore';
import { usePuestoStore } from '../../store/puestoStore';
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
  hideBusyGuards?: boolean;
  setHideBusyGuards?: (v: boolean) => void;
  // Props para el selector de Tablero B (puesto destino)
  compareProgId?: string | null;
  setCompareProgId?: (id: string | null) => void;
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
  setHideBusyGuards,
  compareProgId,
  setCompareProgId,
}: CoordinationPanelProps) => {
  const vigilantes = useVigilanteStore(s => s.vigilantes);
  const vMap = useVigilanteStore(s => s.vigilanteMap);
  const _busyMap = useProgramacionStore(s => s._busyMap);
  const allProgramaciones = useProgramacionStore(s => s.programaciones);
  const allPuestos = usePuestoStore(s => s.puestos);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayCount, setDisplayCount] = useState(40);
  const [showDestSelector, setShowDestSelector] = useState(false);

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
            const j = (a.jornada || (a as any).turno || 'normal') as string;
            m.get(a.dia)!.add(j);
        }
    });
    return m;
  }, [freshCProg]);

  // FIX CRÍTICO: Construir conjunto de vigilantes OCUPADOS usando datos locales
  // Esto sirve como respaldo cuando _busyMap no está poblado todavía.
  // Un vigilante "ocupado" es aquel que ya tiene turnos asignados en CUALQUIER puesto de este mismo mes.
  const localBusyVids = useMemo(() => {
    const busySet = new Set<string>();
    const anio = currentProg?.anio;
    const mes = currentProg?.mes;
    const currentPuestoId = currentProg?.puestoId;
    
    if (!anio || mes === undefined) return busySet;
    
    allProgramaciones.forEach(p => {
      // Solo analizar el mismo mes/año, excluyendo el puesto actual
      if (p.anio !== anio || p.mes !== mes) return;
      if (p.puestoId === currentPuestoId) return;
      
      (p.asignaciones || []).forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar') {
          const uuid = translateToUuid(a.vigilanteId);
          if (uuid) busySet.add(uuid);
        }
      });
    });
    return busySet;
  }, [allProgramaciones, currentProg]);

  // Puestos disponibles para seleccionar como Tablero B (excluyendo el actual)
  const availableDestPuestos = useMemo(() => {
    return allPuestos.filter(p => {
      const pid = p.dbId || p.id;
      const currentId = currentProg?.puestoId;
      return pid !== currentId && p.id !== currentId;
    });
  }, [allPuestos, currentProg]);

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
    
    // FILTRO TÁCTICO "No Repetir" — Mejorado con datos locales como respaldo
    if (hideBusyGuards) {
      result = result.filter(vid => {
        // Si ya está en el staff del puesto actual, siempre lo mostramos (para ver sus turnos)
        if (originStaffVids.some(id => translateToUuid(id) === vid)) return true;
        
        // Verificar vía _busyMap (si está disponible y poblado)
        if (_busyMap && _busyMap.size > 0) {
          const isBusyInStore = _busyMap.has(`${vid}-${currentProg?.anio}-${currentProg?.mes}`);
          return !isBusyInStore;
        }
        
        // Fallback: usar datos locales construidos arriba
        // Si el vigilante ya está asignado en otro puesto este mes, lo ocultamos
        return !localBusyVids.has(vid);
      });
    }

    return result.sort((a, b) => {
      const aIn = originStaffVids.some(id => translateToUuid(id) === a);
      const bIn = originStaffVids.some(id => translateToUuid(id) === b);
      if (aIn && !bIn) return -1;
      if (!aIn && bIn) return 1;
      return 0;
    }).slice(0, displayCount);
  }, [uniqueVids, originStaffVids, displayCount, hideBusyGuards, _busyMap, localBusyVids, currentProg]);

  return (
    <div className="mt-8 bg-slate-900 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
      <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Panel de <span className="text-indigo-400">Coordinación Táctica</span></h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              {freshCProg
                ? `Comparando con: ${allPuestos.find(p => p.dbId === freshCProg.puestoId || p.id === freshCProg.puestoId)?.nombre || 'Puesto Destino'}`
                : 'Selecciona un Tablero Destino para comparar disponibilidad'
              }
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             {/* SELECTOR TABLERO B — Fix: ahora sí se puede seleccionar un puesto destino */}
             <div className="relative">
               <button
                 onClick={() => setShowDestSelector(!showDestSelector)}
                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${freshCProg ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
               >
                 <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                 {freshCProg 
                   ? (allPuestos.find(p => p.dbId === freshCProg.puestoId || p.id === freshCProg.puestoId)?.nombre?.substring(0, 20) || 'Tablero B')
                   : 'Tablero B'
                 }
               </button>

               {showDestSelector && (
                 <div className="absolute top-full right-0 mt-3 w-72 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[100] p-3 animate-in zoom-in-95 duration-200">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">Seleccionar Puesto Destino</p>
                   {freshCProg && (
                     <button
                       onClick={() => { setCompareProgId?.(null); setShowDestSelector(false); }}
                       className="w-full text-left p-2.5 mb-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[10px] font-black text-red-400 uppercase flex items-center gap-2"
                     >
                       <span className="material-symbols-outlined text-[14px]">close</span> Quitar comparación
                     </button>
                   )}
                   <div className="space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                     {availableDestPuestos.length === 0 ? (
                       <p className="text-[10px] text-slate-500 italic text-center py-4">No hay puestos disponibles</p>
                     ) : availableDestPuestos.map(p => {
                       const pid = p.dbId || p.id;
                       // Buscar la programación de este puesto en el mismo mes/año
                       const destProg = allProgramaciones.find(pr => 
                         (pr.puestoId === pid || pr.puestoId === p.id) && 
                         pr.anio === currentProg?.anio && 
                         pr.mes === currentProg?.mes
                       );
                       return (
                         <button
                           key={p.id}
                           onClick={() => {
                             if (destProg) {
                               setCompareProgId?.(destProg.id);
                             } else {
                               showTacticalToast({ title: 'Sin Programación', message: `${p.nombre} no tiene programación para este mes.`, type: 'info' });
                             }
                             setShowDestSelector(false);
                           }}
                           className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group ${freshCProg?.puestoId === pid ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-white/5 hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30'}`}
                         >
                           <div>
                             <p className="text-[11px] font-black text-white uppercase leading-tight">{p.nombre}</p>
                             <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{destProg ? `${(destProg.asignaciones || []).filter(a => a.vigilanteId).length} asignaciones` : 'Sin programación este mes'}</p>
                           </div>
                           <span className="material-symbols-outlined text-[14px] text-white/30 group-hover:text-indigo-400 transition-colors">arrow_forward</span>
                         </button>
                       );
                     })}
                   </div>
                 </div>
               )}
             </div>

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
                 {hideBusyGuards ? `No Repetir ON (${localBusyVids.size} ocupados)` : 'Permitir Repeticiones'}
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
                {!freshCProg && <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-cyan-400 animate-pulse">compare_arrows</span> <span className="text-[9px] font-black text-cyan-400/80 uppercase">Selecciona Tablero B para comparar</span></div>}
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                {sortedVids.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="material-symbols-outlined text-[40px] text-slate-600 mb-3">group_off</span>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                      {hideBusyGuards ? 'Todos los vigilantes están ocupados este mes' : 'Sin personal en este tablero'}
                    </p>
                    {hideBusyGuards && (
                      <button onClick={() => setHideBusyGuards?.(false)} className="mt-3 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[9px] font-black uppercase transition-all border border-white/10">
                        Desactivar filtro "No Repetir"
                      </button>
                    )}
                  </div>
                )}
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
                              if (has24 || (hasAM && hasPM)) { bg = "rgba(239,68,68,0.4)"; ring = "rgba(239,68,68,0.8)"; }
                              else if (hasAM) { bg = "linear-gradient(135deg, rgba(59,130,246,0.5) 50%, rgba(34,197,94,0.3) 50%)"; ring = "rgba(59,130,246,0.8)"; }
                              else if (hasPM) { bg = "linear-gradient(135deg, rgba(34,197,94,0.3) 50%, rgba(168,85,247,0.5) 50%)"; ring = "rgba(168,85,247,0.8)"; }
                              else if (ocupadoB) { bg = "rgba(234,179,8,0.25)"; ring = "rgba(234,179,8,0.5)"; }
                              else { bg = "rgba(34,197,94,0.4)"; ring = "rgba(34,197,94,0.8)"; }
                           }

                           return (
                             <button
                               key={d}
                               onClick={() => {
                                   if (!isSelected || !vid) return;
                                   if (has24 || (hasAM && hasPM)) {
                                      showTacticalToast({ title: "Sin Disponibilidad", message: "Efectivo ocupado tanto en AM como en PM.", type: "warning" });
                                      return;
                                   }
                                   if (!freshCProg) {
                                     showTacticalToast({ title: "Sin Tablero Destino", message: "Selecciona un Puesto Destino (Tablero B) primero.", type: "info" });
                                     return;
                                   }
                                   const targetAsig = freshCProg?.asignaciones.find(a => a.dia === d);
                                   if (targetAsig) {
                                      onOpenEdit({ asig: targetAsig, progId: freshCProg!.id, preSelectVigilanteId: vid });
                                   } else {
                                      showTacticalToast({ title: "Aviso", message: "No hay ranura disponible en Tablero B.", type: "error" });
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
