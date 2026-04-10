import React, { useState, useMemo, useEffect, useCallback } from "react";
import { usePuestoStore } from "../store/puestoStore";
import type { TurnoConfig } from "../store/puestoStore";
import { useVigilanteStore } from "../store/vigilanteStore";
import {
  useProgramacionStore,
  type AsignacionDia,
  type TurnoHora,
  type ProgramacionMensual,
  type PersonalPuesto,
  type RolPuesto,
} from "../store/programacionStore";
import { useAuthStore } from "../store/authStore";
import { useAuditStore } from "../store/auditStore";
import { showTacticalToast } from "../utils/tacticalToast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from 'xlsx';

// Sub-components
import { CeldaCalendario } from "../components/puestos/CeldaCalendario";
import { EditCeldaModal } from "../components/puestos/EditCeldaModal";
import { PuestoCard } from "../components/puestos/PuestoCard";
import { CoordinationPanel } from "../components/puestos/CoordinationPanel";

// Constants
import {
  DEFAULT_TURNOS,
  DEFAULT_JORNADAS,
  MONTH_NAMES,
} from "../utils/puestosConstants";

const getRolLabel = (rol: string) => {
  const base: Record<string, string> = { titular_a: "Titular A", titular_b: "Titular B", relevante: "Relevante" };
  if (base[rol]) return base[rol];
  // Si parece un ID (numérico largo), intentamos no mostrarlo feo
  if (/^\d+$/.test(rol) || rol.length > 10) return "Rol Personalizado";
  return rol.replace(/_/g, " ").toUpperCase();
};

// ─── Jornada shorthand para PDF ───────────────────────────────────────────────
const JORNADA_PDF: Record<string, string> = {
  normal: "D",
  descanso_remunerado: "DR",
  descanso_no_remunerado: "DNR",
  vacacion: "VAC",
  sin_asignar: "",
  AM: "D",
  PM: "N",
  "24H": "24",
};

const ROL_PDF_BASE: Record<string, string> = {
  titular_a: "TITULAR A",
  titular_b: "TITULAR B",
  relevante: "RELEVANTE",
};

// Combinar base con etiquetas personalizadas
const getRolPdfLabel = (rol: string) => {
  return ROL_PDF_BASE[rol] || rol.replace(/_/g, " ").toUpperCase();
};

// ─── Celda vacía ──────────────────────────────────────────────────────────────
const CeldaVacia = React.memo(
  ({
    onAdd,
    isWeekend,
    isCompatible,
  }: {
    onAdd: () => void;
    isWeekend?: boolean;
    isCompatible?: boolean;
  }) => (
    <button
      onClick={onAdd}
      className={`w-full h-full rounded-lg flex items-center justify-center border transition-all group relative ${
        isCompatible
          ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_10px_rgba(250,204,21,0.2)]"
          : isWeekend
          ? "border-slate-200 border-dashed bg-slate-50/80"
          : "border-slate-100 border-dashed bg-slate-50/40"
      } hover:border-primary/40 hover:bg-primary/5`}
      style={{ minHeight: "72px" }}
    >
      <div className="flex flex-col items-center gap-1">
        <span
          className={`material-symbols-outlined text-[16px] ${
            isCompatible
              ? "text-yellow-500 animate-pulse"
              : "text-slate-300 group-hover:text-primary/60"
          }`}
        >
          {isCompatible ? "stars" : "add_circle"}
        </span>
      </div>
    </button>
  )
);

// ─── Helper nombre puesto ─────────────────────────────────────────────────────
const getPuestoNombre = (
  prog: ProgramacionMensual | null | undefined,
  allPuestos: any[]
): string => {
  if (!prog) return "";
  const progAny = prog as any;
  if (progAny.puestoNombre) return progAny.puestoNombre;
  const found = allPuestos.find(
    (p) => p.id === prog.puestoId || p.dbId === prog.puestoId
  );
  return found?.nombre || prog.puestoId || "Puesto";
};

