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
    <div className="mt-8 bg-slate-900 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">
            Panel de <span className="text-indigo-400">Coordinación Táctica</span>
          </h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {freshCProg
              ? `Comparando con: ${allPuestos.find(p => p.dbId === freshCProg.puestoId || p.id === freshCProg.puestoId)?.nombre || 'Puesto Destino'}`
              : 'Selecciona un Tablero Destino para comparar'
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* SELECTOR TABLERO B */}
          <div className="relative">
            <button
              onClick={() => setShowDestSelector(!showDestSelector)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                freshCProg
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
              {freshCProg
                ? (allPuestos.find(p => p.dbId === freshCProg.puestoId || p.id === freshCProg.puestoId)?.nombre?.substring(0, 20) || 'Tablero B')
                : 'Tablero B'
              }
            </button>

            {showDestSelector && (
              <div className="absolute top-full right-0 mt-3 w-72 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[100] p-3 animate-in zoom-in-95 duration-200">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">
                  Seleccionar Puesto Destino
                </p>
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
                    const destProg = allProgramaciones.find(
                      pr => (pr.puestoId === pid || pr.puestoId === p.id) &&
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
                            showTacticalToast({ title: 'Sin Programación', message: `${p.nombre} no tiene programación este mes.`, type: 'info' });
                          }
                          setShowDestSelector(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group ${
                          freshCProg?.puestoId === pid
                            ? 'bg-cyan-500/20 border border-cyan-500/30'
                            : 'bg-white/5 hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30'
                        }`}
                      >
                        <div>
                          <p className="text-[11px] font-black text-white uppercase leading-tight">{p.nombre}</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">
                            {destProg
                              ? `${(destProg.asignaciones || []).filter(a => a.vigilanteId).length} asignaciones`
                              : 'Sin programación este mes'
                            }
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-[14px] text-white/30 group-hover:text-indigo-400 transition-colors">arrow_forward</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Buscador */}
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

          {/* Ver todo el personal */}
          <button
            onClick={() => setShowEntireStaff(!showEntireStaff)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
              showEntireStaff ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {showEntireStaff ? 'visibility' : 'visibility_off'}
            </span>
            {showEntireStaff ? 'Staff Extendido ON' : 'Ver Todo el Personal'}
          </button>

          {/* No Repetir */}
          <div className="relative group">
            <button
              onClick={() => setHideBusyGuards?.(!hideBusyGuards)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                hideBusyGuards
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {hideBusyGuards ? 'lock' : 'lock_open'}
              </span>
              {hideBusyGuards
                ? `No Repetir ON${blockedCount > 0 ? ` · ${blockedCount} filtrados` : ''}`
                : 'Permitir Repeticiones'
              }
            </button>
            <div className="absolute bottom-full right-0 mb-2 w-60 p-3 bg-slate-800 border border-amber-500/30 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none">
              <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Control No-Repetición</p>
              <p className="text-[8px] font-bold text-slate-300 leading-relaxed">
                {hideBusyGuards
                  ? 'Oculta vigilantes ya programados en otros puestos este mes.'
                  : 'Activa para evitar asignar el mismo vigilante en dos puestos distintos.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── LEYENDA ─────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-4">
        <div className="flex items-center gap-5 px-5 py-3 bg-white/[0.03] rounded-2xl border border-white/5 flex-wrap">
          <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-red-500"/><span className="text-[9px] font-black text-red-400/90 uppercase">Ocupado Tablero A (Este Puesto)</span></div>
          {freshCProg && <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-yellow-400"/><span className="text-[9px] font-black text-yellow-400/90 uppercase">Ocupado Tablero B (Destino)</span></div>}
          <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-emerald-500"/><span className="text-[9px] font-black text-emerald-400/90 uppercase">Libre Ambos ✓</span></div>
          <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-blue-400"/><span className="text-[9px] font-black text-blue-400/90 uppercase">Solo AM</span></div>
          <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-purple-500"/><span className="text-[9px] font-black text-purple-400/90 uppercase">Solo PM</span></div>
          {!freshCProg && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-cyan-400 animate-pulse">compare_arrows</span>
              <span className="text-[9px] font-black text-cyan-400/80 uppercase">Haz clic en un nombre para ver sus días</span>
            </div>
          )}
        </div>
      </div>

      {/* ── GRILLA ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto p-6 scrollbar-hide">
        <div className="min-w-max">
          <div className="space-y-1.5 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {/* ── SECCIÓN: HUECOS EN TABLERO B (Solicitud Usuario: Iluminar todo lo no programado en B) ── */}
            {freshCProg && (
              <div className="mb-6 space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 px-3 mb-2">
                  <span className="material-symbols-outlined text-cyan-400 text-[16px] animate-pulse">emergency</span>
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Vacantes en Tablero Destino (Puestos por Cubrir)</span>
                </div>
                
                {(freshCProg.personal || []).map((per, idx) => {
                  const rolLabel = getRolPdfLabel(per.rol);
                  const isFilledByModel = !!per.vigilanteId;

                  return (
                    <div key={`vacante-${per.rol}-${idx}`} className="flex gap-1 items-center bg-white/[0.02] rounded-xl py-1 border border-white/5">
                      <div className="sticky left-0 z-20 w-44 text-left px-3 py-2 rounded-xl bg-slate-800/80 border border-white/5 flex items-center gap-2 shrink-0">
                        <div className="size-6 rounded bg-slate-700 flex items-center justify-center text-[8px] font-black text-white shrink-0">
                          {rolLabel[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-white truncate uppercase">{rolLabel}</p>
                          <p className="text-[7px] font-bold text-slate-500 uppercase">Espacio de Rol</p>
                        </div>
                      </div>

                      {daysArr.map(d => {
                        const asigB = freshCProg.asignaciones.find(a => a.dia === d && a.rol === per.rol);
                        const isVacant = !asigB || !asigB.vigilanteId || asigB.jornada === 'sin_asignar';

                        return (
                          <div
                            key={d}
                            className={`size-10 rounded-lg flex items-center justify-center transition-all ${
                              isVacant 
                                ? 'bg-cyan-500/20 border-2 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)] animate-pulse' 
                                : 'bg-slate-800/40 border border-white/5 opacity-30'
                            }`}
                          >
                            {isVacant && <span className="material-symbols-outlined text-cyan-400 text-[14px]">add_task</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 px-3 mb-2">
              <span className="material-symbols-outlined text-slate-500 text-[16px]">group</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Disponibilidad de Personal</span>
            </div>

            {sortedVids.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <span className="material-symbols-outlined text-[40px] text-slate-600">group_off</span>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  {hideBusyGuards
                    ? 'Todos los vigilantes disponibles están asignados este mes'
                    : 'No hay personal configurado en este tablero'}
                </p>
                <p className="text-[9px] text-slate-600 max-w-xs">
                  {hideBusyGuards
                    ? 'El filtro "No Repetir" oculta vigilantes ya empleados en otro puesto. Desactívalo para ver todos.'
                    : 'Configura el personal del puesto o activa "Ver Todo el Personal".'}
                </p>
                {hideBusyGuards && (
                  <button
                    onClick={() => setHideBusyGuards?.(false)}
                    className="mt-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-[9px] font-black uppercase transition-all border border-amber-500/30 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[14px]">lock_open</span>
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
              const asigsVigB = destAsigsMap.get(vid);
              const isOriginStaff = originStaffVids.some(id => translateToUuid(id) === vid || id === vid);
              const hasAnyOccupancyA = !!asigsVigA && asigsVigA.size > 0;
              const hasAnyOccupancyB = !!asigsVigB && asigsVigB.size > 0;

              return (
                <div
                  key={vid}
                  className={`flex gap-1 items-center transition-all rounded-xl py-1 relative ${
                    isSelected
                      ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30'
                      : isDimmed
                      ? 'opacity-20'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Nombre / Botón selector */}
                  <button
                    onClick={() => setCompareVigilanteId(isSelected ? null : vid)}
                    className={`sticky left-0 z-20 w-44 text-left px-3 py-2 rounded-xl border flex items-center gap-2 shrink-0 transition-all ${
                      isSelected
                        ? 'bg-indigo-500 border-indigo-400'
                        : 'bg-slate-800 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className={`size-6 rounded flex items-center justify-center text-[10px] font-black text-white shrink-0 ${
                      hasAnyOccupancyA ? 'bg-red-600' : hasAnyOccupancyB ? 'bg-yellow-600' : 'bg-emerald-700'
                    }`}>
                      {vig?.nombre?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white truncate">{vig?.nombre || vid}</p>
                      <p className="text-[7px] font-bold text-white/50 uppercase">
                        {isOriginStaff ? 'Staff Origen' : 'Externo'}
                        {hasAnyOccupancyA && !isSelected && <span className="text-red-400 ml-1">· Asignado A</span>}
                        {hasAnyOccupancyB && !isSelected && <span className="text-yellow-400 ml-1">· En B</span>}
                      </p>
                    </div>
                  </button>

                  {/* ── Celdas de días ─────────────────────────────────────── */}
                  {daysArr.map(d => {
                    const asigsVigA = originAsigsMap.get(vid);
                    const asigsVigB = destAsigsMap.get(vid);

                    const hasAM_A = asigsVigA?.has(`${d}-AM`);
                    const hasPM_A = asigsVigA?.has(`${d}-PM`);
                    const has24_A = asigsVigA?.has(`${d}-24H`);
                    const hasDay_A = asigsVigA?.has(`${d}`);
                    const ocupadoA = hasAM_A || hasPM_A || has24_A || hasDay_A;

                    const hasAM_B = asigsVigB?.has(`${d}-AM`);
                    const hasPM_B = asigsVigB?.has(`${d}-PM`);
                    const has24_B = asigsVigB?.has(`${d}-24H`);
                    const hasDay_B = asigsVigB?.has(`${d}`);
                    const ocupadoB = hasAM_B || hasPM_B || has24_B || hasDay_B;

                    // Ocupado en OTRO puesto (fuera de A y B)
                    const busyKey = `${vid}-${currentProg?.anio}-${currentProg?.mes}`;
                    const globalBusySet = _busyMap?.get(busyKey);
                    const isGlobalBusy = globalBusySet && Array.from(globalBusySet).some(k => {
                      const dayKey = String(k).split('-')[0];
                      return dayKey === String(d) && !asigsVigA?.has(String(k)) && !asigsVigB?.has(String(k));
                    });

                    // ── Colores de celda ──────────────────────────────────
                    let bg = 'rgba(255,255,255,0.03)';
                    let ring = 'rgba(255,255,255,0.06)';

                    if (isSelected) {
                      // Vista detallada al seleccionar un vigilante
                      if (has24_A || (hasAM_A && hasPM_A) || (hasDay_A && !hasAM_A && !hasPM_A && !has24_A)) {
                        // Ocupado todo el día en A
                        bg = 'rgba(239,68,68,0.45)'; ring = 'rgba(239,68,68,0.9)';
                      } else if (hasAM_A && !hasPM_A) {
                        // Solo AM en A
                        bg = 'linear-gradient(135deg, rgba(59,130,246,0.55) 50%, rgba(34,197,94,0.4) 50%)';
                        ring = 'rgba(59,130,246,0.9)';
                      } else if (hasPM_A && !hasAM_A) {
                        // Solo PM en A
                        bg = 'linear-gradient(135deg, rgba(34,197,94,0.4) 50%, rgba(168,85,247,0.55) 50%)';
                        ring = 'rgba(168,85,247,0.9)';
                      } else if (ocupadoB) {
                        // Libre en A, ocupado en B
                        bg = 'rgba(234,179,8,0.35)'; ring = 'rgba(234,179,8,0.7)';
                      } else if (isGlobalBusy) {
                        // Ocupado en otro puesto C, D...
                        bg = 'rgba(100,116,139,0.4)'; ring = 'rgba(100,116,139,0.8)';
                      } else {
                        // Libre en todo el ecosistema
                        bg = 'rgba(34,197,94,0.45)'; ring = 'rgba(34,197,94,0.9)';
                      }
                    } else {
                      // Vista compacta (sin seleccionar): muestra ocupación sutil
                      if (ocupadoA) {
                        bg = 'rgba(239,68,68,0.14)'; ring = 'rgba(239,68,68,0.25)';
                      } else if (ocupadoB) {
                        bg = 'rgba(234,179,8,0.12)'; ring = 'rgba(234,179,8,0.2)';
                      } else if (isGlobalBusy) {
                        bg = 'rgba(148,163,184,0.1)'; ring = 'rgba(148,163,184,0.15)';
                      }
                    }

                    return (
                      <button
                        key={d}
                        onClick={() => {
                          if (!isSelected || !vid) return;
                          if (has24_A || (hasAM_A && hasPM_A) || (hasDay_A && ocupadoA)) {
                            showTacticalToast({ title: 'Sin Disponibilidad', message: 'Vigilante ocupado en este día.', type: 'warning' });
                            return;
                          }
                          if (!freshCProg) {
                            showTacticalToast({ title: 'Sin Tablero Destino', message: 'Selecciona un Puesto Destino (Tablero B) primero.', type: 'info' });
                            return;
                          }
                          // Buscar ranura vacante en Tablero B para este día
                          let targetAsig = freshCProg?.asignaciones.find(a => a.dia === d && (!a.vigilanteId || a.jornada === 'sin_asignar'));
                          
                          // Si no hay vacante, buscar la primera asignación del día (para editar)
                          if (!targetAsig) {
                            targetAsig = freshCProg?.asignaciones.find(a => a.dia === d);
                          }

                          if (targetAsig) {
                            onOpenEdit({ asig: targetAsig, progId: freshCProg!.id, preSelectVigilanteId: vid });
                          } else {
                            showTacticalToast({ title: '⚠️ Sin Ranuras', message: 'No hay turnos configurados en Tablero B para este día.', type: 'error' });
                          }
                        }}
                        className="size-8 rounded-lg flex items-center justify-center transition-all border shrink-0 overflow-hidden"
                        style={{ background: bg, borderColor: ring }}
                        title={`Día ${d}${ocupadoA ? ' — OCUPADO en Origen' : ''}${ocupadoB ? ' — OCUPADO en Destino' : ''}${isGlobalBusy ? ' — OCUPADO en OTRO PUESTO' : ''}`}
                      >
                        {isSelected && !ocupadoA && !ocupadoB && (
                          <span className="material-symbols-outlined text-[12px] text-emerald-400">add_circle</span>
                        )}
                        {isSelected && ocupadoA && !has24_A && !(hasAM_A && hasPM_A) && !hasDay_A && (
                          <span className="text-[7px] font-black text-white/80">{hasAM_A ? 'AM' : 'PM'}</span>
                        )}
                        {isSelected && (has24_A || (hasAM_A && hasPM_A) || (hasDay_A && ocupadoA)) && (
                          <span className="text-[7px] font-black text-white/60">LLENO</span>
                        )}
                        {isSelected && !ocupadoA && ocupadoB && (
                          <div className="size-full flex flex-col items-center justify-center bg-yellow-500/20">
                             <span className="text-[7px] font-black text-yellow-400">IN B</span>
                          </div>
                        )}
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
