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

// ─── Helper: convierte cualquier jornada a claves normalizadas ────────────────
// Garantiza que "normal", "AM", "PM", "24H" y días de descanso se detecten
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

  // IDs del personal asignado en el tablero ORIGEN
  const originStaffVids = useMemo(
    () => (currentProg?.personal || []).map(p => p.vigilanteId),
    [currentProg]
  );

  // ── MAPA DE ASIGNACIONES ORIGEN (tablero A) ─────────────────────────────
  // FIX CRÍTICO: ahora indexa TODOS los tipos de jornada (normal, AM, PM, 24H, descanso, etc.)
  const originAsigsMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    currentProg?.asignaciones.forEach(a => {
      if (!a.vigilanteId || a.jornada === 'sin_asignar') return;
      const vid = translateToUuid(a.vigilanteId) || a.vigilanteId;
      if (!vid) return;
      if (!m.has(vid)) m.set(vid, new Set());
      const jornada = (a.jornada || (a as any).turno || 'normal') as string;
      resolveJornadaKeys(a.dia, jornada).forEach(k => m.get(vid)!.add(k));
    });
    return m;
  }, [currentProg]);

  // ── MAPA DE ASIGNACIONES DESTINO (tablero B) ─────────────────────────────
  // FIX CRÍTICO: mismo patrón de indexación completa
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

  // ── VIGILANTES OCUPADOS EN OTROS PUESTOS (mismo mes, excluyendo puesto actual) ─
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

  // Lista de IDs únicos a mostrar en el panel
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

  // ── FIX FILTRO NO-REPETIR ─────────────────────────────────────────────────
  // Ahora distingue correctamente entre:
  // 1. Staff del puesto actual → siempre visible
  // 2. Vigilante solo en puesto actual → visible
  // 3. Vigilante con asignaciones en OTROS puestos este mes → ocultar si hideBusyGuards
  const sortedVids = useMemo(() => {
    let result = [...uniqueVids];

    if (hideBusyGuards) {
      const destStaffVids = (freshCProg?.personal || []).map(p => translateToUuid(p.vigilanteId) || p.vigilanteId);
      
      result = result.filter(vid => {
        // Staff del puesto actual o destino: siempre visible para coordinación
        const isStaff = originStaffVids.some(id => translateToUuid(id) === vid || id === vid) ||
                        destStaffVids.some(id => translateToUuid(id) === vid || id === vid);
        if (isStaff) return true;

        // Ocultar si está ocupado en OTROS puestos (fuera de A y B)
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
      
      {/* ── HEADER TÁCTICO PREMIUM ────────────────────────────────────────── */}
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
                {freshCProg
                  ? `MODO COMPARATIVA: ${allPuestos.find(p => p.dbId === freshCProg.puestoId || p.id === freshCProg.puestoId)?.nombre || 'Puesto B'}`
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
                          else showTacticalToast({ title: 'Sin Programación', message: `${p.nombre} no tiene programación este mes.`, type: 'info' });
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

      {/* ── GRILLA TÁCTICA ─────────────────────────────────────────────────── */}
      <div className="p-10">
        <div className="overflow-x-auto custom-scrollbar-h pb-4">
          <div className="min-w-max space-y-3">
            
            {/* ── RENDER DÍAS CABECERA XXL ─────────────────────────────────── */}
            <div className="flex gap-2 mb-6 ml-[240px]">
               {daysArr.map(d => (
                 <div key={d} className="size-12 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[8px] font-black text-slate-600 uppercase">Día</span>
                    <span className="text-[18px] font-black text-white leading-none">{d}</span>
                 </div>
               ))}
            </div>

            {/* ── VACANTES EN B (NEÓN PULSE) ─────────────────────────────── */}
            {freshCProg && (
              <div className="mb-10 space-y-2 pt-6 border-t border-white/5 bg-cyan-400/[0.02] p-4 rounded-[32px]">
                <div className="flex items-center gap-4 px-2 mb-4">
                  <span className="flex size-10 rounded-full bg-cyan-500/20 items-center justify-center">
                    <span className="material-symbols-outlined text-cyan-400 text-[24px] animate-pulse">new_releases</span>
                  </span>
                  <div>
                    <span className="text-[12px] font-black text-cyan-400 uppercase tracking-[0.3em]">Puestos por Cubrir (Tablero B)</span>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Asigna personal directamente a los huecos vacíos</p>
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
                          <p className="text-[8px] font-black text-cyan-500/60 uppercase">Vacante Destino</p>
                        </div>
                      </div>

                      {daysArr.map(d => {
                        const asigB = freshCProg.asignaciones.find(a => a.dia === d && a.rol === per.rol);
                        const isVacant = !asigB || !asigB.vigilanteId || asigB.jornada === 'sin_asignar';

                        return (
                          <div
                            key={d}
                            className={`size-12 rounded-xl flex items-center justify-center transition-all ${
                              isVacant 
                                ? 'bg-cyan-500/10 border-2 border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-pulse' 
                                : 'bg-slate-800/20 border border-white/5 opacity-20'
                            }`}
                          >
                            {isVacant && <span className="material-symbols-outlined text-cyan-400 text-[18px]">add_task</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── GRILLA DE VIGILANTES XXL ────────────────────────────────── */}
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
                      const asigsVigA = originAsigsMap.get(vid);
                      const asigsVigB = destAsigsMap.get(vid);
                      const hasAM_A = asigsVigA?.has(`${d}-AM`);
                      const hasPM_A = asigsVigA?.has(`${d}-PM`);
                      const has24_A = asigsVigA?.has(`${d}-24H`);
                      const hasDay_A = asigsVigA?.has(`${d}`);
                      const ocupadoA = hasAM_A || hasPM_A || has24_A || hasDay_A;
                      const ocupadoB = asigsVigB?.has(`${d}-AM`) || asigsVigB?.has(`${d}-PM`) || asigsVigB?.has(`${d}-24H`) || asigsVigB?.has(`${d}`);

                      let bg = 'rgba(255,255,255,0.02)';
                      let border = 'rgba(255,255,255,0.05)';
                      let icon = null;

                      if (isSelected) {
                        if (has24_A || (hasAM_A && hasPM_A) || (hasDay_A && ocupadoA)) {
                          bg = 'rgba(244,63,94,0.3)'; border = 'rgba(244,63,94,0.5)';
                        } else if (hasAM_A || hasPM_A) {
                          bg = 'rgba(79,70,229,0.2)'; border = 'rgba(79,70,229,0.5)';
                        } else if (ocupadoB) {
                          bg = 'rgba(245,158,11,0.2)'; border = 'rgba(245,158,11,0.5)';
                        } else {
                          bg = 'rgba(16,185,129,0.2)'; border = 'rgba(16,185,129,0.5)';
                          icon = 'add_circle';
                        }
                      } else {
                        if (ocupadoA) { bg = 'rgba(244,63,94,0.1)'; border = 'rgba(244,63,94,0.15)'; }
                        else if (ocupadoB) { bg = 'rgba(245,158,11,0.08)'; border = 'rgba(245,158,11,0.15)'; }
                      }

                      return (
                        <button
                          key={d}
                          onClick={() => {
                            if (!isSelected || !vid || ocupadoA || !freshCProg) return;
                            const target = freshCProg.asignaciones.find(a => a.dia === d && (!a.vigilanteId || a.jornada === 'sin_asignar')) || freshCProg.asignaciones.find(a => a.dia === d);
                            if (target) onOpenEdit({ asig: target, progId: freshCProg.id, preSelectVigilanteId: vid });
                          }}
                          className="size-12 rounded-xl flex items-center justify-center transition-all border shrink-0 overflow-hidden"
                          style={{ background: bg, borderColor: border }}
                        >
                          {icon && <span className="material-symbols-outlined text-[20px] text-emerald-400 group-hover:scale-125 transition-transform">{icon}</span>}
                          {isSelected && ocupadoA && <span className="text-[9px] font-black text-rose-400">FULL</span>}
                          {!isSelected && ocupadoA && <div className="size-2 rounded-full bg-rose-500/40"></div>}
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
                 Cargar más personal Táctico ({uniqueVids.length - displayCount} restantes)
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
