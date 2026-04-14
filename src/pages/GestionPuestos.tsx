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
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Sub-components
import { CeldaCalendario } from "../components/puestos/CeldaCalendario";
import { EditCeldaModal } from "../components/puestos/EditCeldaModal";
import { PuestoCard } from '../components/puestos/PuestoCard';
import PuestoModal from '../components/puestos/PuestoModal';
import { CoordinationPanel } from "../components/puestos/CoordinationPanel";
import { MasterGrid } from "../components/puestos/MasterGrid";
import { KpiCard } from "../components/dashboard/KpiCard";

// Constants
import {
  DEFAULT_TURNOS,
  DEFAULT_JORNADAS,
  MONTH_NAMES,
} from "../utils/puestosConstants";

// ─── TIPOS DISPONIBLES EN EL SISTEMA ───────────────
const TIPOS_PUESTO = [
  { value: 'hospital', icon: 'local_hospital', color: 'text-blue-500' },
  { value: 'comando', icon: 'local_police', color: 'text-purple-500' },
  { value: 'torre', icon: 'cell_tower', color: 'text-cyan-500' },
  { value: 'edificio', icon: 'domain', color: 'text-slate-400' },
  { value: 'retail', icon: 'shopping_bag', color: 'text-amber-500' },
  { value: 'logistica', icon: 'local_shipping', color: 'text-orange-500' },
  { value: 'banco', icon: 'account_balance', color: 'text-emerald-500' },
  { value: 'puerto', icon: 'sailing', color: 'text-sky-500' },
];

const getPuestoNombre = (prog: any, allPuestos: any[]) => {
    if (!prog || !allPuestos) return "Puesto";
    const pId = prog.puestoId;
    const p = allPuestos.find(px => px.id === pId || px.dbId === pId);
    return p?.nombre || "Puesto Desconocido";
};

const getTipoIcon = (tipo: string) => TIPOS_PUESTO.find(t => t.value === tipo) || TIPOS_PUESTO[3];

const getRolLabel = (rol: string) => {
  const base: Record<string, string> = { titular_a: "Titular A", titular_b: "Titular B", relevante: "Relevante" };
  if (base[rol]) return base[rol];
  if (/^\d+$/.test(rol) || rol.length > 10) return "Rol Personalizado";
  return rol.replace(/_/g, " ").toUpperCase();
};

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

