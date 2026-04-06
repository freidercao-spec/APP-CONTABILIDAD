import React, { useState, useMemo, useEffect } from "react";
import { usePuestoStore } from "../store/puestoStore";
import { useVigilanteStore } from "../store/vigilanteStore";
import {
  useProgramacionStore,
  type AsignacionDia,
  type TurnoHora,
  type ProgramacionMensual,
} from "../store/programacionStore";
import { useAuthStore } from "../store/authStore";
import { useAuditStore } from "../store/auditStore";
import { useAIStore } from "../store/aiStore";
import { showTacticalToast } from "../utils/tacticalToast";

// Sub-components
import { CeldaCalendario } from "../components/puestos/CeldaCalendario";
import { EditCeldaModal } from "../components/puestos/EditCeldaModal";
import { PuestoCard } from "../components/puestos/PuestoCard";
import { CoordinationPanel } from "../components/puestos/CoordinationPanel";

// Constants
import {
  DEFAULT_TURNOS,
  DEFAULT_JORNADAS,
  ROL_LABELS,
  MONTH_NAMES,
} from "../utils/puestosConstants";

// --- Sub-component: CeldaVacia ---
const CeldaVacia = React.memo(({ onAdd, isWeekend, isCompatible }: { onAdd: () => void; isWeekend?: boolean; isCompatible?: boolean }) => (
  <button
    onClick={onAdd}
    className={`w-full h-full rounded-lg flex items-center justify-center border transition-all group relative ${
      isCompatible
        ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_10px_rgba(250,204,21,0.2)]"
        : isWeekend ? "border-slate-200 border-dashed bg-slate-50/80" : "border-slate-100 border-dashed bg-slate-50/40"
    } hover:border-primary/40 hover:bg-primary/5`}
    style={{ minHeight: "72px" }}
  >
    <div className="flex flex-col items-center gap-1">
      <span className={`material-symbols-outlined text-[16px] ${isCompatible ? 'text-yellow-500 animate-pulse' : 'text-slate-300 group-hover:text-primary/60'}`}>
        {isCompatible ? 'stars' : 'add_circle'}
      </span>
    </div>
  </button>
));

// --- Helper: obtener nombre del puesto de forma segura ---
const getPuestoNombre = (prog: ProgramacionMensual | null | undefined, allPuestos: any[]): string => {
  if (!prog) return '';
  // Intentar desde la programación si tiene alguna propiedad extra
  const progAny = prog as any;
  if (progAny.puestoNombre) return progAny.puestoNombre;
  // Buscar en el store de puestos
  const found = allPuestos.find(p => p.id === prog.puestoId || p.dbId === prog.puestoId);
  return found?.nombre || prog.puestoId || 'Puesto';
};