// ─── Modal: Gestión de Personal del Puesto ───────────────────────────────────
const GestionPersonalModal = ({
  prog,
  puestoNombre,
  turnosConfig,
  onClose,
  onSave,
}: {
  prog: ProgramacionMensual;
  puestoNombre: string;
  turnosConfig: TurnoConfig[];
  onClose: () => void;
  onSave: (personal: PersonalPuesto[]) => void;
}) => {
  const vigilantes = useVigilanteStore((s) => s.vigilantes);
  const [personal, setPersonal] = useState<PersonalPuesto[]>(
    prog.personal.length > 0
      ? [...prog.personal]
      : [
          { rol: "titular_a", vigilanteId: null, turnoId: "AM" },
          { rol: "titular_b", vigilanteId: null, turnoId: "PM" },
          { rol: "relevante", vigilanteId: null, turnoId: "AM" },
        ]
  );
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [newRolName, setNewRolName] = useState("");
  const [showAddRol, setShowAddRol] = useState(false);

  // Roles estáticos base
  const BASE_ROLES: { rol: string; label: string; color: string; icon: string }[] = [
    { rol: "titular_a", label: "Titular A", color: "bg-primary", icon: "shield" },
    { rol: "titular_b", label: "Titular B", color: "bg-indigo-600", icon: "shield_person" },
    { rol: "relevante", label: "Relevante / Backup", color: "bg-slate-600", icon: "groups" },
  ];

  // Roles activos: base + cualquier rol custom que ya exista en personal
  const activeRoles = useMemo(() => {
    const baseRolIds = BASE_ROLES.map(r => r.rol);
    const customRoles = personal
      .filter(p => !baseRolIds.includes(p.rol))
      .map(p => ({
        rol: p.rol,
        label: p.rol.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        color: "bg-violet-600",
        icon: "person_add"
      }));
    return [...BASE_ROLES, ...customRoles];
  }, [personal]);

  const addCustomRol = () => {
    const clean = newRolName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!clean) return;
    
    // VALIDACIÓN CRÍTICA: Impedir roles puramente numéricos
    if (/^\d+$/.test(clean)) {
      showTacticalToast({ 
        title: "Nombre Inválido", 
        message: "El nombre del turno no puede ser solo números. Use letras para identificarlo.", 
        type: "warning" 
      });
      return;
    }

    if (personal.some(p => p.rol === clean)) {
      showTacticalToast({ title: "Ya existe", message: "Este rol ya está configurado en el puesto.", type: "warning" });
      return;
    }

    // Determinar turno predeterminado basado en el nombre del rol
    const inferedTurnoId = (clean.toLowerCase().includes('b') || clean.toLowerCase().includes('pm') || clean.toLowerCase().includes('noche')) ? "PM" : "AM";

    setPersonal(prev => [...prev, { rol: clean, vigilanteId: null, turnoId: inferedTurnoId }]);
    setNewRolName("");
    setShowAddRol(false);
  };

  const removeRol = (rol: string) => {
    const baseRolIds = BASE_ROLES.map(r => r.rol);
    if (baseRolIds.includes(rol)) return;
    setPersonal(prev => prev.filter(p => p.rol !== rol));
  };

  const getFilteredVigilantes = (rol: string) => {
    const q = (searchTerms[rol] || "").toLowerCase().trim();
    const usedIds = personal
      .filter((p) => p.rol !== rol && p.vigilanteId)
      .map((p) => p.vigilanteId);
      
    if (!q) {
      return vigilantes
        .filter((v) => !usedIds.includes(v.id) && !usedIds.includes(v.dbId ?? null))
        .slice(0, 30);
    }
    
    return vigilantes
      .filter(
        (v) =>
          (v.nombre?.toLowerCase().includes(q) || v.cedula?.includes(q) || v.id?.toLowerCase().includes(q)) &&
          !usedIds.includes(v.id) &&
          !usedIds.includes(v.dbId ?? null)
      )
      .slice(0, 40);
  };

  const setPersonalVigilante = (rol: string, vigilanteId: string | null) => {
    setPersonal((prev) => prev.map((p) => (p.rol === rol ? { ...p, vigilanteId } : p)));
    setSearchTerms((prev) => ({ ...prev, [rol]: "" }));
  };

  const setPersonalTurno = (rol: string, turnoId: string) => {
    setPersonal((prev) => prev.map((p) => (p.rol === rol ? { ...p, turnoId } : p)));
  };

  const getNombreAsignado = (rol: string) => {
    const p = personal.find((p) => p.rol === rol);
    if (!p?.vigilanteId) return null;
    const v = vigilantes.find((v) => v.id === p.vigilanteId || v.dbId === p.vigilanteId);
    return v?.nombre || p.vigilanteId;
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
              Personal del Puesto
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              {puestoNombre} — Configura el equipo de trabajo (100% Personalizable)
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-white text-[20px]">close</span>
          </button>
        </div>

        <div className="p-8 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {activeRoles.map(({ rol, label, color, icon }) => {
            const nombreAsignado = getNombreAsignado(rol);
            const q = searchTerms[rol] || "";
            const filtered = getFilteredVigilantes(rol);
            const isCustom = !["titular_a", "titular_b", "relevante"].includes(rol);

            return (
              <div key={rol} className="bg-white/[0.04] rounded-3xl p-5 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`size-9 rounded-xl ${color} flex items-center justify-center shadow-lg`}>
                    <span className="material-symbols-outlined text-white text-[18px]">{icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-black text-white uppercase">{label}</p>
                      {/* ── Selector de Turno vinculado ── */}
                      <div className="flex items-center gap-2 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                        <span className="material-symbols-outlined text-[14px] text-slate-400">
                          {(personal.find(p => p.rol === rol)?.turnoId?.includes('PM') || personal.find(p => p.rol === rol)?.rol.toLowerCase().includes('b')) ? 'dark_mode' : 'light_mode'}
                        </span>
                        <select 
                          value={personal.find(p => p.rol === rol)?.turnoId || "AM"}
                          onChange={(e) => setPersonalTurno(rol, e.target.value)}
                          className="bg-transparent text-[9px] font-bold text-slate-300 border-none outline-none cursor-pointer hover:text-white transition-all"
                        >
                          {turnosConfig.map((t: any) => (
                            <option key={t.id} value={t.id} className="bg-slate-800 text-white">
                              {t.nombre} ({t.inicio}-{t.fin})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {nombreAsignado ? (
                      <p className="text-[10px] text-emerald-400 font-bold mt-0.5">✓ {nombreAsignado}</p>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Sin asignar</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {nombreAsignado && (
                      <button
                        onClick={() => setPersonalVigilante(rol, null)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[9px] font-black uppercase transition-colors"
                      >
                        Quitar
                      </button>
                    )}
                    {isCustom && (
                      <button
                        onClick={() => removeRol(rol)}
                        className="size-8 bg-red-900/20 hover:bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center transition-colors"
                        title="Eliminar este turno"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative mb-2">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar vigilante..."
                    value={q}
                    onChange={(e) =>
                      setSearchTerms((prev) => ({ ...prev, [rol]: e.target.value }))
                    }
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[11px] font-bold text-white outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                  {filtered.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setPersonalVigilante(rol, v.id)}
                      className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                    >
                      <div className="size-6 rounded bg-black/30 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                        {v.nombre?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white truncate">{v.nombre}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">{v.cedula}</p>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && q && (
                    <p className="text-center text-[9px] text-slate-600 py-2 uppercase font-black">No encontrado</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Botón para agregar más roles (Personalización 100%) */}
          {showAddRol ? (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-3xl p-5 animate-in fade-in zoom-in duration-200">
              <p className="text-[10px] font-black text-violet-300 uppercase mb-3 tracking-widest">Nuevo Turno / Rol Adicional</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: Nocturno Extra, Refuerzo..."
                  value={newRolName}
                  onChange={e => setNewRolName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomRol()}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-violet-500/30 rounded-xl text-[11px] font-bold text-white outline-none focus:border-violet-400 transition-colors"
                  autoFocus
                />
                <button
                  onClick={addCustomRol}
                  disabled={!newRolName.trim()}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-[10px] font-black uppercase transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => { setShowAddRol(false); setNewRolName(""); }}
                  className="px-3 py-2.5 bg-white/5 text-slate-400 rounded-xl text-[10px] font-black uppercase transition-colors hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRol(true)}
              className="w-full py-4 border-2 border-dashed border-white/10 hover:border-violet-500/40 hover:bg-violet-500/5 text-slate-500 hover:text-violet-400 rounded-3xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-3 group"
            >
              <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">add_circle</span>
              Agregar Turno Personalizado al Puesto
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/10 bg-black/20 flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(personal)}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="material-symbols-outlined text-[16px] mr-2 align-middle">lock</span>
            Guardar Configuración de Personal
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── AddTurnoForm: mini-formulario para agregar un nuevo turno ────────────────
const AddTurnoForm = ({
  turnosActuales,
  onAdd,
}: {
  turnosActuales: TurnoConfig[];
  onAdd: (turno: TurnoConfig) => void;
}) => {
  const [nombre, setNombre] = useState('');
  const [inicio, setInicio] = useState('06:00');
  const [fin, setFin] = useState('18:00');
  const [color, setColor] = useState('#6366f1');

  const PRESET_COLORS = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Violet', value: '#8b5cf6' },
  ];

  const handleAdd = () => {
    const n = nombre.trim();
    if (!n) { showTacticalToast({ title: 'Campo vacío', message: 'Ingresa un nombre para el turno.', type: 'warning' }); return; }
    const isDup = turnosActuales.some(t => t.nombre.toLowerCase() === n.toLowerCase());
    if (isDup) { showTacticalToast({ title: 'Ya existe', message: `El turno "${n}" ya está en la lista.`, type: 'warning' }); return; }
    onAdd({ id: `turno_${Date.now()}`, nombre: n, inicio, fin, color });
    setNombre('');
    setInicio('06:00');
    setFin('18:00');
    showTacticalToast({ title: 'Turno Creado', message: `El turno ${n} ha sido inyectado al sistema.`, type: 'success' });
  };

  return (
    <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
      <div>
        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Identificador del Turno</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Turno Especial, Refuerzo..."
          className="w-full h-10 px-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] font-bold text-white outline-none focus:border-violet-400 placeholder-slate-700 transition-all"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Hora Inicio</label>
          <input type="time" value={inicio} onChange={e => setInicio(e.target.value)}
            className="w-full h-10 px-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] text-white outline-none focus:border-violet-400 transition-all" />
        </div>
        <div className="flex-1">
          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Hora Fin</label>
          <input type="time" value={fin} onChange={e => setFin(e.target.value)}
            className="w-full h-10 px-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] text-white outline-none focus:border-violet-400 transition-all" />
        </div>
      </div>

      <div>
        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Color Distintivo</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`size-7 rounded-lg border-2 transition-all ${color === c.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleAdd}
        className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 group"
      >
        <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform">add_circle</span>
        Inyectar Turno al Tablero
      </button>
    </div>
  );
};

// ─── Panel Mensual Principal ──────────────────────────────────────────────────
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
  const username = useAuthStore(s => s.username);
  const vigilantes = useVigilanteStore(s => s.vigilantes);
  const allPuestos = usePuestoStore(s => s.puestos);
  const allProgramaciones = useProgramacionStore(s => s.programaciones);
  const logAction = useAuditStore(s => s.logAction);
  const isSyncing = useProgramacionStore(s => s.isSyncing);
  const asignarPersonal = useProgramacionStore(s => s.asignarPersonal);

  const {
    crearOObtenerProgramacion,
    actualizarAsignacion,
    publicarProgramacion,
    guardarBorrador,
    getProgramacion,
    fetchProgramacionDetalles,
    guardarComoPlantilla,
    aplicarPlantilla,
    templates,
  } = useProgramacionStore() as any;

  const [editCell, setEditCell] = useState<{
    asig: AsignacionDia;
    progId: string;
    preSelectVigilanteId?: string;
  } | null>(null);
  const [showEntireStaff, setShowEntireStaff] = useState(false);
  const [hideBusyGuards, setHideBusyGuards] = useState(true);
  const [compareProgId, setCompareProgId] = useState<string | null>(null);
  const [compareVigilanteId, setCompareVigilanteId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showTurnosConfig, setShowTurnosConfig] = useState(false);

  const currentUser =
    username || useAuthStore.getState().username || "Operador";

  const prog = useMemo(
    () => getProgramacion(puestoId, anio, mes),
    [allProgramaciones, getProgramacion, puestoId, anio, mes]
  );
  const puesto = useMemo(
    () =>
      allPuestos.find((p: any) => p.id === puestoId || p.dbId === puestoId),
    [allPuestos, puestoId]
  );

  const isInitialLoading = !useProgramacionStore(s => (s as any).loaded);

  useEffect(() => {
    // Si todavía estamos cargando el 'índice' global, esperamos. 0 KM Safety.
    if (isInitialLoading) return;

    if (!prog) {
      // Búsqueda de emergencia por si el fetch global falló o es lento
      (useProgramacionStore.getState() as any).fetchProgramacionesByMonth(anio, mes).then(() => {
        const recheck = getProgramacion(puestoId, anio, mes);
        if (!recheck) {
          crearOObtenerProgramacion(puestoId, anio, mes, currentUser);
        }
      });
    } else if (!prog.isDetailLoaded && !prog.isFetching) {
      fetchProgramacionDetalles(prog.id);
    }
  }, [prog?.id, puestoId, anio, mes, isInitialLoading]);

  const daysInMonth = new Date(anio, mes + 1, 0).getDate();
  const daysArr = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );

  const freshCProg = useMemo(
    () =>
      compareProgId
        ? allProgramaciones.find((p) => p.id === compareProgId)
        : null,
    [compareProgId, allProgramaciones]
  );

  // ── BLINDAJE DE SALIDA: Evita perder datos si el sync está pendiente ────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasChanges = (useProgramacionStore.getState() as any).hasPendingChanges();
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = ''; // Muestra el mensaje de "¿Estás seguro de que quieres salir?"
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const ocupadosMap = useMemo(() => {
    const map = new Map<string, any[]>();
    allProgramaciones.forEach((p) => {
      if (!p.asignaciones) return;
      p.asignaciones.forEach((a) => {
        if (a.vigilanteId && a.jornada !== "sin_asignar") {
          if (!map.has(a.vigilanteId)) map.set(a.vigilanteId, []);
          const pNombre = getPuestoNombre(p, allPuestos);
          map
            .get(a.vigilanteId)!
            .push({ slot: `${a.dia}-${a.turno}`, puesto: pNombre });
        }
      });
    });
    return map;
  }, [allProgramaciones, allPuestos]);

  const vigilanteMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!Array.isArray(vigilantes)) return m;
    vigilantes.forEach((v) => {
      if (v?.id) m.set(v.id, v.nombre || "Sin nombre");
      if (v?.dbId) m.set(v.dbId, v.nombre || "Sin nombre");
    });
    return m;
  }, [vigilantes]);

  // ── Guardar personal desde modal ─────────────────────────────────────────
  const handleSavePersonal = useCallback(
    (personal: PersonalPuesto[]) => {
      if (!prog) return;
      useProgramacionStore.getState().actualizarPersonalPuesto(prog.id, personal, currentUser);
      setShowPersonalModal(false);
      showTacticalToast({
        title: "✅ Personal Actualizado",
        message: `${personal.filter((p) => p.vigilanteId).length} efectivos asignados al puesto.`,
        type: "success",
      });
      // Forzar sync
      const queueSync = (useProgramacionStore as any).__syncQueue;
      if (queueSync) queueSync(prog.id);
      logAction("PROGRAMACION", "Personal Actualizado", `Puesto: ${puestoNombre}`, "success");
    },
    [prog, puestoNombre, logAction]
  );

  // ── Generación de PDF del puesto — VERSIÓN CAMPO OPERATIVO ────────────────
  const handleGeneratePDF = useCallback(async () => {
    if (!prog) return;
    setIsGeneratingPDF(true);
    logAction("PROGRAMACION", "Exportar PDF", `${puestoNombre} ${MONTH_NAMES[mes]} ${anio}`, "info");
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const fechaActual = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const DAY_NAMES = ["DOM","LUN","MAR","MIE","JUE","VIE","SAB"];

      // ── Cargar logo ──────────────────────────────────────────────────────
      let logoDataUrl: string | null = null;
      try {
        const resp = await fetch("/logo.png");
        if (resp.ok) {
          const blob = await resp.blob();
          logoDataUrl = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.readAsDataURL(blob);
          });
        }
      } catch { /* sin logo */ }

      // ═ CABECERA ══════════════════════════════════════════════════════════
      doc.setFillColor(15, 23, 84);
      doc.rect(0, 0, pageW, 40, "F");
      doc.setFillColor(67, 24, 255);
      doc.rect(0, 38, pageW, 2.5, "F");

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 5, 3, 33, 33);
      } else {
        doc.setFillColor(67, 24, 255);
        doc.roundedRect(5, 4, 33, 30, 3, 3, "F");
        doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(8);
        doc.text("CORAZA", 21, 15, { align: "center" });
        doc.text("C.T.A", 21, 22, { align: "center" });
      }

      // ── Bloque PUESTO (derecha) — definir primero para calcular área central ──
      // A4 horizontal = 297mm. Bloque derecho: últimos 120mm → pX = 177mm
      const pX = pageW - 120;
      doc.setFillColor(255,255,255);
      doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      doc.roundedRect(pX, 5, 112, 31, 3, 3, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));

      doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(155,185,255);
      doc.text("PUESTO / OBJETIVO:", pX+4, 12);
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(255,255,255);
      // Recortar nombre para que quepa (máx 44 chars a esta escala)
      doc.text(puestoNombre.toUpperCase().slice(0, 44), pX+4, 19);
      doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(155,185,255);
      doc.text("DIRECCIÓN:", pX+4, 26);
      doc.setTextColor(215,230,255);
      doc.text((puesto?.direccion || "—").slice(0, 44), pX+24, 26);
      doc.setTextColor(140,165,220); doc.setFontSize(5.5);
      doc.text(`Impreso: ${fechaActual}`, pX+4, 33);

      // ── Zona de texto central: entre x=42 y x=pX-4 ────────────────────────
      // Centro de esa zona = (42 + pX-4) / 2
      const centerX = (42 + pX - 4) / 2;

      // Título principal — centrado en zona central
      doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(12);
      doc.text("CUADRO DE PROGRAMACIÓN MENSUAL", centerX, 11, { align: "center" });

      // Subtítulo empresa — misma zona central, fuente más pequeña
      doc.setFont("helvetica","normal"); doc.setFontSize(6.2); doc.setTextColor(170,195,255);
      doc.text(
        "COOPERATIVA DE VIGILANCIA Y SEGURIDAD PRIVADA CORAZA C.T.A  —  NIT: 901.509.121",
        centerX, 17, { align: "center", maxWidth: pX - 4 - 42 }
      );

      // Mes y año — alineado a la izquierda del área central
      doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(255,255,255);
      doc.text(`${MONTH_NAMES[mes].toUpperCase()}  ${anio}`, 44, 30);

      // ──────────────── TABLA PERSONAL ──────────────────────────────────────────
      // Agrupar asignaciones por vigilante
      const vigDataMap = new Map<string, { nombre:string; cedula:string; rol:string; asigs: Map<number,string> }>();

      // Inicializar con personal del cuadro
      (prog.personal || []).forEach((per: any) => {
        if (!per.vigilanteId) return;
        const vid = per.vigilanteId;
        if (!vigDataMap.has(vid)) {
          const vig = vigilantes.find(v => v.id===vid||v.dbId===vid);
          vigDataMap.set(vid, { nombre:(vig?.nombre||vid).toUpperCase(), cedula:vig?.cedula||"—", rol:getRolPdfLabel(per.rol), asigs:new Map() });
        }
      });

      // Volcar asignaciones reales
      (prog.asignaciones||[]).forEach((a: AsignacionDia) => {
        if (!a.vigilanteId || a.jornada==="sin_asignar") return;
        if (!vigDataMap.has(a.vigilanteId)) {
          const vig = vigilantes.find(v => v.id===a.vigilanteId||v.dbId===a.vigilanteId);
          const rolDef = (prog.personal||[]).find((p:any)=>p.vigilanteId===a.vigilanteId);
          vigDataMap.set(a.vigilanteId, { nombre:(vig?.nombre||a.vigilanteId).toUpperCase(), cedula:vig?.cedula||"—", rol:getRolPdfLabel(rolDef?.rol||"—"), asigs:new Map() });
        }
        const code = JORNADA_PDF[a.jornada] || a.jornada;
        // ── Cristalizar Horario en el PDF ──
        let finalContent = code;
        if (code === "D") finalContent = "D\n06-18";
        else if (code === "N") finalContent = "N\n18-06";
        else if (code === "24") finalContent = "24\n06-06";
        
        vigDataMap.get(a.vigilanteId)!.asigs.set(a.dia, finalContent);
      });

      const vigEntries = Array.from(vigDataMap.entries());

      // Encabezado tabla
      const headRow = [
        "ROL", "C.C.", "APELLIDOS Y NOMBRES",
        ...days.map(d => { const dow=new Date(anio,mes,d).getDay(); return `${DAY_NAMES[dow]}\n${String(d).padStart(2,"0")}`; }),
        "TRAB.","DESC.","VAC."
      ];

      const bodyRows = vigEntries.map(([, v]) => {
        let trab=0, desc=0, vac=0;
        const row: string[] = [v.rol, v.cedula, v.nombre];
        days.forEach(d => {
          const code = v.asigs.get(d) || "";
          if (code==="D"||code==="N"||code==="24") trab++;
          else if (code==="DR"||code==="DNR") desc++;
          else if (code==="VAC") vac++;
          row.push(code);
        });
        row.push(String(trab), String(desc), String(vac));
        return row;
      });

      if (bodyRows.length===0) {
        bodyRows.push(["—","—","SIN PERSONAL ASIGNADO ESTE MES",...days.map(()=>""),"0","0","0"]);
      }

      const tN = headRow.length;
      autoTable(doc, {
        startY: 43,
        head: [headRow],
        body: bodyRows,
        theme: "grid",
        styles: { 
          fontSize: 5, 
          cellPadding: { top: 1, bottom: 1, left: 0.5, right: 0.5 }, 
          halign: "center", 
          valign: "middle", 
          lineWidth: 0.1, 
          textColor: [15, 23, 42], 
          font: "helvetica", 
          minCellHeight: 10 
        },
        headStyles: { 
          fillColor: [15, 23, 84], 
          textColor: [255, 255, 255], 
          fontStyle: "bold", 
          fontSize: 5.5, 
          minCellHeight: 11, 
          halign: "center", 
          valign: "middle" 
        },
        alternateRowStyles: { fillColor: [247, 248, 255] },
        columnStyles: {
          0: { cellWidth:13, fontStyle:"bold", fillColor:[241,245,249], fontSize:4.8, textColor:[30,64,175] },
          1: { cellWidth:18, fontSize:5 },
          2: { cellWidth:40, halign:"left", fontStyle:"bold", fontSize:5.8, textColor:[15,23,42] },
          [tN-3]: { cellWidth:8, fontStyle:"bold", fillColor:[219,234,254], textColor:[29,78,216] },
          [tN-2]: { cellWidth:8, fontStyle:"bold", fillColor:[209,250,229], textColor:[4,120,87] },
          [tN-1]: { cellWidth:8, fontStyle:"bold", fillColor:[237,233,254], textColor:[109,40,217] },
        },
        didParseCell: (data: any) => {
          if (data.row.section==="head") {
            const dIdx=data.column.index-3;
            if (dIdx>=0&&dIdx<days.length) {
              const dow=new Date(anio,mes,days[dIdx]).getDay();
              if (dow===0||dow===6) data.cell.styles.fillColor=[67,24,255];
            }
            return;
          }
          if (data.row.section === "body" && data.column.index >= 3 && data.column.index < tN - 3) {
            const raw = (data.cell.text[0] || "").trim();
            const val = raw.split("\n")[0]; // El código (D, N, 24...)
            
            const dIdx = data.column.index - 3;
            const dow = dIdx >= 0 && dIdx < days.length ? new Date(anio, mes, days[dIdx]).getDay() : -1;
            
            if (!val && (dow === 0 || dow === 6)) {
              data.cell.styles.fillColor = [220, 228, 240];
              return;
            }

            // ── BUSCAR COLOR DENTRO DE turnosConfig ──
            const tConf = turnosConfig.find(t => t.id === val || t.nombre === val);
            if (tConf && tConf.color) {
              // Convertir hex a RGB para jsPDF
              const hex = tConf.color.replace('#', '');
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              data.cell.styles.fillColor = [r, g, b];
              // Decidir color de texto basado en brillo
              const brightness = (r * 299 + g * 587 + b * 114) / 1000;
              const textRgb = brightness > 128 ? [30, 41, 59] : [255, 255, 255];
              data.cell.styles.textColor = textRgb as [number, number, number];
              data.cell.styles.fontStyle = "bold";
              return;
            }

            // Estilos por defecto para tipos de licencia/descanso
            if (val === "DR") {
              data.cell.styles.fillColor = [209, 250, 229];
              data.cell.styles.textColor = [4, 120, 87];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "DNR") {
              data.cell.styles.fillColor = [255, 243, 199];
              data.cell.styles.textColor = [146, 64, 14];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "VAC") {
              data.cell.styles.fillColor = [237, 233, 254];
              data.cell.styles.textColor = [109, 40, 217];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
        margin: { left:8, right:8 },
      });

      // ═ FIRMA ════════════════════════════════════════════════════════════
      const afterTable = (doc as any).lastAutoTable?.finalY || 130;
      let firmaY = afterTable + 5;

      if (firmaY < pageH - 38 && vigEntries.length > 0) {
        doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.setTextColor(15,23,84);
        doc.text("RECIBIDO Y CONFORME — FIRMA DEL PERSONAL:", 10, firmaY + 5);
        const maxFirmas = Math.min(vigEntries.length, 6);
        const fW = (pageW-20) / maxFirmas;
        vigEntries.slice(0, maxFirmas).forEach(([,v], i) => {
          const fx = 10 + i*fW;
          const ly = firmaY + 18;
          doc.setDrawColor(80,100,160); doc.setLineWidth(0.4);
          doc.line(fx+2, ly, fx+fW-4, ly);
          doc.setFont("helvetica","bold"); doc.setFontSize(5); doc.setTextColor(15,23,84);
          doc.text(v.nombre.slice(0,26), fx+2, ly+4);
          doc.setFont("helvetica","normal"); doc.setFontSize(4.8); doc.setTextColor(100,116,139);
          doc.text(`CC: ${v.cedula}`, fx+2, ly+8);
        });
        firmaY += 30;
      }

      // ═ LEYENDA ══════════════════════════════════════════════════════════
      const legendY = Math.min(firmaY + 2, pageH - 18);
      const baseLeyendas = [
        {code:"DR", label:"DESCANSO REMUN.", bg:[209,250,229] as [number,number,number], fg:[4,120,87] as [number,number,number]},
        {code:"DNR",label:"DESC. NO REMUN.", bg:[255,243,199] as [number,number,number], fg:[146,64,14] as [number,number,number]},
        {code:"VAC",label:"VACACIONES", bg:[237,233,254] as [number,number,number], fg:[109,40,217] as [number,number,number]},
      ];

      const turnosLeyendas = turnosConfig.map(t => {
        const hex = (t.color || "#6366f1").replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return {
          code: t.nombre,
          label: `${t.nombre} (${t.inicio}-${t.fin})`,
          bg: [r, g, b] as [number,number,number],
          fg: brightness > 128 ? [30, 41, 59] : [255, 255, 255] as [number,number,number]
        };
      });

      const todasLeyendas = [...turnosLeyendas, ...baseLeyendas];
      const lW = (pageW-16)/todasLeyendas.length;
      doc.setFillColor(245,247,255); doc.setDrawColor(200,210,230); doc.setLineWidth(0.2);
      doc.roundedRect(8, legendY, pageW-16, 9, 1.5, 1.5, "FD");
      
      todasLeyendas.forEach((l, i) => {
        const lx = 9 + i*lW;
        doc.setFillColor(l.bg[0], l.bg[1], l.bg[2]);
        doc.roundedRect(lx, legendY+1.5, 5, 5.5, 0.5, 0.5, "F");
        doc.setFont("helvetica","bold"); doc.setFontSize(4.5);
        doc.setTextColor(l.fg[0], l.fg[1], l.fg[2]);
        doc.text(l.code.slice(0,4), lx+2.5, legendY+5, {align:"center"});
        doc.setFont("helvetica","normal"); doc.setFontSize(4); doc.setTextColor(50,65,100);
        doc.text(l.label.length > 25 ? l.label.slice(0,22)+"..." : l.label, lx+7, legendY+5);
      });

      // ═ FOOTER ═══════════════════════════════════════════════════════════
      doc.setFillColor(15,23,84);
      doc.rect(0, pageH-9, pageW, 9, "F");
      doc.setFont("helvetica","normal"); doc.setFontSize(5.5); doc.setTextColor(170,195,255);
      doc.text("Cooperativa de Vigilancia y Seguridad Privada CORAZA C.T.A  |  Carrera 81 #49-24, Medellín  |  PBX: 311 383 6939  |  www.corazaseguridadcta.com", pageW/2, pageH-4, {align:"center"});
      doc.setTextColor(100,200,120);
      doc.text(`Pág. 1`, pageW-10, pageH-4, {align:"right"});

      const fileName = `PROG_${puestoNombre.replace(/\s+/g,"_").toUpperCase()}_${MONTH_NAMES[mes].toUpperCase()}_${anio}.pdf`;
      doc.save(fileName);
      showTacticalToast({ title:"📜 PDF Generado", message:`Documento listo para envío operativo.`, type:"success" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [prog, puestoNombre, mes, anio, daysInMonth, vigilantes, puesto, logAction]);

  const handleGenerateExcel = useCallback(async () => {
    if (!prog) return;
    setIsGeneratingPDF(true); // Using same loading state
    logAction("PROGRAMACION", "Exportar Excel", `${puestoNombre} ${MONTH_NAMES[mes]} ${anio}`, "info");

    try {
      const wb = XLSX.utils.book_new();
      const rows: any[] = [];

      // Header info
      rows.push(["CUADRO DE PROGRAMACIÓN MENSUAL"]);
      rows.push(["COOPERATIVA DE VIGILANCIA Y SEGURIDAD PRIVADA CORAZA C.T.A - NIT: 901.509.121"]);
      rows.push([`PUESTO: ${puestoNombre.toUpperCase()}`]);
      rows.push([`MES: ${MONTH_NAMES[mes].toUpperCase()} ${anio}`]);
      rows.push([]);

      // Data preparation (same logic as PDF)
      const vigDataMap = new Map<string, { nombre:string; cedula:string; rol:string; asigs: Map<number,string> }>();

      (prog.personal || []).forEach((per: any) => {
        if (!per.vigilanteId) return;
        const vid = per.vigilanteId;
        if (!vigDataMap.has(vid)) {
          const vig = vigilantes.find(v => v.id===vid||v.dbId===vid);
          vigDataMap.set(vid, { nombre:(vig?.nombre||vid).toUpperCase(), cedula:vig?.cedula||"—", rol:getRolPdfLabel(per.rol), asigs:new Map() });
        }
      });

      (prog.asignaciones||[]).forEach((a: AsignacionDia) => {
        if (!a.vigilanteId || a.jornada==="sin_asignar") return;
        if (!vigDataMap.has(a.vigilanteId)) {
          const vig = vigilantes.find(v => v.id===a.vigilanteId||v.dbId===a.vigilanteId);
          const rolDef = (prog.personal||[]).find((p:any)=>p.vigilanteId===a.vigilanteId);
          vigDataMap.set(a.vigilanteId, { nombre:(vig?.nombre||a.vigilanteId).toUpperCase(), cedula:vig?.cedula||"—", rol:getRolPdfLabel(rolDef?.rol||"—"), asigs:new Map() });
        }
        const code = JORNADA_PDF[a.jornada] || a.jornada;
        vigDataMap.get(a.vigilanteId)!.asigs.set(a.dia, code);
      });

      const vigEntries = Array.from(vigDataMap.entries());

      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const headRow = ["ROL", "C.C.", "APELLIDOS Y NOMBRES", ...days.map(d => String(d).padStart(2,"0")), "TRAB.","DESC.","VAC."];
      rows.push(headRow);

      vigEntries.forEach(([, v]) => {
        let trab=0, desc=0, vac=0;
        const rowData: string[] = [v.rol, v.cedula, v.nombre];
        days.forEach(d => {
          const code = v.asigs.get(d) || "-";
          if (code==="D"||code==="N"||code==="24") trab++;
          else if (code==="DR"||code==="DNR") desc++;
          else if (code==="VAC") vac++;
          rowData.push(code);
        });
        rowData.push(String(trab), String(desc), String(vac));
        rows.push(rowData);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Programacion");
      
      const fileName = `PROG_${puestoNombre.replace(/\s+/g,"_").toUpperCase()}_${MONTH_NAMES[mes].toUpperCase()}_${anio}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      showTacticalToast({ title:"💚 Excel Generado", message:`Archivo Excel listo para contabilidad.`, type:"success" });
    } catch (err: any) {
      console.error("[EXCEL] Error:", err);
      showTacticalToast({ title:"❌ Error de Excel", message:err.message||"No se pudo generar el archivo.", type:"error" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [prog, puestoNombre, mes, anio, daysInMonth, vigilantes, logAction]);





  if (!prog || prog.isFetching) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
          Sincronizando Tablero Táctico...
        </p>
      </div>
    );
  }

  const nombrePuesto = puestoNombre || getPuestoNombre(prog, allPuestos);
  const titularesId = (prog.personal || [])
    .map((p: any) => p.vigilanteId)
    .filter(Boolean) as string[];
  const turnosConfig = puesto?.turnosConfig?.length
    ? puesto.turnosConfig
    : DEFAULT_TURNOS;
  const jornadasCustom = puesto?.jornadasCustom?.length
    ? puesto.jornadasCustom
    : DEFAULT_JORNADAS;

  const staffAsignado = (prog.personal || []).filter((p: any) => p.vigilanteId);

  return (
    <div className="page-container animate-fade-in bg-slate-50 min-h-screen pb-32">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
            <button onClick={onClose} className="hover:underline">
              Puestos
            </button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Tablero {nombrePuesto}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase">{nombrePuesto}</h1>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {MONTH_NAMES[mes]} {anio} ·{" "}
            <span
              className={`${
                staffAsignado.length > 0 ? "text-emerald-600" : "text-amber-500"
              }`}
            >
              {staffAsignado.length} efectivos asignados
            </span>
            {isSyncing && (
              <span className="ml-3 text-primary animate-pulse">⟳ Sincronizando...</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* CONFIGURAR PERSONAL */}
          <button
            onClick={() => setShowPersonalModal(true)}
            className="px-5 py-2.5 bg-slate-800 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            Personal
            {staffAsignado.length > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-500 text-white rounded-full text-[8px] font-black">
                {staffAsignado.length}
              </span>
            )}
          </button>

          {/* PDF & EXCEL */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerateExcel}
              disabled={isGeneratingPDF}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${isGeneratingPDF ? "animate-spin" : ""}`}>
                {isGeneratingPDF ? "sync" : "table_view"}
              </span>
              {isGeneratingPDF ? "Generando..." : "Exportar Excel"}
            </button>

            <button
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
              className="px-5 py-2.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isGeneratingPDF ? "animate-spin" : ""
                }`}
              >
                {isGeneratingPDF ? "sync" : "picture_as_pdf"}
              </span>
              {isGeneratingPDF ? "Generando..." : "Exportar PDF"}
            </button>
          </div>

          {/* BORRADOR */}
          <button
            onClick={() => guardarBorrador(prog.id, currentUser)}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>{" "}
            Borrador
          </button>

          {/* PUBLICAR */}
          <button
            onClick={() => publicarProgramacion(prog.id, currentUser)}
            className="px-6 py-2.5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>{" "}
            Publicar
          </button>

          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-2xl border border-slate-200 min-w-[120px] justify-center">
            {isSyncing ? (
              <>
                <div className="size-2 bg-indigo-500 rounded-full animate-ping" />
                <span className="text-[9px] font-black text-indigo-600 uppercase">Sincronizando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-emerald-500 text-[16px]">cloud_done</span>
                <span className="text-[9px] font-black text-emerald-600 uppercase">Todo Guardado</span>
              </>
            )}
          </div>

          <button
            onClick={() => {
              const hasPending = useProgramacionStore.getState().hasPendingChanges();
              if (isSyncing || hasPending) {
                if (confirm('⚠️ Hay cambios sincronizando con la central. Si cierra ahora, los últimos movimientos podrían no guardarse. ¿Desea cerrar de todas formas?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ── ESTADO VISUAL DEL PERSONAL ──────────────────────────────────── */}
      {staffAsignado.length === 0 && (
        <div
          onClick={() => setShowPersonalModal(true)}
          className="mb-6 px-6 py-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center gap-4 cursor-pointer hover:bg-amber-100 transition-colors group"
        >
          <span className="material-symbols-outlined text-amber-500 text-[28px]">
            warning
          </span>
          <div>
            <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">
              Sin Personal Asignado
            </p>
            <p className="text-[10px] font-bold text-amber-600 mt-0.5">
              Haz clic aquí para configurar el personal titular del puesto (Titular A, Titular B, Relevante)
            </p>
          </div>
          <span className="material-symbols-outlined text-amber-400 text-[20px] ml-auto group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </div>
      )}

      {staffAsignado.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {(prog.personal || [])
            .filter((p: PersonalPuesto) => p.vigilanteId)
            .map((per: PersonalPuesto) => {
              const v = vigilantes.find(
                (v) => v.id === per.vigilanteId || v.dbId === per.vigilanteId
              );
              const colors: Record<string, string> = {
                titular_a: "bg-primary/10 text-primary border-primary/20",
                titular_b: "bg-indigo-500/10 text-indigo-600 border-indigo-300/30",
                relevante: "bg-slate-100 text-slate-600 border-slate-200",
              };
              return (
                <div
                  key={per.rol}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${
                    colors[per.rol] || "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {per.rol === "relevante" ? "groups" : "shield_person"}
                  </span>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter block mb-1">
                      {getRolLabel(per.rol)}
                    </span>
                    <p className="text-[11px] font-black leading-tight">
                      {v?.nombre || per.vigilanteId}
                    </p>
                  </div>
                </div>
              );
            })}
          <button
            onClick={() => setShowPersonalModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-dashed border-slate-300 text-slate-400 hover:border-primary/40 hover:text-primary transition-colors text-[10px] font-black uppercase"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Editar Personal
          </button>
        </div>
      )}

      {/* ── BARRA DE PERSONALIZACIÓN ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 rounded-[30px] border border-white/5 shadow-2xl mb-8 animate-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-2 px-4 border-r border-white/10 shrink-0">
          <span className="material-symbols-outlined text-indigo-400 text-[20px]">magic_button</span>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            Personalizar Tablero
          </span>
        </div>

        {/* ── Botón: Configurar Turnos del Tablero ── */}
        <div className="relative">
          <button
            onClick={() => setShowTurnosConfig(!showTurnosConfig)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border ${
              showTurnosConfig
                ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                : 'bg-white/5 hover:bg-violet-500/30 text-white border-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Configurar Turnos
            {turnosConfig.length > 0 && (
              <span className="px-1.5 py-0.5 bg-violet-400 rounded-full text-[7px]">{turnosConfig.length}</span>
            )}
          </button>

          {showTurnosConfig && (
            <div className="absolute top-full left-0 mt-3 w-80 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[100] p-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Turnos Activos del Tablero</p>
                <button onClick={() => setShowTurnosConfig(false)} className="size-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-all">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">close</span>
                </button>
              </div>

              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {turnosConfig.map((turno, ti) => (
                  <div key={turno.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="material-symbols-outlined text-[14px] text-indigo-400">schedule</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-white truncate">{turno.nombre}</p>
                      <p className="text-[8px] font-bold text-slate-500">{turno.inicio} → {turno.fin}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (turnosConfig.length <= 1) {
                          showTacticalToast({ title: 'Mínimo 1 Turno', message: 'El tablero debe tener al menos un turno.', type: 'warning' });
                          return;
                        }
                        const newTurnos = turnosConfig.filter((_, i) => i !== ti);
                        usePuestoStore.getState().updatePuesto(puestoId, { turnosConfig: newTurnos });
                        showTacticalToast({ title: 'Turno Eliminado', message: turno.nombre, type: 'success' });
                      }}
                      className="size-6 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-all text-red-400/60 hover:text-red-400"
                      title="Eliminar turno"
                    >
                      <span className="material-symbols-outlined text-[12px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* ── Agregar nuevo turno ── */}
              <div className="border-t border-white/10 pt-3">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Añadir Turno Personalizado</p>
                <AddTurnoForm
                  turnosActuales={turnosConfig}
                  onAdd={(nuevoTurno: TurnoConfig) => {
                    const newTurnos = [...turnosConfig, nuevoTurno];
                    usePuestoStore.getState().updatePuesto(puestoId, { turnosConfig: newTurnos });
                    showTacticalToast({ title: '✅ Turno Añadido', message: nuevoTurno.nombre, type: 'success' });
                  }}
                />
              </div>

              <p className="text-[8px] text-slate-600 mt-3 text-center">
                Los cambios se aplican automáticamente al tablero.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => {
              const nombre = prompt("Nombre de la plantilla:");
              if (nombre)
                guardarComoPlantilla(prog.id, nombre, nombrePuesto, currentUser);
            }}
            className="px-4 py-2 bg-white/5 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border border-white/5"
          >
            <span className="material-symbols-outlined text-[16px]">save</span> Guardar Patrón
          </button>

          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-4 py-2 ${
                showTemplates ? "bg-indigo-600" : "bg-white/5 hover:bg-white/10"
              } text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border border-white/10`}
            >
              <span className="material-symbols-outlined text-[16px]">
                auto_awesome_motion
              </span>{" "}
              Cargar Plantilla
              {templates.length > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-400 rounded-full text-[7px]">
                  {templates.length}
                </span>
              )}
            </button>

            {showTemplates && (
              <div className="absolute top-full left-0 mt-3 w-64 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[100] p-4 animate-in zoom-in-95 duration-200">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">
                  Plantillas Disponibles
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {templates.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic px-2 py-4 text-center">
                      No hay plantillas guardadas
                    </p>
                  ) : (
                    templates.map((tpl: any) => (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          if (
                            confirm(
                              `¿Aplicar plantilla "${tpl.nombre}"? Se sobreescribirán las asignaciones.`
                            )
                          ) {
                            aplicarPlantilla(tpl.id, puestoId, anio, mes, currentUser);
                            setShowTemplates(false);
                            showTacticalToast({
                              title: "✅ Plantilla Aplicada",
                              message: tpl.nombre,
                              type: "success",
                            });
                          }
                        }}
                        className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-indigo-500 transition-all flex items-center justify-between group"
                      >
                        <span className="text-[11px] font-bold text-white uppercase">
                          {tpl.nombre}
                        </span>
                        <span className="material-symbols-outlined text-[14px] text-white/30 group-hover:text-white">
                          file_download
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Estado de sync */}
        <div className="ml-auto hidden lg:flex items-center gap-3 pr-4">
          {prog.syncStatus === "synced" && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Sincronizado
              </span>
            </div>
          )}
          {prog.syncStatus === "pending" && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black text-amber-400/60 uppercase tracking-widest">
                Pendiente de Sync
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── LEYENDA DINÁMICA DEL TABLERO ── */}
      <div className="flex flex-wrap items-center gap-4 mb-4 px-6 py-3 bg-white/40 rounded-2xl border border-slate-100 backdrop-blur-sm shadow-sm">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Turnos de este Puesto:</span>
        {turnosConfig.map(t => (
          <div key={t.id} className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200">
            <div className="size-2.5 rounded-full" style={{ backgroundColor: t.color || '#6366f1' }}></div>
            <span className="text-[10px] font-black text-slate-700 uppercase">{t.nombre}</span>
            <span className="text-[9px] font-bold text-slate-400">{t.inicio}-{t.fin}</span>
          </div>
        ))}
        {turnosConfig.length === 0 && <span className="text-[9px] italic text-slate-400">Sin turnos configurados</span>}
      </div>

      {/* ── GRILLA PRINCIPAL ────────────────────────────────────────────── */}
      <div className="bg-slate-950 rounded-[40px] border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.4)] overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="border-collapse select-none" style={{ width: '100%', tableLayout: 'auto' }}>
            <thead>
              <tr className="h-20 bg-slate-900 border-b-2 border-indigo-500/20">
                <th 
                  className="sticky left-0 z-40 px-6 bg-slate-900 border-r-2 border-indigo-500/30 shadow-[4px_0_15px_rgba(0,0,0,0.5)]"
                  style={{ minWidth: 260, width: 260 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                      <span className="material-symbols-outlined text-white text-[24px] font-black">shield</span>
                    </div>
                    <div className="text-left">
                      <span className="text-[14px] font-black text-white uppercase tracking-tight block leading-tight">Control Operativo</span>
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1 block opacity-80">Dispatcher v3.0</span>
                    </div>
                  </div>
                </th>
                {daysArr.map((d) => {
                  const dayDate = new Date(anio, mes, d);
                  const isSun = dayDate.getDay() === 0;
                  return (
                    <th key={d} className={`text-[11px] font-black uppercase tracking-[0.1em] border-r border-white/5 px-2 relative transition-colors ${isSun ? 'bg-red-500/5' : ''}`} style={{ minWidth: 84, width: 84 }}>
                      <div className="flex flex-col items-center justify-center h-full gap-0.5">
                         <span className={`text-[8px] tracking-widest ${isSun ? 'text-red-400' : 'text-slate-500'}`}>
                           {dayDate.toLocaleDateString('es', {weekday: 'short'}).toUpperCase()}
                         </span>
                         <span className={`text-[16px] tabular-nums ${isSun ? 'text-red-400' : 'text-white/90'}`}>{d}</span>
                         {isSun && <div className="absolute top-0 left-0 w-full h-1 bg-red-500/30" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const personalDefinido = prog.personal || [];
                const rolesBase = ['titular_a', 'titular_b', 'relevante'];
                const rolesDefinidos = personalDefinido.map(p => p.rol);
                const allRoles = Array.from(new Set([...rolesBase, ...rolesDefinidos]));

                return allRoles.map(rol => {
                   const config = personalDefinido.find(p => p.rol === rol);
                   const isNight = ['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => rol.toLowerCase().includes(k));
                   
                    return {
                      rol,
                      vigilanteId: config?.vigilanteId || null,
                      turnoId: config?.turnoId || (isNight ? 'PM' : 'AM')
                    };
                });
              })().map((per: PersonalPuesto, index: number) => {
                const rolLabel = getRolLabel(per.rol);
                const isNightRole = ['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => per.rol.toLowerCase().includes(k) || rolLabel.toLowerCase().includes(k));
                const lookupId = per.turnoId || (isNightRole ? 'PM' : 'AM');
                let turno = turnosConfig.find((tc) => tc.id === lookupId);
                
                if (!turno && turnosConfig.length > 0) {
                    turno = isNightRole ? turnosConfig[turnosConfig.length - 1] : turnosConfig[0];
                }
                
                if (!turno) {
                    turno = DEFAULT_TURNOS.find(dt => dt.id === lookupId) || 
                            (lookupId === 'PM' ? DEFAULT_TURNOS[1] : DEFAULT_TURNOS[0]);
                }
                
                const assignedVig = per.vigilanteId ? (vigilanteMap.get(per.vigilanteId) || "Asignado") : null;
                
                const isActuallyNight = turno.id === 'PM' || 
                                       (turno.inicio && parseInt(turno.inicio.split(':')[0]) >= 16) ||
                                       isNightRole;

                return (
                  <tr 
                    key={`${per.rol}-${index}`} 
                    className="group/row transition-all border-b border-white/5 bg-slate-900/40 hover:bg-indigo-500/[0.03]"
                    style={{ height: 100 }}
                  >
                   <td 
                     className="sticky left-0 z-30 transition-shadow border-r-2 border-indigo-500/20 px-6 bg-slate-900 shadow-[8px_0_30px_rgba(0,0,0,0.6)] group-hover/row:bg-slate-800"
                     style={{ minWidth: 260, width: 260 }}
                   >
                     <div className="flex flex-col gap-2.5">
                       <div className="flex items-center gap-3">
                          {/* Badge de Turno Inteligente */}
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[9px] tracking-[0.1em] uppercase ${
                            isActuallyNight 
                            ? 'bg-slate-950 border-amber-500/30 text-amber-500' 
                            : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                          }`}>
                            <span className="material-symbols-outlined text-[14px] font-black">
                              {isActuallyNight ? 'dark_mode' : 'light_mode'}
                            </span>
                            {isActuallyNight ? 'Noche' : 'Día'}
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <span className="text-[12.5px] font-black uppercase tracking-tight truncate text-white/90 group-hover/row:text-indigo-400">
                              {rolLabel}
                            </span>
                            <div className="flex items-center gap-1.5 opacity-60">
                               <div className="size-1.5 rounded-full" style={{ backgroundColor: turno.color || '#6366f1' }}></div>
                               <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">{turno.nombre}</span>
                            </div>
                          </div>
                       </div>
                       
                       {assignedVig ? (
                          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-emerald-500/[0.05] border-emerald-500/30 shadow-md group-hover/row:border-emerald-500/50 transition-colors">
                             <div className="size-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 border border-emerald-500/30">
                                <span className="material-symbols-outlined text-[13px] font-black">task_alt</span>
                             </div>
                             <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase truncate block text-emerald-200 leading-none">
                                  {typeof assignedVig === 'string' ? assignedVig : assignedVig.nombre}
                                </span>
                             </div>
                          </div>
                       ) : (
                          <div className="flex items-center gap-2.5 px-3 py-2 border border-dashed border-slate-700 bg-slate-800/20 rounded-xl opacity-40">
                             <span className="material-symbols-outlined text-slate-500 text-[14px]">person_off</span>
                             <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-tighter">Sin Guardia Fijo</span>
                          </div>
                       )}
                     </div>
                   </td>

                   {/* Celdas de días por rol */}
                   {daysArr.map((d) => {
                     const asig = (prog.asignaciones || []).find(
                       (a: AsignacionDia) => a.dia === d && a.rol === per.rol
                     ) || { dia: d, turno: per.turnoId || 'AM', jornada: "sin_asignar", rol: per.rol };

                     const dow = new Date(anio, mes, d).getDay();
                     const isWeekend = dow === 0 || dow === 6;

                     return (
                       <td key={d} style={{ padding: 8, minWidth: 84, width: 84 }} className={`border-r border-white/5 transition-colors ${isWeekend ? 'bg-white/[0.02]' : 'group-hover/row:bg-white/[0.03]'}`}>
                         <CeldaCalendario
                           asig={asig}
                           vigilanteNombre={asig.vigilanteId ? (vigilanteMap.get(asig.vigilanteId) || "Asignado") : undefined}
                           onEdit={() => setEditCell({ asig, progId: prog.id, preSelectVigilanteId: per.vigilanteId || undefined })}
                           turnosConfig={turnosConfig}
                           jornadasCustom={jornadasCustom}
                         />
                       </td>
                     );
                   })}
                 </tr>
                );
              })}


              {/* Si no hay personal ni turnos configurados */}
              {!prog.personal?.length && turnosConfig.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth + 1} className="py-24 text-center">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Configura el personal para comenzar el despacho táctico</p>
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>

      <CoordinationPanel
        currentProg={prog}
        freshCProg={freshCProg || null}
        compareVigilanteId={compareVigilanteId}
        setCompareVigilanteId={setCompareVigilanteId}
        showEntireStaff={showEntireStaff}
        setShowEntireStaff={setShowEntireStaff}
        daysArr={daysArr}
        onOpenEdit={(p) => setEditCell({ asig: p.asig, progId: p.progId, preSelectVigilanteId: p.preSelectVigilanteId })}
        hideBusyGuards={hideBusyGuards}
        setHideBusyGuards={setHideBusyGuards}
        compareProgId={compareProgId}
        setCompareProgId={setCompareProgId}
      />

      {showPersonalModal && (
        <GestionPersonalModal
          prog={prog}
          puestoNombre={nombrePuesto}
          turnosConfig={turnosConfig}
          onClose={() => setShowPersonalModal(false)}
          onSave={handleSavePersonal}
        />
      )}
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
            const user = useAuthStore.getState().username || "Operador";
            const result = (useProgramacionStore.getState() as any).actualizarAsignacion(
              editCell.progId,
              editCell.asig.dia,
              data,
              user
            );
            
            // Cerrar el modal inmediatamente después del proceso
            setEditCell(null);

            if (result?.tipo === "bloqueo") {
              showTacticalToast({
                title: "⚠️ Conflicto",
                message: result.mensaje,
                type: "warning",
                duration: 5000,
              });
            } else if (result?.tipo === "advertencia") {
               showTacticalToast({
                title: "✓ Doble Turno Registrado",
                message: "Asignación confirmada con aviso de ocupación previa.",
                type: "success",
                duration: 4000,
              });
            } else {
              showTacticalToast({
                title: "✓ Despacho Exitoso",
                message: "Asignación reflejada en el tablero táctico.",
                type: "success",
              });
            }
          }}
        />
      )}
    </div>
  );
};

// ─── Vista Principal ──────────────────────────────────────────────────────────
const GestionPuestos = () => {
  const username = useAuthStore(s => s.username);
  const puestos = usePuestoStore(s => s.puestos || []);
  const programaciones = useProgramacionStore(s => s.programaciones);
  const isSyncing = useProgramacionStore(s => s.isSyncing);
  const progLoaded = useProgramacionStore(s => s.loaded);
  const puestosLoaded = usePuestoStore(s => s.loaded);
  const loaded = progLoaded && puestosLoaded;

  const fetchProgramacionesByMonth = useProgramacionStore(s => s.fetchProgramacionesByMonth);
  const _fetchBatchDetails = useProgramacionStore(s => s._fetchDetails);

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [busqueda, setBusqueda] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [puestoSeleccionado, setPuestoSeleccionado] = useState<{
    id: string;
    nombre: string;
  } | null>(null);

  useEffect(() => {
    fetchProgramacionesByMonth(anio, mes);
  }, [anio, mes, fetchProgramacionesByMonth]);

  const filteredPuestos = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return puestos;
    return puestos.filter(
      (p) =>
        p?.nombre?.toLowerCase().includes(q) ||
        p?.id?.toLowerCase().includes(q)
    );
  }, [puestos, busqueda]);

  const pagedPuestos = useMemo(() => {
    try {
      return filteredPuestos.slice(0, visibleCount);
    } catch {
      return [];
    }
  }, [filteredPuestos, visibleCount]);

  // Hydration Observer
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      try {
        const programaciones = useProgramacionStore.getState().programaciones;
        const needs = pagedPuestos
          .filter((p) => {
            if (!p) return false;
            const targetId = p.dbId || p.id;
            const found = programaciones.find(
              (pr) =>
                pr.puestoId === targetId &&
                pr.anio === anio &&
                pr.mes === mes
            );
            return found && !found.isDetailLoaded && !found.isFetching;
          })
          .map((p: any) => {
            const targetId = p.dbId || p.id;
            return programaciones.find(
              (pr) =>
                pr.puestoId === targetId &&
                pr.anio === anio &&
                pr.mes === mes
            )!;
          })
          .filter(Boolean);

        if (needs.length > 0) {
          _fetchBatchDetails(needs, needs.map((n) => n.id));
        }
      } catch (err) {
        console.error("[Coraza] âŒ Error en Hydration Observer:", err);
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
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            Gestión <span className="text-primary">Puestos Activos</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.25em]">
            {filteredPuestos.length === 0
              ? "Sin objetivos"
              : `${filteredPuestos.length} objetivos tácticos`}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="h-10 px-4 bg-slate-50 border-none rounded-xl text-[11px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="h-10 w-24 px-4 bg-slate-50 border-none rounded-xl text-[11px] font-black outline-none"
          />
        </div>
      </header>

      {/* LEYENDA DEL TABLERO */}
      <div className="mx-6 mb-4 flex flex-wrap items-center gap-4 bg-white/50 p-3 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-sm">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Leyenda Global:</span>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-blue-600 shadow-sm shadow-blue-200"></div>
          <span className="text-[10px] font-bold text-slate-600 uppercase">Día (D)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-slate-900 shadow-sm shadow-slate-300"></div>
          <span className="text-[10px] font-bold text-slate-600 uppercase">Noche (N)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-[#7c3aed] shadow-sm shadow-indigo-200"></div>
          <span className="text-[10px] font-bold text-slate-600 uppercase">24 Horas (24H)</span>
        </div>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
        <div className="flex items-center gap-1.5">
          <div className="px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-black">DR</div>
          <span className="text-[10px] font-bold text-slate-600 uppercase">D. Remunerado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="px-1.5 py-0.5 rounded bg-violet-500 text-white text-[9px] font-black">VAC</div>
          <span className="text-[10px] font-bold text-slate-600 uppercase">Vacaciones</span>
        </div>
        <div className="ml-auto flex items-center gap-2 pr-2">
           <span className="material-symbols-outlined text-primary text-[14px] animate-pulse">lock</span>
           <span className="text-[9px] font-black text-primary uppercase">Cifrado de Operaciones Activo</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm flex gap-4 items-center">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por nombre, código o ID de puesto..."
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-primary/20 transition-all"
          />
        </div>
      </div>

      {!loaded && !isSyncing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[200px] bg-slate-100 rounded-[40px] border border-slate-200"></div>
          ))}
        </div>
      ) : filteredPuestos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-dashed border-slate-200">
          <span className="material-symbols-outlined text-[48px] text-slate-200 mb-4">
            inventory_2
          </span>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
            No se encontraron puestos.
          </p>
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
                onClick={() =>
                  setPuestoSeleccionado({ id: p.dbId || p.id, nombre: p.nombre })
                }
              />
            );
          })}
        </div>
      )}

      {visibleCount < filteredPuestos.length && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => setVisibleCount((v) => v + 60)}
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