const getRolPdfLabel = (rol: string) => {
  return ROL_PDF_BASE[rol] || rol.replace(/_/g, " ").toUpperCase();
};

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

  const BASE_ROLES: { rol: string; label: string; color: string; icon: string }[] = [
    { rol: "titular_a", label: "Titular A", color: "bg-primary", icon: "shield" },
    { rol: "titular_b", label: "Titular B", color: "bg-indigo-600", icon: "shield_person" },
    { rol: "relevante", label: "Relevante / Backup", color: "bg-slate-600", icon: "groups" },
  ];

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
  const isPuestosLoaded = usePuestoStore(s => s.loaded);

  useEffect(() => {
    // PROTECCIÓN TÁCTICA: Evitar que el sistema entre en pánico si los puestos aún no se han traducido desde la DB
    if (isInitialLoading || !isPuestosLoaded) return;

    if (!prog) {
      (useProgramacionStore.getState() as any).fetchProgramacionesByMonth(anio, mes).then(() => {
        const recheck = getProgramacion(puestoId, anio, mes);
        if (!recheck) {
          crearOObtenerProgramacion(puestoId, anio, mes, currentUser);
        }
      });
    } else if (!prog.isDetailLoaded && !prog.isFetching) {
      fetchProgramacionDetalles(prog.id);
    }
  }, [prog?.id, puestoId, anio, mes, isInitialLoading, isPuestosLoaded]);

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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasChanges = (useProgramacionStore.getState() as any).hasPendingChanges();
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
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

  // ── MAPA DE CONFLICTOS: Detecta doble asignación por vigilante/día ──────
  const conflictMap = useMemo(() => {
    const map = new Map<string, string>(); // key: "vidId-dia" => puestoNombre del conflicto
    if (!prog) return map;
    
    allProgramaciones.forEach(otherProg => {
      if (otherProg.id === prog.id) return;
      if (otherProg.anio !== prog.anio || otherProg.mes !== prog.mes) return;
      
      (otherProg.asignaciones || []).forEach(a => {
        if (a.vigilanteId && a.jornada !== 'sin_asignar') {
          const otherPuesto = getPuestoNombre(otherProg, allPuestos);
          const key = `${a.vigilanteId}-${a.dia}`;
          map.set(key, otherPuesto);
        }
      });
    });
    return map;
  }, [allProgramaciones, allPuestos, prog]);

  // ── ALERTAS ACTIVAS DEL MES ──────────────────────────────────
  const alertas = useMemo(() => {
    if (!prog) return [];
    return (useProgramacionStore.getState() as any).getAlertas(prog.id) || [];
  }, [prog, allProgramaciones]);

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
      const queueSync = (useProgramacionStore as any).__syncQueue;
      if (queueSync) queueSync(prog.id);
      logAction("PROGRAMACION", "Personal Actualizado", `Puesto: ${puestoNombre}`, "success");
    },
    [prog, puestoNombre, logAction]
  );

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
      } catch { }

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

      const pX = pageW - 120;
      doc.setFillColor(255,255,255);
      doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      doc.roundedRect(pX, 5, 112, 31, 3, 3, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));

      doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(155,185,255);
      doc.text("PUESTO / OBJETIVO:", pX+4, 12);
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(255,255,255);
      doc.text(puestoNombre.toUpperCase().slice(0, 44), pX+4, 19);
      doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(155,185,255);
      doc.text("DIRECCIÓN:", pX+4, 26);
      doc.setTextColor(215,230,255);
      doc.text((puesto?.direccion || "—").slice(0, 44), pX+24, 26);
      doc.setTextColor(140,165,220); doc.setFontSize(5.5);
      doc.text(`Impreso: ${fechaActual}`, pX+4, 33);

      const centerX = (42 + pX - 4) / 2;

      doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(12);
      doc.text("CUADRO DE PROGRAMACIÓN MENSUAL", centerX, 11, { align: "center" });

      doc.setFont("helvetica","normal"); doc.setFontSize(6.2); doc.setTextColor(170,195,255);
      doc.text(
        "COOPERATIVA DE VIGILANCIA Y SEGURIDAD PRIVADA CORAZA C.T.A  —  NIT: 901.509.121",
        centerX, 17, { align: "center", maxWidth: pX - 4 - 42 }
      );

      doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(255,255,255);
      doc.text(`${MONTH_NAMES[mes].toUpperCase()}  ${anio}`, 44, 30);

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
        let finalContent = code;
        
        if (code === "D" || code === "N" || code === "24") {
          const isNight = ['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => (a.rol || "").toLowerCase().includes(k)) || a.turno === 'PM';
          const rCode = code === "24" ? "24" : (isNight ? "N" : "D");
          
          let tInicio = "06";
          let tFin = code === "24" ? "06" : "18";
          
          if (isNight && code !== "24") {
             tInicio = "18"; tFin = "06";
          }
          
          if (a.inicio) tInicio = a.inicio.slice(0, 5).replace(":00", "");
          if (a.fin) tFin = a.fin.slice(0, 5).replace(":00", "");

          finalContent = `${rCode}\n${tInicio}-${tFin}`;
        }
        
        vigDataMap.get(a.vigilanteId)!.asigs.set(a.dia, finalContent);
      });

      const vigEntries = Array.from(vigDataMap.entries());

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
          const isDR = code === "DR";
          const isDNR = code === "DNR";
          const isVAC = code === "VAC";
          
          if (code && !isDR && !isDNR && !isVAC && code !== "-") trab++;
          else if (isDR || isDNR) desc++;
          else if (isVAC) vac++;
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
            const val = raw.split("\n")[0];
            
            const dIdx = data.column.index - 3;
            const dow = dIdx >= 0 && dIdx < days.length ? new Date(anio, mes, days[dIdx]).getDay() : -1;
            
            if (!val && (dow === 0 || dow === 6)) {
              data.cell.styles.fillColor = [220, 228, 240];
              return;
            }

            const tConf = turnosConfig.find(t => t.id === val || t.nombre === val);
            if (tConf && tConf.color) {
              const hex = tConf.color.replace('#', '');
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              data.cell.styles.fillColor = [r, g, b];
              const brightness = (r * 299 + g * 587 + b * 114) / 1000;
              const textRgb = brightness > 128 ? [30, 41, 59] : [255, 255, 255];
              data.cell.styles.textColor = textRgb as [number, number, number];
              data.cell.styles.fontStyle = "bold";
              return;
            }

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
      try {
        const wb = new ExcelJS.Workbook();
        const sheetName = (puestoNombre || "Puesto").slice(0, 31).replace(/[[\]*/\\?:]/g, '');
        const ws = wb.addWorksheet(sheetName);

        const CLR_VERDE_MES = '4ADE80'; 
        const CLR_D12 = 'FFB547';     
        const CLR_N12 = '3B82F6';     
        const CLR_NR  = 'EF4444';     
        const CLR_X   = 'FACC15';     
        const CLR_VAC = 'F472B6';     

        const borderThin = {
          top: { style: 'thin' as const, color: { argb: '000000' } },
          left: { style: 'thin' as const, color: { argb: '000000' } },
          bottom: { style: 'thin' as const, color: { argb: '000000' } },
          right: { style: 'thin' as const, color: { argb: '000000' } }
        };

        const getTacticalCode = (a: AsignacionDia): string => {
          const isUnassigned = a.jornada === 'sin_asignar' || !a.jornada;
          if (isUnassigned) return '-';
          
          if (a.codigo_personalizado) return a.codigo_personalizado;
          if (a.jornada === 'descanso_remunerado') return 'X';
          if (a.jornada === 'descanso_no_remunerado') return 'NR';
          if (a.jornada === 'vacacion') return 'VAC';
          if (a.jornada === 'AM' || a.jornada === 'D') return 'D12';
          if (a.jornada === 'PM' || a.jornada === 'N') return 'N12';
          if (a.jornada === '24H') return '24';
          
          if (a.jornada === 'normal') {
             const isNightRole = ['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => (a.rol || "").toLowerCase().includes(k)) || a.turno === 'PM';
             return isNightRole ? 'N12' : 'D12';
          }
          return a.jornada;
        };

        const getCodeColor = (code: string): string | null => {
          if (code === '-') return 'EF4444'; // Rojo fuerte para huecos
          if (code === 'D12') return CLR_D12;
          if (code === 'N12') return CLR_N12;
          if (code === 'NR')  return CLR_NR;
          if (code === 'X')   return CLR_X;
          if (code === 'VAC') return CLR_VAC;
          return null;
        };

        // --- MAPEO DE FILAS (Fiel al Tablero) ---
        const rowsToExport = new Map<string, any>();
        
        // 1. Cargamos roles del personal definido (titulares)
        (prog.personal || []).forEach(p => {
          const v = vigilantes.find(vx => vx.id === p.vigilanteId || vx.dbId === p.vigilanteId);
          rowsToExport.set(p.rol, {
            rol: p.rol,
            cedula: v?.cedula || "—",
            nombre: (v?.nombre || "SIN ASIGNAR").toUpperCase(),
            asigs: new Map()
          });
        });

        // 2. Cargamos asignaciones (para incluir relevos o detectar códigos)
        (prog.asignaciones || []).forEach((a: AsignacionDia) => {
          if (!a.rol) return;
          if (!rowsToExport.has(a.rol)) {
            const v = vigilantes.find(vx => vx.id === a.vigilanteId || vx.dbId === a.vigilanteId);
            rowsToExport.set(a.rol, {
              rol: a.rol,
              cedula: v?.cedula || "—",
              nombre: (v?.nombre || "SIN ASIGNAR").toUpperCase(),
              asigs: new Map()
            });
          }
          rowsToExport.get(a.rol).asigs.set(a.dia, getTacticalCode(a));
        });

        const sortedRows = Array.from(rowsToExport.values()).sort((a,b) => {
          const ROLES: Record<string, number> = { 'titular_a': 0, 'titular_b': 1, 'relevante': 2 };
          return (ROLES[a.rol] ?? 99) - (ROLES[b.rol] ?? 99);
        });

        // --- CONSTRUCCIÓN EXCEL ---
        
        // --- ENCABEZADO CORPORATIVO ---
        ws.mergeCells('A1', 'C1');
        const headTitle = ws.getCell('A1');
        headTitle.value = 'CORAZA SEGURIDAD PRIVADA CTA';
        headTitle.font = { name: 'Arial Narrow', size: 14, bold: true, color: { argb: '4318FF' } };
        
        ws.mergeCells('A2', 'C2');
        const headNit = ws.getCell('A2');
        headNit.value = 'NIT: 901509121';
        headNit.font = { name: 'Arial Narrow', size: 10, bold: true };

        ws.mergeCells('A3', 'C3');
        const headAddr = ws.getCell('A3');
        headAddr.value = 'Carrera 81 #49-24 Medellín | Tel: 311 383 6939';
        headAddr.font = { name: 'Arial Narrow', size: 9 };

        ws.mergeCells('A4', 'C4');
        const headPuesto = ws.getCell('A4');
        headPuesto.value = `PUESTO: ${puestoNombre.toUpperCase()}`;
        headPuesto.font = { name: 'Arial Narrow', size: 11, bold: true };
        headPuesto.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

        // Fila 5: Barra Mes
        ws.mergeCells(`A5:${String.fromCharCode(65 + 3 + daysInMonth + 4)}5`);
        const monthCell = ws.getCell('A5');
        monthCell.value = MONTH_NAMES[mes].toUpperCase();
        monthCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLR_VERDE_MES } };
        monthCell.font = { name: 'Arial Narrow', size: 10, bold: true };
        monthCell.alignment = { horizontal: 'center' };
        ws.getRow(5).height = 18;

        // Fila 6: Letras de Día (Dow)
        const dowNames = ['D','L','M','W','J','V','S'];
        const dayNameRow = ws.getRow(6);
        daysArr.forEach((d, i) => {
           const dt = new Date(anio, mes, d);
           const cell = dayNameRow.getCell(4 + i);
           cell.value = dowNames[dt.getDay()];
           cell.font = { name: 'Arial Narrow', size: 8, bold: true };
           cell.alignment = { horizontal: 'center' };
           cell.border = borderThin;
        });

        // Fila 7: Números
        const dayNumRow = ws.getRow(7);
        daysArr.forEach((d, i) => {
          const cell = dayNumRow.getCell(4 + i);
          cell.value = d;
          cell.font = { name: 'Arial Narrow', size: 8, bold: true };
          cell.alignment = { horizontal: 'center' };
          cell.border = borderThin;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        });

        // Fila 8: Cabeceras
        const hRow = ws.getRow(8);
        hRow.height = 18;
        const mainHeaders = ['ROL', 'CÉDULA', 'NOMBRE DE GUARDA'];
        mainHeaders.forEach((v, i) => {
          const cell = hRow.getCell(i+1);
          cell.value = v;
          cell.font = { name: 'Arial Narrow', size: 9, bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = borderThin;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
        });

        // Totales Headers
        const lastColIdx = 4 + daysInMonth;
        ['TRAB', 'DESC', 'NR', 'VAC'].forEach((v, i) => {
            const cell = hRow.getCell(lastColIdx + i);
            cell.value = v;
            cell.font = { name: 'Arial Narrow', size: 8, bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = borderThin;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
        });

        const ROL_LABELS: Record<string, string> = {
            'titular_a': 'TIT-A',
            'titular_b': 'TIT-B',
            'relevante': 'REL',
        };

        // Filas de Datos
        sortedRows.forEach((row, ri) => {
          const exRow = ws.getRow(9 + ri);
          exRow.height = 16;

          // ROL
          const c0 = exRow.getCell(1);
          c0.value = ROL_LABELS[row.rol] || row.rol.toUpperCase();
          c0.font = { name: 'Arial Narrow', size: 7, bold: true };
          c0.alignment = { horizontal: 'center' };
          c0.border = borderThin;

          // Cédula
          const c2 = exRow.getCell(2);
          c2.value = row.cedula;
          c2.font = { name: 'Arial Narrow', size: 8 };
          c2.alignment = { horizontal: 'center' };
          c2.border = borderThin;

          // Nombre
          const c3 = exRow.getCell(3);
          c3.value = row.nombre;
          c3.font = { name: 'Arial Narrow', size: 8 };
          c3.border = borderThin;

          // Días & Totales
          let tT = 0, tD = 0, tNR = 0, tV = 0;

          daysArr.forEach((d, di) => {
            const cell = exRow.getCell(4 + di);
            const code = row.asigs.get(d) || "";
            cell.value = code;
            cell.font = { name: 'Arial Narrow', size: 7, bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = borderThin;

            const color = getCodeColor(code);
            if (color) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            }

            if (['D12', 'N12', '24'].includes(code)) tT++;
            else if (code === 'X') tD++;
            else if (code === 'NR') tNR++;
            else if (code === 'VAC') tV++;
          });

          // Summary cells
          [tT, tD, tNR, tV].forEach((val, vi) => {
              const cell = exRow.getCell(lastColIdx + vi);
              cell.value = val || '';
              cell.font = { name: 'Arial Narrow', size: 8, bold: true };
              cell.alignment = { horizontal: 'center' };
              cell.border = borderThin;
          });
        });

        ws.getColumn(1).width = 10;
        ws.getColumn(2).width = 14;
        ws.getColumn(3).width = 40;
        daysArr.forEach((_, i) => { ws.getColumn(4 + i).width = 3.5; });
        [0,1,2,3].forEach((i) => ws.getColumn(lastColIdx + i).width = 6);

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CUADRO_TACTICO_${(puestoNombre||"P").replace(/\s+/g,"_")}_${MONTH_NAMES[mes]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);

        showTacticalToast({ title:"💎 Excel Generado", message:`Fiel reflejo del tablero táctico.`, type:"success" });
      } catch (err: any) {
        console.error("EXCEL ERROR:", err);
        showTacticalToast({ title:"❌ Error", message:"No se pudo procesar el archivo.", type:"error" });
      } finally {
        setIsGeneratingPDF(false);
      }
    }, [prog, puestoNombre, mes, anio, daysArr, vigilantes, logAction]);

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

          <button
            onClick={() => prog?.id && guardarBorrador(prog.id, currentUser)}
            disabled={!prog?.id}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>{" "}
            Borrador
          </button>

          <button
            onClick={() => prog?.id && publicarProgramacion(prog.id, currentUser)}
            disabled={!prog?.id}
            className="px-6 py-2.5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>{" "}
            Publicar
          </button>

          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border min-w-[120px] justify-center ${
            (prog?.syncStatus || 'synced') === 'error' ? 'bg-rose-50 border-rose-200' : 'bg-slate-100 border-slate-200'
          }`}>
            {isSyncing ? (
              <>
                <div className="size-2 bg-indigo-500 rounded-full animate-ping" />
                <span className="text-[9px] font-black text-indigo-600 uppercase">Sincronizando...</span>
              </>
            ) : (prog?.syncStatus || 'synced') === 'error' ? (
              <>
                <span className="material-symbols-outlined text-rose-500 text-[16px]">cloud_off</span>
                <span className="text-[9px] font-black text-rose-600 uppercase">Error de Sync</span>
                <button 
                  onClick={() => useProgramacionStore.getState().resumePendingSyncs()}
                  className="ml-1 px-2 py-0.5 bg-rose-100 hover:bg-rose-200 rounded-lg text-[8px] font-black text-rose-700 uppercase transition-all"
                >
                  Reintentar
                </button>
              </>
            ) : (prog?.syncStatus || 'synced') === 'pending' ? (
              <>
                <div className="size-2 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-amber-600 uppercase">Pendiente...</span>
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

      {/* ── PANEL DE ALERTAS DEL MES ── */}
      {alertas.length > 0 && (
        <div className="mb-6 px-5 py-4 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-3xl shadow-sm animate-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-8 rounded-xl bg-rose-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-rose-500 text-[20px]">notification_important</span>
            </div>
            <span className="text-[10px] font-black text-rose-700 uppercase tracking-[0.2em]">Alertas del Mes ({alertas.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {alertas.map((a: string, i: number) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white/80 rounded-xl border border-rose-100">
                <span className={`material-symbols-outlined text-[14px] ${
                  a.includes('conflicto') ? 'text-rose-500' : 
                  a.includes('descanso') ? 'text-amber-500' : 'text-slate-400'
                }`}>
                  {a.includes('conflicto') ? 'warning' : 
                   a.includes('descanso') ? 'event_busy' : 'info'}
                </span>
                <span className="text-[10px] font-bold text-slate-700">{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {staffAsignado.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {(prog?.personal || [])
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

      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 rounded-[30px] border border-white/5 shadow-2xl mb-8 animate-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-2 px-4 border-r border-white/10 shrink-0">
          <span className="material-symbols-outlined text-primary-light text-[20px]">magic_button</span>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            Personalizar Tablero
          </span>
        </div>

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
                    <span className="material-symbols-outlined text-[14px] text-primary-light">schedule</span>
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
              {nombre && prog?.id && (
                guardarComoPlantilla(prog.id, nombre, nombrePuesto, currentUser)
              )}
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

        <div className="ml-auto hidden lg:flex items-center gap-3 pr-4">
          {(prog?.syncStatus || 'synced') === "synced" && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Sincronizado
              </span>
            </div>
          )}
          {(prog?.syncStatus || 'synced') === "pending" && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black text-amber-400/60 uppercase tracking-widest">
                Pendiente de Sync
              </span>
            </div>
          )}
        </div>
      </div>

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

      <div className="bg-slate-950 rounded-[40px] border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.4)] overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="border-collapse select-none" style={{ width: 'max-content', tableLayout: 'fixed' }}>
            <thead>
              <tr className="h-28 bg-slate-950 border-b-2 border-amber-500/40 shadow-2xl">
                <th 
                  className="sticky left-0 z-40 px-8 bg-slate-900 border-r-2 border-amber-500/30 shadow-[10px_0_40px_rgba(0,0,0,0.7)]"
                  style={{ width: 360 }}
                >
                  <div className="flex items-center gap-5">
                    <div className="size-16 rounded-[22px] bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)] border border-amber-300/30">
                      <span className="material-symbols-outlined text-white text-[32px] font-black">security</span>
                    </div>
                    <div className="text-left">
                      <span className="text-[18px] font-black text-white uppercase tracking-tighter block leading-tight">Mando Operativo</span>
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mt-1.5 block opacity-90 animate-pulse">Tactical Elite v4.0</span>
                    </div>
                  </div>
                </th>
                {daysArr.map((d) => {
                  const dayDate = new Date(anio, mes, d);
                  const isSun = dayDate.getDay() === 0;
                  return (
                    <th key={d} className={`text-[13px] font-black uppercase tracking-[0.1em] border-r border-white/5 px-2 relative transition-all ${isSun ? 'bg-red-500/20' : 'hover:bg-white/[0.05]'}`} style={{ width: 130 }}>
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                         <span className={`text-[10px] tracking-widest font-black ${isSun ? 'text-red-400' : 'text-slate-500'}`}>
                           {dayDate.toLocaleDateString('es', {weekday: 'short'}).toUpperCase()}
                         </span>
                         <span className={`text-[22px] font-black tabular-nums ${isSun ? 'text-red-400' : 'text-white'}`}>{d}</span>
                         {isSun && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const personalDefinido = (prog?.personal || []);
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
                    className="group/row transition-all border-b border-white/5 bg-slate-900/60 hover:bg-amber-500/[0.04]"
                    style={{ height: 120 }}
                  >
                   <td 
                     className="sticky left-0 z-30 transition-all border-r-2 border-amber-500/10 px-8 bg-slate-900 shadow-[10px_0_40px_rgba(0,0,0,0.8)] group-hover/row:bg-slate-800"
                     style={{ width: 360 }}
                   >
                     <div className="flex flex-col gap-3.5">
                       <div className="flex items-center gap-4">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 font-black text-[10px] tracking-[0.15em] uppercase shadow-lg ${
                            isActuallyNight 
                            ? 'bg-slate-950 border-amber-500/40 text-amber-500 shadow-amber-500/10' 
                            : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-indigo-500/10'
                          }`}>
                            <span className="material-symbols-outlined text-[18px] font-black">
                              {isActuallyNight ? 'brightness_3' : 'wb_sunny'}
                            </span>
                            {isActuallyNight ? 'Noche' : 'Día'}
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <span className="text-[15px] font-black uppercase tracking-tight truncate text-white group-hover/row:text-amber-400 transition-colors">
                              {rolLabel}
                            </span>
                            <div className="flex items-center gap-2 opacity-80">
                               <div className="size-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: turno.color || '#6366f1', color: turno.color || '#6366f1' }}></div>
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{turno.nombre}</span>
                            </div>
                          </div>
                       </div>
                       
                       {assignedVig ? (
                          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 bg-emerald-500/[0.08] border-emerald-500/40 shadow-[0_5px_15px_rgba(16,185,129,0.15)] group-hover/row:border-emerald-500/70 transition-all transform group-hover/row:scale-[1.02]">
                             <div className="size-8 rounded-xl bg-emerald-500/30 flex items-center justify-center text-emerald-400 border border-emerald-500/40 shadow-inner">
                                <span className="material-symbols-outlined text-[16px] font-black">verified_user</span>
                             </div>
                             <div className="min-w-0">
                                <span className="text-[11px] font-black uppercase truncate block text-white tracking-wide">
                                  {typeof assignedVig === 'string' ? assignedVig : assignedVig.nombre}
                                </span>
                                <span className="text-[8px] font-black text-emerald-400/70 uppercase tracking-widest">Personal Activo</span>
                             </div>
                          </div>
                       ) : (
                          <div className="flex items-center gap-3 px-4 py-2.5 border-2 border-dashed border-slate-700 bg-slate-800/30 rounded-2xl opacity-50 group-hover/row:opacity-80 transition-opacity">
                             <span className="material-symbols-outlined text-slate-500 text-[20px]">person_add</span>
                             <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Vacante Operativa</span>
                          </div>
                       )}
                     </div>
                   </td>

                   {daysArr.map((d) => {
                     const asig = (prog?.asignaciones || []).find(
                       (a: AsignacionDia) => a.dia === d && a.rol === per.rol
                     ) || { dia: d, turno: per.turnoId || 'AM', jornada: "sin_asignar", rol: per.rol };

                     const dow = new Date(anio, mes, d).getDay();
                     const isWeekend = dow === 0 || dow === 6;

                     // Detectar conflicto: mismo vigilante asignado en otro puesto ese día
                     const hasConflict = asig.vigilanteId && asig.jornada !== 'sin_asignar'
                       ? conflictMap.has(`${asig.vigilanteId}-${d}`)
                       : false;
                     const conflictDetail = hasConflict 
                       ? conflictMap.get(`${asig.vigilanteId}-${d}`) || ''
                       : '';

                     return (
                       <td key={d} style={{ padding: 10, width: 130 }} className={`border-r border-white/5 transition-all outline-none ${isWeekend ? 'bg-white/[0.04]' : 'group-hover/row:bg-white/[0.08]'}`}>
                         <CeldaCalendario
                           asig={asig}
                           vigilanteNombre={asig.vigilanteId ? (vigilanteMap.get(asig.vigilanteId) || "Asignado") : undefined}
                           onEdit={() => setEditCell({ asig, progId: prog?.id || '', preSelectVigilanteId: per.vigilanteId || undefined })}
                           turnosConfig={turnosConfig}
                           jornadasCustom={jornadasCustom}
                           hasConflict={hasConflict}
                           conflictDetail={conflictDetail}
                           syncStatus={prog?.syncStatus || 'synced'}
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

      <CoordinationPanel
        currentProg={freshCProg || null}
        freshCProg={prog}
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
          titulares={prog?.personal || []}
          ocupados={ocupadosMap}
          turnosConfig={turnosConfig}
          jornadasCustom={jornadasCustom}
          initialVigilanteId={editCell.preSelectVigilanteId}
          diaLabel={(() => {
            const d = new Date(anio, mes, editCell.asig.dia);
            return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric' });
          })()}
          onClose={() => setEditCell(null)}
          onSave={(data) => {
            const user = useAuthStore.getState().username || "Operador";
            const result = (useProgramacionStore.getState() as any).actualizarAsignacion(
              editCell.progId,
              editCell.asig.dia,
              data,
              user
            );
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

const GestionPuestos = () => {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'cards' | 'master_grid'>('cards');
  const [isNewPuestoModalOpen, setIsNewPuestoModalOpen] = useState(false);
  const [puestoToEdit, setPuestoToEdit] = useState<any>(null);
  const [selectedPuesto, setSelectedPuesto] = useState<any>(null);

  const { puestos, fetchPuestos, loaded: puestosLoaded } = usePuestoStore();
  const { programaciones, fetchProgramaciones, loaded: progLoaded } = useProgramacionStore();
  const { vigilantes, fetchVigilantes } = useVigilanteStore();

  const isInitialLoading = !puestosLoaded || !progLoaded;

  useEffect(() => {
    const bootstrap = async () => {
      await fetchVigilantes();
      await fetchPuestos();
      await fetchProgramaciones();
    };
    bootstrap();
  }, [fetchPuestos, fetchProgramaciones, fetchVigilantes]);

  const [filterTab, setFilterTab] = useState<'todos' | 'alerta' | 'sin_personal' | 'publicados'>('todos');
  const [visibleCount, setVisibleCount] = useState(60);
  
  const filteredPuestos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const store = useProgramacionStore.getState();
    let base = (puestos || []).filter(p => (p as any).estado !== 'inactivo');
    if (q) {
      base = base.filter(p => 
        p.nombre?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        (p as any).direccion?.toLowerCase().includes(q)
      );
    }
    if (filterTab === 'alerta') {
      base = base.filter(p => {
        const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
        if (!prog?.id) return false;
        return (store.getAlertas(prog.id) || []).length > 0;
      });
    } else if (filterTab === 'sin_personal') {
      base = base.filter(p => {
        const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
        return !prog?.personal || prog.personal.filter((x: any) => x.vigilanteId).length === 0;
      });
    } else if (filterTab === 'publicados') {
      base = base.filter(p => {
        const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
        return prog?.estado === 'publicado';
      });
    }
    return base;
  }, [puestos, searchQuery, filterTab, anio, mes]);

  const pagedPuestos = useMemo(() => filteredPuestos.slice(0, visibleCount), [filteredPuestos, visibleCount]);

  if (selectedPuesto) {
    return (
      <PanelMensualPuesto
        puestoId={selectedPuesto.dbId || selectedPuesto.id}
        puestoNombre={selectedPuesto.nombre}
        anio={anio}
        mes={mes}
        onClose={() => setSelectedPuesto(null)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#050b16]">
      <header className="bg-[#0a1120] text-white px-10 py-6 border-b border-white/5 shrink-0 flex items-center justify-between shadow-2xl z-30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/5 blur-[100px] pointer-events-none"></div>
        
        <div className="flex items-center gap-8 flex-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="size-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_#4318ff]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">SISTEMA DE CONTROL TÁCTICO</span>
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none italic flex items-baseline gap-3">
              GESTIÓN <span className="text-primary text-[28px] not-italic">DE</span> <span className="bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent not-italic">PUESTOS</span>
            </h1>
          </div>

          <div className="flex items-center bg-black/50 border border-white/5 rounded-3xl p-1 ml-6 shadow-2xl backdrop-blur-xl">
            <button 
              onClick={() => { const d = new Date(anio, mes - 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="p-3 text-slate-500 hover:text-white transition-all transform active:scale-90"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
            </button>
            <div className="px-5 py-0.5 text-center min-w-[130px] border-x border-white/5">
              <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-0">{anio}</p>
              <p className="text-[16px] font-black text-white uppercase tracking-[0.1em] italic">{MONTH_NAMES[mes]}</p>
            </div>
            <button 
              onClick={() => { const d = new Date(anio, mes + 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="p-3 text-slate-500 hover:text-white transition-all transform active:scale-90"
            >
              <span className="material-symbols-outlined text-2xl">arrow_forward_ios</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex bg-black/40 border border-white/5 rounded-3xl p-1.5 shadow-xl">
            <button 
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'cards' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              <span>CARPETAS</span>
            </button>
            <button 
              onClick={() => setViewMode('master_grid')}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'master_grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span>MAESTRO</span>
            </button>
          </div>

          <button 
            onClick={() => setIsNewPuestoModalOpen(true)}
            className="flex items-center gap-3 bg-white text-black h-[54px] px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shadow-2xl relative overflow-hidden group"
          >
            <span className="material-symbols-outlined text-[20px]">add_location</span>
            <span>Nuevo Objetivo</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col" style={{ background: '#050b16' }}>
        {viewMode === 'cards' ? (
          <div className="flex-1 flex flex-col overflow-hidden px-10 pt-8 pb-8">
            {/* ═══ STAT CARDS ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 shrink-0">
               <KpiCard
                  label="Total Puestos"
                  value={(puestos||[]).filter(p=>(p as any).estado!=='inactivo').length}
                  icon="shield"
                  color="indigo"
                  sub="Red Operativa Activa"
                  trend="neutral"
                  trendValue="0"
                  detail="Capacidad total instalada"
               />
               <KpiCard
                  label="Cubiertos"
                  value={(puestos||[]).filter(p=>(p as any).estado==='cubierto').length}
                  icon="verified_user"
                  color="emerald"
                  sub="Personal en Servicio"
                  trend="up"
                  trendValue="+2"
                  detail="Personal con puesto asignado"
               />
               <KpiCard
                  label="Con Alertas"
                  value={programaciones.filter(pg => pg.anio===anio && pg.mes===mes && ((useProgramacionStore.getState() as any).getAlertas(pg.id)||[]).length>0).length}
                  icon="priority_high"
                  color="red"
                  sub="Atención Crítica"
                  trend="down"
                  trendValue="-5"
                  detail="Conflictos o vacantes críticas"
               />
               <KpiCard
                  label="Sin Asignar"
                  value={programaciones.filter(pg => pg.anio===anio && pg.mes===mes && pg.personal.filter((x:any)=>x.vigilanteId).length===0).length}
                  icon="person_search"
                  color="amber"
                  sub="Pendiente Despacho"
                  trend="neutral"
                  trendValue="--"
                  detail="Objetivos sin nómina asignada"
               />
            </div>

            {/* ═══ SEARCH + FILTERS TOOLBAR ═══ */}
            <div className="flex flex-col xl:flex-row gap-4 mb-8 shrink-0">

              {/* Ultra Elite Tactical Search Bar */}
              <div className="relative flex-1 group z-10 w-full max-w-3xl">
                {/* Neon Back-Glow Effect */}
                <div
                  className="absolute -inset-1 rounded-[20px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-primary/0 opacity-0 group-focus-within:opacity-100 blur-xl transition-all duration-700 pointer-events-none"
                />
                
                {/* Tech Frame Base */}
                <div className="relative flex items-center h-[60px] rounded-[18px] bg-black/40 backdrop-blur-2xl border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 group-focus-within:border-indigo-500/50 group-focus-within:bg-indigo-950/20 group-hover:border-white/10 group-focus-within:shadow-[0_0_30px_rgba(99,102,241,0.2),inset_0_0_20px_rgba(99,102,241,0.1)]">
                  
                  {/* Left Icon Area - Tactical HUD style */}
                  <div className="relative flex items-center justify-center w-16 h-full border-r border-white/5 bg-white/[0.02] group-focus-within:bg-indigo-500/10 group-focus-within:border-indigo-500/30 transition-all duration-500 shrink-0">
                    <span className="material-symbols-outlined text-[24px] text-slate-500 group-focus-within:text-indigo-400 group-focus-within:drop-shadow-[0_0_8px_rgba(129,140,248,0.8)] transition-all duration-500">
                      radar
                    </span>
                    {/* Animated scanning line on focus */}
                    <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-indigo-500 opacity-0 group-focus-within:opacity-100 group-focus-within:shadow-[0_0_10px_#6366f1] transition-opacity duration-300" />
                  </div>

                  {/* Input Field */}
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="LOCALIZAR PUESTO O CÓDIGO TÁCTICO..."
                    className="w-full h-full bg-transparent border-none outline-none px-5 font-black text-white text-[13px] tracking-[0.15em] uppercase placeholder:text-slate-600 placeholder:font-bold placeholder:tracking-widest transition-all duration-300"
                  />
                  
                  {/* Status Indicator (Right side inside) */}
                  {!searchQuery && (
                    <div className="hidden sm:flex items-center gap-2 pr-5 pointer-events-none opacity-50 group-focus-within:opacity-100 transition-opacity">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-sm bg-slate-600 group-focus-within:bg-indigo-500 group-focus-within:animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-sm bg-slate-700 group-focus-within:bg-indigo-500/60 group-focus-within:animate-pulse delay-75" />
                        <div className="w-1.5 h-1.5 rounded-sm bg-slate-800 group-focus-within:bg-indigo-500/30 group-focus-within:animate-pulse delay-150" />
                      </div>
                      <span className="text-[9px] font-black tracking-[0.3em] text-slate-500 group-focus-within:text-indigo-400 uppercase">Input</span>
                    </div>
                  )}

                  {/* Clear Button */}
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all duration-300 hover:shadow-[0_0_15px_rgba(244,63,94,0.5)] border border-rose-500/20 animate-in fade-in zoom-in"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                  
                  {/* Bottom animated border line representing connection */}
                  <div className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full opacity-0 group-focus-within:opacity-100 scale-x-0 group-focus-within:scale-x-100 transition-all duration-700 ease-out origin-left" />
                </div>
              </div>

              {/* Filter Pills with Result Counter */}
              <div
                className="flex flex-col sm:flex-row gap-2 p-1.5"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                  backdropFilter: 'blur(30px)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
                }}
              >
                {[
                  { id: 'todos',        label: 'TODOS',      icon: 'apps',       accent: '#5B6EE8' },
                  { id: 'alerta',       label: 'ALERTAS',    icon: 'bolt',       accent: '#FF4C4C' },
                  { id: 'sin_personal', label: 'VACÍOS',     icon: 'person_off', accent: '#F5A623' },
                  { id: 'publicados',   label: 'OPERATIVOS', icon: 'verified',   accent: '#00C97B' },
                ].map(t => {
                   const count = (t.id === 'todos') ? (puestos||[]).filter(p=>(p as any).estado!=='inactivo').length : 
                                 (t.id === 'alerta') ? filteredPuestos.filter(p => {
                                   const store = useProgramacionStore.getState();
                                   const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
                                   return prog?.id && (store.getAlertas(prog.id) || []).length > 0;
                                 }).length :
                                 (t.id === 'sin_personal') ? filteredPuestos.filter(p => {
                                   const store = useProgramacionStore.getState();
                                   const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
                                   return !prog?.personal || prog.personal.filter((x: any) => x.vigilanteId).length === 0;
                                 }).length : 
                                 filteredPuestos.filter(p => {
                                   const store = useProgramacionStore.getState();
                                   const prog = store.getProgramacionRapid?.(p.id || p.dbId, anio, mes);
                                   return prog?.estado === 'publicado';
                                 }).length;

                   return (
                      <button
                        key={t.id}
                        onClick={() => setFilterTab(t.id as any)}
                        className="relative flex items-center justify-between gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all duration-300"
                        style={filterTab === t.id ? {
                          background: `${t.accent}15`,
                          border: `1px solid ${t.accent}40`,
                          color: t.accent,
                          boxShadow: `0 4px 16px ${t.accent}10`
                        } : {
                          color: '#64748b'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                          <span className="hidden lg:inline">{t.label}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black ${filterTab === t.id ? 'bg-white text-black' : 'bg-white/5 text-slate-500'}`}>
                          {count}
                        </span>
                      </button>
                   );
                })}
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => useProgramacionStore.getState().forceSync()}
                disabled={!progLoaded}
                className="group relative flex items-center gap-3 px-6 py-2.5 text-[11px] font-black uppercase tracking-widest overflow-hidden transition-all duration-500 disabled:opacity-30"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(0,0,0,0.2))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  backdropFilter: 'blur(20px)',
                  color: '#475569'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#818cf8'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.35)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <span className="material-symbols-outlined text-[20px] transition-transform duration-700 group-hover:rotate-180">sync</span>
                <span className="hidden xl:inline">ACTUALIZAR</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              {isInitialLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="h-48 rounded-[35px] bg-white/[0.02]" />
                  ))}
                </div>
              ) : pagedPuestos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-white/5 rounded-[35px] bg-black/20 animate-in fade-in duration-1000">
                  <div className="relative mb-8">
                     <div className="absolute -inset-4 bg-indigo-500/10 blur-2xl rounded-full animate-pulse" />
                     <span className="material-symbols-outlined text-[64px] text-slate-800 relative z-10 font-thin">scanning</span>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 italic">Señal Perdida</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-center max-w-[300px] leading-relaxed mb-8">
                    El Centro de Mando no identifica objetivos activos con el filtro actual.
                  </p>
                  <button 
                    onClick={() => {
                        showTacticalToast({ title: '🔄 Re-Escaneando Matrix', message: 'Intentando recuperar enlace con la base de datos...', type: 'info' });
                        useProgramacionStore.getState().forceSync();
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-white/05 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest transition-all group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:rotate-180 transition-transform duration-500">terminal</span>
                    RECONECTAR SISTEMA
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                  {pagedPuestos.map(p => (
                    <PuestoCard 
                      key={p.id} 
                      puesto={p} 
                      anio={anio} 
                      mes={mes} 
                      onClick={() => {
                        try {
                          setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre });
                        } catch (err) {
                          console.error('Click Error:', err);
                          showTacticalToast({ title: 'Error de Enlace', message: 'No se pudo abrir el panel del puesto.', type: 'error' });
                        }
                      }} 
                    />
                  ))}
                </div>
              )}
              {visibleCount < filteredPuestos.length && (
                <div className="flex justify-center pt-8 pb-12">
                  <button onClick={() => setVisibleCount(v => v + 60)} className="px-12 py-4 bg-primary hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all shadow-2xl">
                    Expandir Red
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <MasterGrid
            anio={anio}
            mes={mes}
            filteredPuestos={filteredPuestos}
            programaciones={programaciones}
            isInitialLoading={isInitialLoading}
            onSelectPuesto={setSelectedPuesto}
            onEditPuesto={(p) => { setPuestoToEdit(p); setIsNewPuestoModalOpen(true); }}
          />
        )}
      </main>

      <PuestoModal isOpen={isNewPuestoModalOpen} puestoId={puestoToEdit?.id} onClose={() => { setIsNewPuestoModalOpen(false); setPuestoToEdit(null); }} onCreated={() => fetchPuestos()} />
    </div>
  );
};

export default GestionPuestos;


