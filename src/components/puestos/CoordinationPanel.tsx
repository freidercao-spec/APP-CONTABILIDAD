import React, { useMemo, useState } from 'react';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { useProgramacionStore, type ProgramacionMensual, translateToUuid } from '../../store/programacionStore';
import { usePuestoStore } from '../../store/puestoStore';
import { showTacticalToast } from '../../utils/tacticalToast';

const getRolPdfLabel = (rol: string) => {
  const base: Record<string, string> = { titular_a: "TITULAR A", titular_b: "TITULAR B", relevante: "RELEVANTE" };
  return base[rol] || rol.replace(/_/g, " ").toUpperCase();
};

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
  compareProgId?: string | null;
  setCompareProgId?: (id: string | null) => void;
}

// ??? Helper: convierte cualquier jornada a claves normalizadas ????????????????
// Garantiza que "normal", "AM", "PM", "24H" y d?as de descanso se detecten
const resolveJornadaKeys = (dia: number, jornada: string): string[] => {
  const keys: string[] = [`${dia}`, `${dia}-${jornada}`];
  
  if (jornada === '24H' || jornada === 'normal' || 
      jornada === 'descanso_remunerado' || 
      jornada === 'descanso_no_remunerado' || 
      jornada === 'vacacion') {
    keys.push(`${dia}-AM`, `${dia}-PM`, `${dia}-24H`, `${dia}-normal`);
  } else if (jornada === 'AM') {
    keys.push(`${dia}-AM`);
  } else if (jornada === 'PM') {
    keys.push(`${dia}-PM`);
  }
  return keys;
};

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
  const [searchTerm, setSearchTerm] = useState('');
  const [displayCount, setDisplayCount] = useState(40);
  const [showDestSelector, setShowDestSelector] = useState(false);
  const fetchDetails = useProgramacionStore(s => s.fetchProgramacionDetalles);

  // EFECTO TÁCTICO: Asegurar hidratación de datos para ambos tableros
  React.useEffect(() => {
    if (freshCProg?.id && !freshCProg.isDetailLoaded) fetchDetails(freshCProg.id);
    if (currentProg?.id && !currentProg.isDetailLoaded) fetchDetails(currentProg.id);
  }, [freshCProg?.id, currentProg?.id, fetchDetails]);

  // IDs del personal asignado en el tablero ORIGEN
  const originStaffVids = useMemo(
    () => (currentProg?.personal || []).map(p => p.vigilanteId),
    [currentProg]
  );

  // ?? MAPA DE ASIGNACIONES ORIGEN (tablero A) ?????????????????????????????
  // FIX CR?TICO: ahora indexa TODOS los tipos de jornada (normal, AM, PM, 24H, descanso, etc.)
  const originAsigsMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (currentProg?.asignaciones || []).forEach(a => {
      if (!a.vigilanteId || a.jornada === 'sin_asignar') return;
      const vid = translateToUuid(a.vigilanteId) || a.vigilanteId;
      if (!vid) return;
      if (!m.has(vid)) m.set(vid, new Set());
      const jornada = (a.jornada || (a as any).turno || 'normal') as string;
      resolveJornadaKeys(a.dia, jornada).forEach(k => m.get(vid)!.add(k));
    });
    return m;
  }, [currentProg]);

  // ?? MAPA DE ASIGNACIONES DESTINO (tablero B) ?????????????????????????????
  // FIX CR?TICO: mismo patr?n de indexaci?n completa
  const destAsigsMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (freshCProg?.asignaciones || []).forEach(a => {
      if (!a.vigilanteId || a.jornada === 'sin_asignar') return;
      const vid = translateToUuid(a.vigilanteId) || a.vigilanteId;
      if (!vid) return;
      if (!m.has(vid)) m.set(vid, new Set());
      const jornada = (a.jornada || (a as any).turno || 'normal') as string;
      resolveJornadaKeys(a.dia, jornada).forEach(k => m.get(vid)!.add(k));
    });
    return m;
  }, [freshCProg]);

  // IDs de vigilantes que tienen turnos en el tablero B
  const destBusyVids = useMemo(() => {
    const s = new Set<string>();
    (freshCProg?.asignaciones || []).forEach(a => {
      if (a.vigilanteId && a.jornada !== 'sin_asignar') {
        const vid = translateToUuid(a.vigilanteId);
        if (vid) s.add(vid);
      }
    });
    return s;
  }, [freshCProg]);

  // ?? VIGILANTES OCUPADOS EN OTROS PUESTOS (mismo mes, excluyendo puesto actual) ?
  const localBusyVids = useMemo(() => {
    const busySet = new Set<string>();
    const anio = currentProg?.anio;
    const mes = currentProg?.mes;
    const currentPuestoId = currentProg?.puestoId;
    const destPuestoId = freshCProg?.puestoId;
    if (!anio || mes === undefined) return busySet;

    allProgramaciones.forEach(p => {
      if (p.anio !== anio || p.mes !== mes) return;
      if (p.puestoId === currentPuestoId || p.puestoId === destPuestoId) return;
      (p.asignaciones || []).forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar' && a.jornada !== null) {
          const uuid = translateToUuid(a.vigilanteId);
          if (uuid) busySet.add(uuid);
          else busySet.add(a.vigilanteId);
        }
      });
    });
    return busySet;
  }, [allProgramaciones, currentProg, freshCProg]);

  const blockedCount = useMemo(() => {
    if (!hideBusyGuards) return 0;
    return Array.from(localBusyVids).filter(
      vid => !originStaffVids.some(id => translateToUuid(id) === vid || id === vid)
    ).length;
  }, [localBusyVids, originStaffVids, hideBusyGuards]);

  // Puestos disponibles como destino (Tablero B)
  const availableDestPuestos = useMemo(() => {
    return allPuestos.filter(p => {
      const pid = p.dbId || p.id;
      const currentId = currentProg?.puestoId;
      return pid !== currentId && p.id !== currentId;
    });
  }, [allPuestos, currentProg]);

  // Lista de IDs ?nicos a mostrar en el panel
  const uniqueVids = useMemo(() => {
    const base = new Set(
      originStaffVids
        .map(id => translateToUuid(id) || id)
        .filter(Boolean) as string[]
    );
    if (showEntireStaff || searchTerm) {
      const q = searchTerm.toLowerCase();
      let added = 0;
      for (const v of vigilantes) {
        if (added > 200) break;
        const vid = v.dbId || v.id;
        if (!q || v.nombre?.toLowerCase().includes(q) || v.id?.toLowerCase().includes(q)) {
          base.add(vid);
          added++;
        }
      }
    }
    return Array.from(base);
  }, [originStaffVids, showEntireStaff, searchTerm, vigilantes]);

  // ?? FIX FILTRO NO-REPETIR ?????????????????????????????????????????????????
  // Ahora distingue correctamente entre:
  // 1. Staff del puesto actual ? siempre visible
  // 2. Vigilante solo en puesto actual ? visible
  // 3. Vigilante con asignaciones en OTROS puestos este mes ? ocultar si hideBusyGuards
  const sortedVids = useMemo(() => {
    let result = [...uniqueVids];

    if (hideBusyGuards) {
      const destStaffVids = (freshCProg?.personal || []).map(p => translateToUuid(p.vigilanteId) || p.vigilanteId);
      
      result = result.filter(vid => {
        // Staff del puesto actual o destino: siempre visible para coordinaci?n
        const isStaff = originStaffVids.some(id => translateToUuid(id) === vid || id === vid) ||
                        destStaffVids.some(id => translateToUuid(id) === vid || id === vid);
        if (isStaff) return true;

        // Ocultar si est? ocupado en OTROS puestos (fuera de A y B)
        return !localBusyVids.has(vid);
      });
    }

    return result
      .sort((a, b) => {
        const aIn = originStaffVids.some(id => translateToUuid(id) === a || id === a);
        const bIn = originStaffVids.some(id => translateToUuid(id) === b || id === b);
        if (aIn && !bIn) return -1;
        if (!aIn && bIn) return 1;
        return 0;
      })
      .slice(0, displayCount);
  }, [uniqueVids, originStaffVids, hideBusyGuards, freshCProg, localBusyVids, displayCount]);

  return (
    <div className="mt-10 bg-[#0f172a]/80 backdrop-blur-xl rounded-[48px] border border-white/10 overflow-hidden shadow-[0_32px_128px_rgba(0,0,0,0.6)] relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
      
      {/* ?? HEADER T?CTICO PREMIUM ?????????????????????????????????????????? */}
      <div className="px-10 py-8 border-b border-white/5 bg-white/[0.01] flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="size-16 rounded-[24px] bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-400 text-[32px]">hub</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              CENTRO <span className="text-indigo-500 not-italic">DE COORDINACIÓN</span>
            </h3>
            <div className="flex items-center gap-3 mt-1.5">
               <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                 <span className="size-1 bg-emerald-400 rounded-full animate-pulse"></span> Sistema Live
               </span>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {currentProg
                  ? `COMPARANDO CON: ${allPuestos.find(p => p.dbId === currentProg.puestoId || p.id === currentProg.puestoId)?.nombre || 'Puesto A'}`
                  : 'MODO DISPONIBILIDAD GLOBAL'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* SELECTOR TABLERO B XXL */}
          <div className="relative">
            <button
              onClick={() => setShowDestSelector(!showDestSelector)}
              className={`h-14 px-8 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-4 ${
                freshCProg
                  ? 'bg-cyan-600 text-white shadow-[0_0_30px_rgba(8,145,178,0.4)]'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">compare_arrows</span>
              {freshCProg
                ? (allPuestos.find(p => p.dbId === freshCProg.puestoId || p.id === freshCProg.puestoId)?.nombre?.substring(0, 20) || 'Tablero B')
                : 'Comparar con Tablero B'
              }
            </button>

            {showDestSelector && (
              <div className="absolute top-full right-0 mt-4 w-80 bg-[#0f172a] border border-white/10 rounded-[32px] shadow-[0_24px_64px_rgba(0,0,0,0.8)] z-[200] p-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 mb-4 px-2">
                   <span className="material-symbols-outlined text-indigo-400 text-[18px]">list_alt</span>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Seleccionar Puesto</p>
                </div>
                {freshCProg && (
                  <button
                    onClick={() => { setCompareProgId?.(null); setShowDestSelector(false); }}
                    className="w-full text-left p-3.5 mb-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-[10px] font-black text-rose-400 uppercase flex items-center justify-center gap-2 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span> Quitar comparación
                  </button>
                )}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {availableDestPuestos.map(p => {
                    const pid = p.dbId || p.id;
                    const destProg = allProgramaciones.find(
                      pr => (pr.puestoId === pid || pr.puestoId === p.id) &&
                            pr.anio === currentProg?.anio &&
                            pr.mes === currentProg?.mes
                    );
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (destProg) setCompareProgId?.(destProg.id);
                          else showTacticalToast({ title: 'Sin Programación', message: `${p.nombre} no tiene programaci?n este mes.`, type: 'info' });
                          setShowDestSelector(false);
                        }}
                        className={`w-full text-left p-4 rounded-2xl transition-all border ${
                          freshCProg?.puestoId === pid
                            ? 'bg-cyan-500/20 border-cyan-500/40'
                            : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10'
                        }`}
                      >
                        <p className="text-[12px] font-black text-white uppercase tracking-tight">{p.nombre}</p>
                        <p className="text-[9px] font-bold text-slate-600 mt-1">
                          {destProg ? `${(destProg.asignaciones || []).filter(a => a.vigilanteId).length} Asignaciones` : 'No configurado'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="h-10 w-px bg-white/10 mx-2 hidden xl:block"></div>

          {/* Filtros Premium */}
          <div className="flex bg-black/40 border border-white/10 rounded-2xl p-1.5">
             <button
                onClick={() => setShowEntireStaff(!showEntireStaff)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  showEntireStaff ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{showEntireStaff ? 'groups' : 'group'}</span>
                <span>{showEntireStaff ? 'Staff Total' : 'Staff Puesto'}</span>
              </button>
              <button
                onClick={() => setHideBusyGuards?.(!hideBusyGuards)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  hideBusyGuards ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{hideBusyGuards ? 'security' : 'security_update_warning'}</span>
                <span>No Repetir</span>
              </button>
          </div>
          </div>
        </div>

        {/* SUMMARY OF CONFLICTS (Step 4) */}
        {freshCProg && (
          <div className="flex bg-[#0f172a]/60 backdrop-blur-md border border-indigo-500/20 rounded-2xl px-6 py-3 ml-10">
             <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                   <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      {(() => {
                        let disp = 0;
                        daysArr.forEach(d => {
                          const needs = currentProg?.asignaciones.some(a => a.dia === d && (a.rol === 'titular_a' || a.rol === 'titular_b') && (!a.vigilanteId || a.jornada === 'sin_asignar'));
                          if (!needs) return;
                          const occupiesB = compareVigilanteId ? destAsigsMap.get(compareVigilanteId)?.has(`${d}`) : false;
                          if (!occupiesB) disp++;
                        });
                        return `${disp} días disponibles`;
                      })()}
                   </span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2">
                   <span className="size-2 rounded-full bg-rose-500"></span>
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      {(() => {
                        let conf = 0;
                        daysArr.forEach(d => {
                          const needs = currentProg?.asignaciones.some(a => a.dia === d && (a.rol === 'titular_a' || a.rol === 'titular_b') && (!a.vigilanteId || a.jornada === 'sin_asignar'));
                          if (!needs) return;
                          const occupiesB = compareVigilanteId ? (destAsigsMap.get(compareVigilanteId)?.has(`${d}`) || destAsigsMap.get(compareVigilanteId)?.has(`${d}-AM`) || destAsigsMap.get(compareVigilanteId)?.has(`${d}-PM`)) : false;
                          if (occupiesB) conf++;
                        });
                        return `${conf} conflictos encontrados`;
                      })()}
                   </span>
                </div>
             </div>
          </div>
        )}

      {/* ?? GRILLA T?CTICA ??????????????????????????????????????????????????? */}
      <div className="p-10">
        <div className="overflow-x-auto custom-scrollbar-h pb-4">
          <div className="min-w-max space-y-3">
            
            {/* ?? RENDER D?AS CABECERA XXL ??????????????????????????????????? */}
            <div className="flex gap-2 mb-6 ml-[240px]">
               {daysArr.map(d => (
                 <div key={d} className="size-12 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[8px] font-black text-slate-600 uppercase">Día</span>
                    <span className="text-[18px] font-black text-white leading-none">{d}</span>
                 </div>
               ))}
            </div>

            {/* ?? VACANTES EN B (NE?N PULSE) ??????????????????????????????? */}
            {freshCProg && (
              <div className="mb-10 space-y-2 pt-6 border-t border-white/5 bg-cyan-400/[0.02] p-4 rounded-[32px]">
                <div className="flex items-center gap-4 px-2 mb-4">
                  <span className="flex size-10 rounded-full bg-cyan-500/20 items-center justify-center">
                    <span className="material-symbols-outlined text-cyan-400 text-[24px] animate-pulse">new_releases</span>
                  </span>
                  <div>
                    <span className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.3em]">Puestos por Cubrir (Tablero B)</span>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Asigna personal directamente a los huecos vac?os</p>
                  </div>
                </div>
                
                {(freshCProg.personal || []).map((per, idx) => {
                  const rolLabel = getRolPdfLabel(per.rol);
                  return (
                    <div key={`vacante-${per.rol}-${idx}`} className="flex gap-2 items-center">
                      <div className="sticky left-0 z-20 w-[240px] text-left px-5 py-4 rounded-2xl bg-[#0f172a] border border-white/10 flex items-center gap-4 shrink-0 shadow-xl">
                        <div className="size-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-[11px] font-black text-cyan-400">
                          {rolLabel[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">{rolLabel}</p>
                          <p className="text-[8px] font-black text-cyan-500/60 uppercase">
                            {per.turnoId === 'PM' ? 'Nocturno' : per.turnoId === '24H' ? '24 Horas' : 'Diurno'}
                          </p>
                        </div>
                      </div>

                      {daysArr.map(d => {
                        const asigB = freshCProg.asignaciones.find(a => a.dia === d && a.rol === per.rol);
                        const isVacant = !asigB || !asigB.vigilanteId || asigB.jornada === 'sin_asignar';
                        
                        // Resolución robusta del vigilante: primero por UUID en vMap, luego por ID legible
                        const rawVid = asigB?.vigilanteId;
                        const assignedVig = rawVid
                          ? (vMap.get(rawVid) || vMap.get(translateToUuid(rawVid) || '') || vigilantes.find(v => v.id === rawVid || v.dbId === rawVid))
                          : null;

                        // Detectar conflicto: ¿el vigilante seleccionado (compareVigilanteId) ya está ocupado este día en OTRO puesto?
                        const selectedBusy = compareVigilanteId
                          ? (destAsigsMap.get(compareVigilanteId)?.has(`${d}`) ||
                             destAsigsMap.get(compareVigilanteId)?.has(`${d}-AM`) ||
                             destAsigsMap.get(compareVigilanteId)?.has(`${d}-PM`) ||
                             originAsigsMap.get(compareVigilanteId)?.has(`${d}`) ||
                             localBusyVids.has(compareVigilanteId))
                          : false;

                        // Color de celda
                        let cellClass = '';
                        let cellContent: React.ReactNode;

                        if (isVacant) {
                          if (compareVigilanteId && selectedBusy) {
                            // Seleccionado pero conflicto
                            cellClass = 'bg-rose-900/40 border-2 border-rose-500/60 shadow-[0_0_16px_rgba(239,68,68,0.3)] cursor-not-allowed';
                            cellContent = <span className="material-symbols-outlined text-rose-400 text-[18px]">block</span>;
                          } else if (compareVigilanteId && !selectedBusy) {
                            // Seleccionado y disponible — pulso verde
                            cellClass = 'bg-emerald-500/20 border-2 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-110 cursor-pointer animate-pulse';
                            cellContent = <span className="material-symbols-outlined text-emerald-400 text-[18px]">add_task</span>;
                          } else {
                            // Vacante normal sin selección
                            cellClass = 'bg-cyan-500/10 border-2 border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:scale-110 hover:bg-cyan-500/20 cursor-pointer';
                            cellContent = <span className="material-symbols-outlined text-cyan-400 text-[18px]">add_task</span>;
                          }
                        } else {
                          // Celda ocupada — mostrar inicial del nombre real
                          const initial = assignedVig?.nombre?.[0]?.toUpperCase() || '✓';
                          const turnoColor = asigB?.turno === 'PM' ? '#a78bfa' : asigB?.turno === '24H' ? '#34d399' : '#60a5fa';
                          cellClass = 'bg-slate-800/40 border border-white/20 hover:border-indigo-400/50 cursor-pointer';
                          cellContent = (
                            <span className="text-[12px] font-black" style={{ color: turnoColor }}
                              title={assignedVig?.nombre || rawVid || '?'}>
                              {initial}
                            </span>
                          );
                        }

                        return (
                          <button
                            key={d}
                            onClick={() => {
                              if (!freshCProg) return;
                              onOpenEdit({
                                asig: asigB || { dia: d, rol: per.rol, turno: per.turnoId || 'AM', jornada: 'sin_asignar' },
                                progId: freshCProg.id,
                                preSelectVigilanteId: compareVigilanteId || ''
                              });
                            }}
                            className={`size-12 rounded-xl flex items-center justify-center transition-all ${cellClass}`}
                            title={isVacant
                              ? (compareVigilanteId && selectedBusy ? 'Conflicto: vigilante ya asignado este día' : 'Vacante — clic para asignar')
                              : (assignedVig?.nombre || 'Asignado')}
                          >
                            {cellContent}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ?? GRILLA DE VIGILANTES XXL ?????????????????????????????????? */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-2 mb-4">
                 <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Personal Disponible</span>
                 <div className="h-px flex-1 bg-white/5"></div>
              </div>

              {sortedVids.map(vid => {
                const vig = vMap.get(vid);
                const isSelected = compareVigilanteId === vid;
                const asigsVigA = originAsigsMap.get(vid);
                const asigsVigB = destAsigsMap.get(vid);
                const hasAnyOccupancyA = !!asigsVigA && asigsVigA.size > 0;
                const hasAnyOccupancyB = !!asigsVigB && asigsVigB.size > 0;

                return (
                  <div key={vid} className={`flex gap-2 items-center transition-all group ${isSelected ? 'scale-[1.01]' : ''}`}>
                    <button
                      onClick={() => setCompareVigilanteId(isSelected ? null : vid)}
                      className={`sticky left-0 z-20 w-[240px] text-left px-5 py-4 rounded-2xl border flex items-center gap-4 shrink-0 transition-all shadow-xl ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-400 shadow-indigo-600/30'
                          : 'bg-slate-800/80 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className={`size-10 rounded-xl flex items-center justify-center text-[12px] font-black text-white shrink-0 shadow-inner ${
                        hasAnyOccupancyA ? 'bg-rose-600' : hasAnyOccupancyB ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}>
                        {vig?.nombre?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[12px] font-black truncate uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>{vig?.nombre || vid}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {hasAnyOccupancyA ? 'En Origen' : hasAnyOccupancyB ? 'En Destino' : 'Disponible'}
                        </p>
                      </div>
                    </button>

                    {daysArr.map(d => {
                      const asigsVigB = destAsigsMap.get(vid);
                      
                      // LÓGICA REQUERIDA POR EL USUARIO:
                      // Tablero A = currentProg (el puesto que estamos editando)
                      // Tablero B = freshCProg (el puesto de origen/comparación)

                      // Paso 1: ¿Se necesita un relevante en el Tablero A para este día?
                      // Se necesita si hay una VACANTE (mismo día, a.vigilanteId === null) 
                      // en roles Titular A o Titular B.
                      const needsRelevanteInA = currentProg?.asignaciones.some(a => 
                        a.dia === d && 
                        (a.rol === 'titular_a' || a.rol === 'titular_b') && 
                        (!a.vigilanteId || a.jornada === 'sin_asignar')
                      );

                      // Paso 2: ¿El vigilante actual está ocupado en el Tablero B este día?
                      const isOccupiedInB = asigsVigB?.has(`${d}-AM`) || asigsVigB?.has(`${d}-PM`) || asigsVigB?.has(`${d}-24H`) || asigsVigB?.has(`${d}`);

                      // Paso 3: Determinar estado
                      // - NO_APLICA (Gris): No se necesita relevante ese día en el Tablero A
                      // - CONFLICTO (Rojo): Se necesita relevante en A, pero el vigilante está ocupado en B
                      // - DISPONIBLE (Verde): Se necesita relevante en A y el vigilante está libre en B

                      let state: 'NO_APLICA' | 'CONFLICTO' | 'DISPONIBLE' = 'NO_APLICA';
                      if (needsRelevanteInA) {
                        state = isOccupiedInB ? 'CONFLICTO' : 'DISPONIBLE';
                      }

                      let bg = 'rgba(255,255,255,0.02)';
                      let border = 'rgba(255,255,255,0.06)';
                      let cellIcon: string | null = null;
                      let cellText: string | null = null;
                      let cellTextColor = '#fff';
                      let tooltip = '';

                      if (state === 'NO_APLICA') {
                        bg = 'rgba(15,23,42,0.4)';
                        border = 'rgba(255,255,255,0.05)';
                        cellText = '·';
                        cellTextColor = 'rgba(255,255,255,0.1)';
                        tooltip = 'No se requiere apoyo este día';
                      } else if (state === 'CONFLICTO') {
                        bg = 'linear-gradient(135deg, rgba(159,18,57,0.4), rgba(76,5,25,0.6))';
                        border = 'rgba(225,29,72,0.5)';
                        cellText = '✕';
                        cellTextColor = '#fda4af';
                        tooltip = `Conflicto: Asignado en ${allPuestos.find(p => p.dbId === freshCProg?.puestoId || p.id === freshCProg?.puestoId)?.nombre || 'Tablero B'}`;
                      } else if (state === 'DISPONIBLE') {
                        bg = 'linear-gradient(135deg, rgba(4,120,87,0.4), rgba(6,78,59,0.6))';
                        border = 'rgba(16,185,129,0.5)';
                        cellIcon = 'check_circle';
                        cellTextColor = '#6ee7b7';
                        tooltip = 'Disponible para cubrir vacante';
                      }

                      // MODO SELECCIONADO: Resaltar más fuerte
                      if (isSelected) {
                        if (state === 'CONFLICTO') {
                          bg = 'rgba(225,29,72,0.6)';
                          border = 'rgba(225,29,72,0.9)';
                        } else if (state === 'DISPONIBLE') {
                          bg = 'rgba(16,185,129,0.6)';
                          border = 'rgba(16,185,129,0.9)';
                        }
                      }

                      return (
                        <button
                          key={d}
                          onClick={() => {
                            if (state !== 'DISPONIBLE' || !isSelected || !vid || !currentProg) return;
                            // Buscar la vacante en el Tablero A para este día
                            const target = currentProg.asignaciones.find(a => 
                              a.dia === d && 
                              (a.rol === 'titular_a' || a.rol === 'titular_b') && 
                              (!a.vigilanteId || a.jornada === 'sin_asignar')
                            );
                            if (target) onOpenEdit({ asig: target, progId: currentProg.id, preSelectVigilanteId: vid });
                          }}
                          disabled={state === 'NO_APLICA' || (state === 'CONFLICTO' && !isSelected)}
                          title={tooltip}
                          className={`size-12 rounded-xl flex items-center justify-center transition-all duration-200 border shrink-0 overflow-hidden ${
                            state === 'DISPONIBLE' && isSelected ? 'hover:scale-110 hover:shadow-lg cursor-pointer' : 
                            state === 'CONFLICTO' ? 'cursor-help' : 'cursor-default'
                          }`}
                          style={{ background: bg, borderColor: border, boxShadow: isSelected && state === 'DISPONIBLE' ? '0 0 15px rgba(16,185,129,0.4)' : 'none' }}
                        >
                          {cellIcon ? (
                            <span className="material-symbols-outlined text-[20px]" style={{ color: cellTextColor }}>
                              {cellIcon}
                            </span>
                          ) : (
                            <span className="text-[14px] font-black select-none" style={{ color: cellTextColor }}>
                              {cellText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {uniqueVids.length > displayCount && (
          <div className="mt-8 px-2">
            <button
              onClick={() => setDisplayCount(c => c + 100)}
              className="w-full py-6 text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] hover:bg-white/5 rounded-[32px] border border-dashed border-white/10 transition-all hover:border-indigo-500/30 group bg-black/20"
            >
              <span className="flex items-center justify-center gap-3">
                 <span className="material-symbols-outlined text-[20px] group-hover:rotate-180 transition-transform duration-500">sync</span>
                 Cargar m?s personal T?ctico ({uniqueVids.length - displayCount} restantes)
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PANEL MENSUAL PUESTO ──────────────────────────────────────────────────────
// Overlay completo que muestra la cobertura individual de un puesto por mes.
// Props: puestoId, puestoNombre, anio, mes, onClose
interface PanelMensualPuestoProps {
  puestoId: string;
  puestoNombre: string;
  anio: number;
  mes: number;
  onClose: () => void;
  conflictDetail?: string;
  syncStatus?: 'synced' | 'pending' | 'error';
}

export const PuestoMensualOverlay = ({ puestoId, puestoNombre, anio, mes, onClose, syncStatus = 'synced' }: PanelMensualPuestoProps) => {
  const vMap = useVigilanteStore(s => s.vigilanteMap);
  const allProgramaciones = useProgramacionStore(s => s.programaciones);
  const allPuestos = usePuestoStore(s => s.puestos);
  const fetchDetails = useProgramacionStore(s => s.fetchProgramacionDetalles);

  const prog = allProgramaciones.find(p => p.puestoId === puestoId && p.anio === anio && p.mes === mes);

  // EFECTO TÁCTICO: Cargar detalles si no están presentes
  React.useEffect(() => {
    if (prog?.id && !prog.isDetailLoaded) fetchDetails(prog.id);
  }, [prog?.id, fetchDetails]);
  const puesto = allPuestos.find(p => p.dbId === puestoId || p.id === puestoId);

  const daysInMonth = new Date(anio, mes + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="w-full max-w-[98vw] h-[95vh] bg-[#020617]/90 rounded-[48px] border border-white/10 shadow-[0_32px_128px_rgba(0,0,0,1)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-400 relative">
        
        {/* Decorative background glow */}
        <div className="absolute -top-24 -left-24 size-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* ── HEADER OPERATIVO ── */}
        <div className="relative px-12 py-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.02] backdrop-blur-md">
         {/* Sync state badge */}
      {(syncStatus === 'pending' || prog?.syncStatus === 'pending') && (
        <div className="absolute top-1 right-1 z-[60] flex items-center justify-center pointer-events-none">
           <div className="size-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
        </div>
      )}

      {(syncStatus === 'error' || prog?.syncStatus === 'error') && (
        <div className="absolute top-1 right-1 size-3 bg-rose-600 rounded-full z-20 flex items-center justify-center shadow-[0_0_8px_rgba(225,29,72,0.7)] animate-pulse">
          <span className="text-white text-[7px] font-black">!</span>
        </div>
      )}
          <div className="flex items-center gap-8">
            <div className="size-16 rounded-[28px] bg-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.4)]">
              <span className="material-symbols-outlined text-white text-[32px]">location_on</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-[0.3em]">COBERTURA MENSUAL</span>
                <span className="px-3 py-1 bg-white/5 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-[0.3em] font-mono">{anio} · {MESES[mes].toUpperCase()}</span>
              </div>
              <h2 className="text-[32px] font-black text-white uppercase italic tracking-tighter leading-none">{puestoNombre}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-16 rounded-[24px] bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all active:scale-95 group"
          >
            <span className="material-symbols-outlined text-[32px] group-hover:rotate-90 transition-transform duration-300">close</span>
          </button>
        </div>

        {/* ── VIGILANTES ASIGNADOS (Quick access info) ── */}
        {prog && (
          <div className="px-12 py-5 border-b border-white/5 flex items-center gap-6 shrink-0 bg-black/20">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mr-2">Estructura Ops:</span>
            {(prog.personal || []).map((per: any, i: number) => {
              const vid = per.vigilanteId;
              const v = vid ? vMap.get(vid) : null;
              const rolLabels: Record<string, string> = { titular_a: 'TIT. A', titular_b: 'TIT. B', relevante: 'REL.' };
              const label = rolLabels[per.rol] || per.rol?.toUpperCase();
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
                  <div className={`size-9 rounded-xl flex items-center justify-center text-[12px] font-black text-white shadow-lg ${vid ? 'bg-indigo-600' : 'bg-rose-600/40'}`}>
                    {v?.nombre?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                    <p className="text-[12px] font-black text-white uppercase truncate max-w-[150px] tracking-tight">{v?.nombre || 'VACANTE'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CUADRÍCULA DE DÍAS (TACTICAL GRID) ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-black/40 relative">
          {!prog ? (
            <div className="flex flex-col items-center justify-center h-full opacity-20">
              <span className="material-symbols-outlined text-[80px] mb-6 animate-pulse">event_busy</span>
              <p className="text-[18px] font-black uppercase tracking-[0.5em]">Sin programación detectada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-6">
              {days.map(d => {
                const asigs = (prog.asignaciones || []).filter((a: any) => a.dia === d);
                const date = new Date(anio, mes, d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const dayName = date.toLocaleDateString('es', { weekday: 'long' }).toUpperCase();
                
                // Determinar el color predominante del día
                const activeAsig = asigs.find((a: any) => a.vigilanteId && a.jornada !== 'sin_asignar');
                const dayColor = activeAsig 
                  ? (activeAsig.jornada === 'PM' ? 'rgba(139, 92, 246, 0.5)' : activeAsig.jornada === '24H' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(59, 130, 246, 0.5)')
                  : 'rgba(244, 63, 94, 0.3)';

                return (
                  <div
                    key={d}
                    className={`group/day p-5 rounded-[32px] border transition-all duration-300 relative overflow-hidden flex flex-col min-h-[160px] ${
                      isWeekend
                        ? 'bg-indigo-950/20 border-indigo-500/20 shadow-[0_8px_32px_rgba(79,70,229,0.1)]'
                        : 'bg-[#0f172a]/80 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Indicador lateral de estado */}
                    <div className="absolute top-0 left-0 w-1 h-full transition-all group-hover/day:w-2" style={{ backgroundColor: dayColor }}></div>
                    
                    <div className="flex justify-between items-start mb-5 h-10">
                      <div>
                        <span className={`text-[32px] font-black italic leading-none block ${isWeekend ? 'text-indigo-400' : 'text-white'}`}>{d}</span>
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] block mt-1 ${isWeekend ? 'text-indigo-500/80' : 'text-slate-600'}`}>
                           {dayName.substring(0, 3)}
                        </span>
                      </div>
                      {isWeekend && (
                        <span className="size-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                           <span className="material-symbols-outlined text-indigo-400 text-[18px]">event</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5 flex-1 mt-2">
                      {asigs.length > 0 ? asigs.map((a: any, i: number) => {
                        const v = a.vigilanteId ? vMap.get(a.vigilanteId) : null;
                        const isVacant = !a.vigilanteId || a.jornada === 'sin_asignar';
                        const isNight = a.jornada === 'PM';
                        
                        return (
                          <div 
                            key={i} 
                            className={`flex items-center gap-3 px-3 py-2 rounded-2xl border transition-all ${
                              isVacant 
                                ? 'bg-rose-500/5 border-rose-500/20 grayscale opacity-40 hover:opacity-100 hover:grayscale-0' 
                                : 'bg-black/40 border-white/5 group-hover/day:border-white/10 shadow-inner'
                            }`}
                          >
                            <div className={`size-5 rounded-lg flex items-center justify-center text-[8px] font-black shrink-0 ${isVacant ? 'bg-rose-500/20 text-rose-400' : isNight ? 'bg-violet-500/20 text-violet-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {a.rol === 'titular_a' ? 'A' : a.rol === 'titular_b' ? 'B' : 'R'}
                            </div>
                            <p className={`text-[11px] font-black truncate uppercase tracking-tight ${isVacant ? 'text-rose-500/50 italic' : 'text-slate-200'}`}>
                              {v?.nombre?.split(' ')[0] || (isVacant ? 'VACANTE' : '---')}
                            </p>
                          </div>
                        );
                      }) : (
                        <div className="flex-1 flex items-center justify-center py-4 border-2 border-dashed border-white/5 rounded-2xl opacity-10">
                          <span className="material-symbols-outlined text-[20px]">block</span>
                        </div>
                      )}
                    </div>

                    {/* Progress indicator bottom */}
                    <div className="mt-4 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out`}
                        style={{ 
                          width: activeAsig ? '100%' : '15%',
                          backgroundColor: dayColor,
                          boxShadow: activeAsig ? `0 0 10px ${dayColor}` : 'none'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FOOTER ESTADÍSTICO ── */}
        <div className="px-12 py-7 border-t border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3 group">
              <div className="size-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)] group-hover:scale-125 transition-transform"/>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Jornada Día</span>
            </div>
            <div className="flex items-center gap-3 group">
              <div className="size-3 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.6)] group-hover:scale-125 transition-transform"/>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Jornada Noche</span>
            </div>
            <div className="flex items-center gap-3 group">
              <div className="size-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] group-hover:scale-125 transition-transform"/>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Jornada 24H</span>
            </div>
            <div className="flex items-center gap-3 group">
              <div className="size-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)] opacity-50"/>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Vacante / Alerta</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-px h-8 bg-white/5 mx-2" />
             <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em] italic">CORAZA TACTICAL COMMAND</p>
          </div>
        </div>

      </div>
    </div>
  );
};