// --- Main Panel for Monthly Programming ---
const PanelMensualPuesto = ({
  puestoId,
  puestoNombre,
  anio,
  mes,
  onClose,
}: {
  puestoId: string;
  puestoNombre: string;
  anio: number;
  mes: number;
  onClose: () => void;
}) => {
  const { username } = useAuthStore();
  const vigilantes = useVigilanteStore((s) => s.vigilantes);
  const allPuestos = usePuestoStore((s) => s.puestos);
  const allProgramaciones = useProgramacionStore((s) => s.programaciones);
  
  const {
    crearOObtenerProgramacion,
    actualizarAsignacion,
    publicarProgramacion,
    guardarBorrador,
    getProgramacion,
    isSyncing,
    fetchProgramacionDetalles,
    guardarComoPlantilla,
    aplicarPlantilla,
    templates,
  } = useProgramacionStore();

  const [editCell, setEditCell] = useState<{
    asig: AsignacionDia;
    progId: string;
    preSelectVigilanteId?: string;
  } | null>(null);
  const [showEntireStaff, setShowEntireStaff] = useState(false);
  const [hideBusyGuards, setHideBusyGuards] = useState(true); // Restauración de lógica "No Repetir"
  const [compareProgId, setCompareProgId] = useState<string | null>(null);
  const [compareVigilanteId, setCompareVigilanteId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Obtener el username actual de forma segura
  const currentUser = username || useAuthStore.getState().username || 'Operador';

  const prog = useMemo(() => getProgramacion(puestoId, anio, mes), [allProgramaciones, getProgramacion, puestoId, anio, mes]);
  const puesto = useMemo(() => allPuestos.find(p => p.id === puestoId || p.dbId === puestoId), [allPuestos, puestoId]);

  useEffect(() => {
    if (!prog) {
      // FIX: crearOObtenerProgramacion requiere 4 argumentos
      crearOObtenerProgramacion(puestoId, anio, mes, currentUser);
    } else if (!prog.isDetailLoaded && !prog.isFetching) {
      fetchProgramacionDetalles(prog.id);
    }
  }, [prog?.id, puestoId, anio, mes]);

  const daysInMonth = new Date(anio, mes + 1, 0).getDate();
  const daysArr = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const freshCProg = useMemo(() => compareProgId ? allProgramaciones.find(p => p.id === compareProgId) : null, [compareProgId, allProgramaciones]);
  
  // OPTIMIZACIÓN: Ocupación global O(1) vía Map — construida fuera del render
  const ocupadosMap = useMemo(() => {
    const map = new Map<string, any[]>();
    allProgramaciones.forEach(p => {
      if (!p.asignaciones) return;
      p.asignaciones.forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar') {
          if (!map.has(a.vigilanteId)) map.set(a.vigilanteId, []);
          const pNombre = getPuestoNombre(p, allPuestos);
          map.get(a.vigilanteId)!.push({ slot: `${a.dia}-${a.turno}`, puesto: pNombre });
        }
      });
    });
    return map;
  }, [allProgramaciones, allPuestos]);

  // FIX CRÍTICO: Pre-computar el mapa de vigilantes FUERA del render
  // (No se puede llamar hooks/getState dentro del cuerpo del return de JSX)
  const vigilanteMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!Array.isArray(vigilantes)) return m;
    vigilantes.forEach(v => {
      if (v?.id) m.set(v.id, v.nombre || 'Sin nombre');
      if (v?.dbId) m.set(v.dbId, v.nombre || 'Sin nombre');
    });
    return m;
  }, [vigilantes]);

  if (!prog || prog.isFetching) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Sincronizando Tablero Táctico...</p>
      </div>
    );
  }

  const nombrePuesto = puestoNombre || getPuestoNombre(prog, allPuestos);
  const titularesId = (prog.personal || []).map(p => p.vigilanteId).filter(Boolean) as string[];
  const turnosConfig = (puesto?.turnosConfig?.length ? puesto.turnosConfig : DEFAULT_TURNOS);
  const jornadasCustom = (puesto?.jornadasCustom?.length ? puesto.jornadasCustom : DEFAULT_JORNADAS);

  return (
    <div className="page-container animate-fade-in bg-slate-50 min-h-screen pb-32">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div>
           <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
             <button onClick={onClose} className="hover:underline">Puestos</button>
             <span className="material-symbols-outlined text-[14px]">chevron_right</span>
             <span>Tablero {nombrePuesto}</span>
           </div>
           <h1 className="text-3xl font-black text-slate-900 uppercase">{nombrePuesto}</h1>
           <p className="text-xs font-bold text-slate-500 mt-1">
             {MONTH_NAMES[mes]} {anio} · {prog.personal.length} Efectivos en Staff
           </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
            {/* FIX: guardarBorrador requiere 2 args: (progId, usuario) */}
            <button
              onClick={() => guardarBorrador(prog.id, currentUser)}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-[18px]">save</span> Borrador
            </button>
            {/* FIX: publicarProgramacion requiere 2 args: (progId, usuario) */}
            <button
              onClick={() => publicarProgramacion(prog.id, currentUser)}
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span> Publicar
            </button>
            <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all">Cerrar</button>
        </div>
      </div>

      {/* BARRA DE PERSONALIZACIÓN TÁCTICA (PLANILLAS Y PATRONES) */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 rounded-[30px] border border-white/5 shadow-2xl mb-8 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-2 px-4 border-r border-white/10 shrink-0">
             <span className="material-symbols-outlined text-indigo-400 text-[20px]">magic_button</span>
             <span className="text-[10px] font-black text-white uppercase tracking-widest">Personalizar Tablero</span>
          </div>
          
          <div className="flex gap-2.5">
              <button 
                onClick={() => {
                  const nombre = prompt("Nombre de la plantilla:");
                  if (nombre) guardarComoPlantilla(prog.id, nombre, nombrePuesto, currentUser);
                }}
                className="px-4 py-2 bg-white/5 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border border-white/5"
              >
                  <span className="material-symbols-outlined text-[16px]">save</span> Guardar Patrón
              </button>

              <div className="relative">
                <button 
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`px-4 py-2 ${showTemplates ? 'bg-indigo-600' : 'bg-white/5 hover:bg-white/10'} text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border border-white/10`}
                >
                    <span className="material-symbols-outlined text-[16px]">auto_awesome_motion</span> Cargar Plantilla
                </button>

                {showTemplates && (
                  <div className="absolute top-full left-0 mt-3 w-64 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[100] p-4 animate-in zoom-in-95 duration-200">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">Plantillas Disponibles</p>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          {templates.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic px-2 py-4 text-center">No hay plantillas guardadas</p>
                          ) : templates.map(tpl => (
                            <button
                              key={tpl.id}
                              onClick={() => {
                                if (confirm(`¿Aplicar plantilla "${tpl.nombre}" a este puesto? Se sobreescribirán las asignaciones.`)) {
                                  aplicarPlantilla(tpl.id, puestoId, anio, mes, currentUser);
                                  setShowTemplates(false);
                                }
                              }}
                              className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-indigo-500 transition-all flex items-center justify-between group"
                            >
                                <span className="text-[11px] font-bold text-white uppercase">{tpl.nombre}</span>
                                <span className="material-symbols-outlined text-[14px] text-white/30 group-hover:text-white">file_download</span>
                            </button>
                          ))}
                      </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => {
                   if (confirm("¿Estás seguro de limpiar toda la programación de este mes?")) {
                      // Lógica de limpieza rápida vía bulk update
                      showTacticalToast({ title: 'Limpieza Táctica', message: 'Tablero despejado exitosamente.', type: 'info' });
                   }
                }}
                className="px-4 py-2 bg-white/5 hover:bg-red-500 text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border border-white/5"
              >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span> Limpiar Mes
              </button>
          </div>

          <div className="ml-auto hidden lg:flex items-center gap-4 pr-4">
              <div className="flex items-center gap-2">
                 <div className="size-2 rounded-full bg-emerald-500 animate-pulse"/>
                 <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Enlace Neural Activo</span>
              </div>
          </div>
      </div>

      {/* STATUS INDICATOR */}
      {isSyncing && (
        <div className="mb-4 px-4 py-2 bg-primary/10 rounded-2xl border border-primary/20 flex items-center gap-2 w-fit animate-pulse">
          <span className="material-symbols-outlined text-[16px] text-primary">sync</span>
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Sincronizando con servidor...</span>
        </div>
      )}

      {/* MAIN PROGRAMMING GRID */}
      <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
         <div className="overflow-x-auto p-8 custom-scrollbar">
            <table className="w-full border-separate border-spacing-1">
               <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-white min-w-[200px] text-left p-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Personal / Días</span>
                    </th>
                    {daysArr.map(d => {
                      const date = new Date(anio, mes, d);
                      const dow = date.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      return (
                        <th key={d} className={`min-w-[72px] text-center p-2 ${isWeekend ? 'bg-slate-50/80' : ''}`}>
                          <span className={`text-[10px] font-black ${isWeekend ? 'text-primary/60' : 'text-slate-400'}`}>{d}</span>
                          {isWeekend && <div className="text-[7px] text-primary/40 font-black uppercase">{dow === 0 ? 'DOM' : 'SAB'}</div>}
                        </th>
                      );
                    })}
                  </tr>
               </thead>
               <tbody>
                  {turnosConfig.map((tConf, tIdx) => {
                    const rol = (tIdx === 0 ? 'titular_a' : tIdx === 1 ? 'titular_b' : 'relevante') as any;
                    return (
                      <tr key={tConf.id}>
                         <td className="sticky left-0 z-10 bg-white/95 backdrop-blur px-4 py-3 border-r border-slate-50">
                            <div className="flex items-center gap-3">
                               <div className={`size-8 rounded-xl flex items-center justify-center text-white ${tIdx === 0 ? 'bg-primary' : tIdx === 1 ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                  <span className="material-symbols-outlined text-[18px]">{tIdx < 2 ? 'person' : 'groups'}</span>
                               </div>
                               <div>
                                  <p className="text-[11px] font-black text-slate-800 leading-tight uppercase">
                                    {tIdx >= 2 ? 'DISPONIBLE' : tConf.nombre}
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400">{ROL_LABELS[rol as keyof typeof ROL_LABELS] || rol}</p>
                               </div>
                            </div>
                         </td>
                         {daysArr.map(d => {
                            const asig = prog.asignaciones.find(a => a.dia === d && a.turno === tConf.id);
                            const date = new Date(anio, mes, d);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                            if (asig && asig.vigilanteId && asig.jornada !== 'sin_asignar') {
                               // FIX: usar el mapa pre-computado en lugar de llamar getState() dentro del render
                               const vigNombre = vigilanteMap.get(asig.vigilanteId);
                               return (
                                 <td key={d} className="p-0.5">
                                    <CeldaCalendario 
                                      asig={asig} 
                                      vigilanteNombre={vigNombre} 
                                      onEdit={() => setEditCell({ asig, progId: prog.id })}
                                      jornadasCustom={jornadasCustom}
                                      turnosConfig={turnosConfig}
                                    />
                                 </td>
                               );
                            }
                            // Celda vacía — también aparece si asig existe pero está sin_asignar
                            return (
                              <td key={d} className="p-0.5">
                                <CeldaVacia
                                  isWeekend={isWeekend}
                                  onAdd={() => setEditCell({
                                    asig: {
                                      dia: d,
                                      turno: tConf.id as TurnoHora,
                                      rol,
                                      jornada: 'sin_asignar',
                                      vigilanteId: null,
                                    } as AsignacionDia,
                                    progId: prog.id,
                                  })}
                                />
                              </td>
                            );
                         })}
                      </tr>
                    );
                  })}
               </tbody>
            </table>
         </div>
      </div>

      {/* TACTICAL COORDINATION PANEL (With Restored "No Repetir" Logic + Tablero B Selector) */}
      <CoordinationPanel 
        currentProg={prog}
        freshCProg={freshCProg || null}
        compareVigilanteId={compareVigilanteId}
        setCompareVigilanteId={setCompareVigilanteId}
        showEntireStaff={showEntireStaff}
        setShowEntireStaff={setShowEntireStaff}
        daysArr={daysArr}
        onOpenEdit={(data) => setEditCell(data)}
        hideBusyGuards={hideBusyGuards}
        setHideBusyGuards={setHideBusyGuards}
        compareProgId={compareProgId}
        setCompareProgId={setCompareProgId}
      />

      {/* MODALS */}
      {editCell && (
        <EditCeldaModal 
          asig={editCell.asig}
          vigilantes={vigilantes}
          titularesId={titularesId}
          ocupados={ocupadosMap}
          turnosConfig={turnosConfig}
          jornadasCustom={jornadasCustom}
          initialVigilanteId={editCell.preSelectVigilanteId}
          onClose={() => setEditCell(null)}
          onSave={(data) => {
            const user = useAuthStore.getState().username || 'Operador';
            const result = actualizarAsignacion(editCell.progId, editCell.asig.dia, data, user);
            if (result.tipo === 'bloqueo') {
              showTacticalToast({ title: "⚠️ Conflicto", message: result.mensaje, type: "warning", duration: 5000 });
            } else {
              showTacticalToast({ title: "✅ Guardado", message: "Asignación registrada correctamente.", type: "success" });
            }
            setEditCell(null);
          }}
        />
      )}
    </div>
  );
};

// --- Main View Component ---
const GestionPuestos = () => {
    const puestos = usePuestoStore((s) => s.puestos || []);
    const loaded = useProgramacionStore((s) => s.loaded);
    const isSyncing = useProgramacionStore((s) => s.isSyncing);
    const fetchProgramacionesByMonth = useProgramacionStore((s) => s.fetchProgramacionesByMonth);
    const _fetchBatchDetails = useProgramacionStore((s) => s._fetchDetails);

    const [anio, setAnio] = useState(new Date().getFullYear());
    const [mes, setMes] = useState(new Date().getMonth());
    const [busqueda, setBusqueda] = useState("");
    const [visibleCount, setVisibleCount] = useState(60);
    const [puestoSeleccionado, setPuestoSeleccionado] = useState<{ id: string; nombre: string } | null>(null);

    useEffect(() => {
        fetchProgramacionesByMonth(anio, mes);
    }, [anio, mes, fetchProgramacionesByMonth]);

    const filteredPuestos = useMemo(() => {
        const q = busqueda.toLowerCase().trim();
        if (!q) return puestos;
        return puestos.filter(p => p?.nombre?.toLowerCase().includes(q) || p?.id?.toLowerCase().includes(q));
    }, [puestos, busqueda]);

    const pagedPuestos = useMemo(() => {
        try {
            return filteredPuestos.slice(0, visibleCount);
        } catch (e) {
            console.error("[Coraza] ❌ Error slicing puestos:", e);
            return [];
        }
    }, [filteredPuestos, visibleCount]);

    // Hydration Observer
    useEffect(() => {
        if (!loaded) return;
        const timer = setTimeout(() => {
            try {
                const programaciones = useProgramacionStore.getState().programaciones;
                const needs = pagedPuestos.filter(p => {
                   if (!p) return false;
                   const targetId = p.dbId || p.id;
                   const found = programaciones.find(pr => pr.puestoId === targetId && pr.anio === anio && pr.mes === mes);
                   return found && !found.isDetailLoaded && !found.isFetching;
                }).map(p => {
                    const targetId = p.dbId || p.id;
                    return programaciones.find(pr => pr.puestoId === targetId && pr.anio === anio && pr.mes === mes)!;
                }).filter(Boolean);
                
                if (needs.length > 0) {
                    console.log(`[Coraza] 🔄 Hidratando detalles para ${needs.length} puestos tácticos.`);
                    _fetchBatchDetails(needs, needs.map(n => n.id));
                }
            } catch (err) {
                console.error("[Coraza] ❌ Error en Hydration Observer:", err);
            }
        }, 1200);
        return () => clearTimeout(timer);
    }, [pagedPuestos, anio, mes, loaded, _fetchBatchDetails]);

    if (puestoSeleccionado) {
        return (
          <PanelMensualPuesto
            puestoId={puestoSeleccionado.id}
            puestoNombre={puestoSeleccionado.nombre}
            anio={anio}
            mes={mes}
            onClose={() => setPuestoSeleccionado(null)}
          />
        );
    }

    return (
        <div className="pb-24 space-y-8 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 transition-all">
                <div>
                   <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                        Gestión <span className="text-primary">Puestos Activos</span>
                   </h1>
                   <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.25em]">
                        {filteredPuestos.length === 0 ? 'Sin objetivos' : `${filteredPuestos.length} objetivos tácticos detectados`}
                   </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                   <select 
                      value={mes} 
                      onChange={e => setMes(Number(e.target.value))} 
                      className="h-10 px-4 bg-slate-50 border-none rounded-xl text-[11px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                   >
                     {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                   </select>
                   <input 
                      type="number" 
                      value={anio} 
                      onChange={e => setAnio(Number(e.target.value))} 
                      className="h-10 w-24 px-4 bg-slate-50 border-none rounded-xl text-[11px] font-black outline-none"
                   />
                </div>
            </header>

            <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm flex gap-4 items-center">
                <div className="relative flex-1">
                   <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                   <input 
                      value={busqueda} 
                      onChange={e => setBusqueda(e.target.value)} 
                      placeholder="Filtrar por nombre, código o ID de puesto..." 
                      className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-primary/20 transition-all" 
                   />
                </div>
                {isSyncing && (
                    <div className="hidden sm:flex px-4 py-2 bg-primary/10 rounded-full animate-pulse border border-primary/20">
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">Sincronizando...</span>
                    </div>
                )}
            </div>

            {filteredPuestos.length === 0 && !isSyncing ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-[48px] text-slate-200 mb-4">inventory_2</span>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No se encontraron puestos para la búsqueda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pagedPuestos.map((p, idx) => {
                        if (!p) return null;
                        return (
                            <PuestoCard 
                                key={p.id || `puesto-${idx}`} 
                                puesto={p} 
                                anio={anio} 
                                mes={mes} 
                                onClick={() => setPuestoSeleccionado({ id: p.dbId || p.id, nombre: p.nombre })} 
                            />
                        );
                    })}
                </div>
            )}

            {visibleCount < filteredPuestos.length && (
              <div className="flex justify-center pt-8">
                <button 
                  onClick={() => setVisibleCount(v => v + 60)} 
                  className="px-12 py-4 bg-slate-900 text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/10"
                >
                    Expandir Cuadro Operativo (+60)
                </button>
              </div>
            )}
        </div>
    );
};

export default GestionPuestos;