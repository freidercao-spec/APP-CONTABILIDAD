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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Sub-components
import { CeldaCalendario } from "../components/puestos/CeldaCalendario";
import { EditCeldaModal } from "../components/puestos/EditCeldaModal";
import { PuestoCard } from '../components/puestos/PuestoCard';
import PuestoModal from '../components/puestos/PuestoModal';
import { CoordinationPanel } from "../components/puestos/CoordinationPanel";

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
          const isNight = ['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => a.rol?.toLowerCase().includes(k)) || a.turno === 'PM';
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
    if (!prog) return;
    setIsGeneratingPDF(true);
    logAction("PROGRAMACION", "Exportar Excel", `${puestoNombre} ${MONTH_NAMES[mes]} ${anio}`, "info");

    try {
      const wb = XLSX.utils.book_new();
      const rows: any[] = [];

      rows.push(["CUADRO DE PROGRAMACIÓN MENSUAL"]);
      rows.push(["COOPERATIVA DE VIGILANCIA Y SEGURIDAD PRIVADA CORAZA C.T.A - NIT: 901.509.121"]);
      rows.push([`PUESTO: ${puestoNombre.toUpperCase()}`]);
      rows.push([`MES: ${MONTH_NAMES[mes].toUpperCase()} ${anio}`]);
      rows.push([]);

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
          const isNight = ['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => a.rol?.toLowerCase().includes(k)) || a.turno === 'PM';
          const rCode = code === "24" ? "24" : (isNight ? "N" : "D");
          
          let tInicio = "06";
          let tFin = code === "24" ? "06" : "18";
          
          if (isNight && code !== "24") {
             tInicio = "18"; tFin = "06";
          }
          
          if (a.inicio) tInicio = a.inicio.slice(0, 5).replace(":00", "");
          if (a.fin) tFin = a.fin.slice(0, 5).replace(":00", "");

          finalContent = `${rCode} ${tInicio}-${tFin}`;
        }
        
        vigDataMap.get(a.vigilanteId)!.asigs.set(a.dia, finalContent);
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
          const isDR = code === "DR";
          const isDNR = code === "DNR";
          const isVAC = code === "VAC";
          
          if (code && !isDR && !isDNR && !isVAC && code !== "-") trab++;
          else if (isDR || isDNR) desc++;
          else if (isVAC) vac++;
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
            onClick={() => guardarBorrador(prog.id, currentUser)}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>{" "}
            Borrador
          </button>

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

      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 rounded-[30px] border border-white/5 shadow-2xl mb-8 animate-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-2 px-4 border-r border-white/10 shrink-0">
          <span className="material-symbols-outlined text-indigo-400 text-[20px]">magic_button</span>
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
                     const asig = (prog.asignaciones || []).find(
                       (a: AsignacionDia) => a.dia === d && a.rol === per.rol
                     ) || { dia: d, turno: per.turnoId || 'AM', jornada: "sin_asignar", rol: per.rol };

                     const dow = new Date(anio, mes, d).getDay();
                     const isWeekend = dow === 0 || dow === 6;

                     return (
                       <td key={d} style={{ padding: 10, width: 130 }} className={`border-r border-white/5 transition-all outline-none ${isWeekend ? 'bg-white/[0.04]' : 'group-hover/row:bg-white/[0.08]'}`}>
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
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const { puestos, fetchPuestos, loaded: puestosLoaded } = usePuestoStore();
  const { programaciones, fetchProgramaciones, loaded: progLoaded } = useProgramacionStore();
  const { vigilantes, fetchVigilantes } = useVigilanteStore();

  const isInitialLoading = !puestosLoaded || !progLoaded;

  useEffect(() => {
    const bootstrap = async () => {
      console.log('[Coraza] 🛫 Iniciando secuencia de arranque táctico...');
      await fetchVigilantes();
      await fetchPuestos();
      await fetchProgramaciones();
      console.log('[Coraza] 🛬 Tablero hidratado y listo para el despacho.');
    };
    bootstrap();
  }, [fetchPuestos, fetchProgramaciones, fetchVigilantes]);

  const [visibleCount, setVisibleCount] = useState(60);
  
  const filteredPuestos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const base = (puestos || []).filter(p => (p as any).estado !== 'inactivo');
    if (!q) return base;
    return base.filter(p => 
      p.nombre?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  }, [puestos, searchQuery]);

  const pagedPuestos = filteredPuestos.slice(0, visibleCount);

  const renderMasterGrid = () => {
    const totalDias = new Date(anio, mes + 1, 0).getDate();
    
    if (isInitialLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[40px] border border-slate-200 animate-pulse">
           <span className="material-symbols-outlined text-[48px] text-primary mb-4 animate-spin">sync</span>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cargando Red de Puestos...</p>
        </div>
      );
    }
    
    return (
      <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-[40px] border border-slate-200 shadow-2xl relative">
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="border-collapse border-none select-none" style={{ width: 'max-content', tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-50">
              <tr>
                <th className="sticky left-0 z-50 bg-slate-900 border-r-2 border-primary/20 p-6 text-left shadow-[4px_0_20px_rgba(0,0,0,0.1)]" style={{ width: 280 }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">admin_panel_settings</span>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Red de Puestos</span>
                  </div>
                </th>
                {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                  const date = new Date(anio, mes, d);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th key={d} className={`px-2 py-4 border-r border-slate-100 text-center transition-colors ${isWeekend ? 'bg-slate-50' : 'bg-white'}`} style={{ width: 60 }}>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                        {date.toLocaleDateString('es', { weekday: 'short' }).substring(0, 1)}
                      </p>
                      <p className={`text-sm font-black ${isWeekend ? 'text-primary' : 'text-slate-900'}`}>{d}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredPuestos.map((p) => (
                <tr key={p.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-50">
                  <td className="sticky left-0 z-40 bg-white group-hover:bg-slate-50 border-r-2 border-primary/10 px-6 py-4 shadow-[4px_0_20px_rgba(0,0,0,0.05)] transition-colors">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{p.id}</span>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => { setPuestoToEdit(p); setIsNewPuestoModalOpen(true); }}
                            className="size-6 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        </div>
                      </div>
                      <span 
                        onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                        className="text-[12px] font-black text-slate-900 tracking-tight truncate hover:text-primary cursor-pointer transition-colors"
                      >
                        {p.nombre}
                      </span>
                    </div>
                  </td>
                  {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                    const prog = programaciones.find(pg => pg.puestoId === (p.dbId || p.id) && pg.anio === anio && pg.mes === mes);
                    const asig = prog?.asignaciones?.find(a => a.dia === d);
                    return (
                      <td 
                        key={d} 
                        className="p-1 border-r border-slate-50 cursor-pointer hover:bg-primary/5 transition-all"
                        onClick={() => {
                          const asigPlaceholder = asig || { dia: d, turno: 'AM', jornada: 'sin_asignar', rol: 'titular_a' };
                          // Nota: En la grilla maestra abrimos un despacho rápido o podrías abrir el panel mensual
                          setSelectedPuesto({ dbId: p.id, nombre: p.nombre });
                        }}
                      >
                        <div className={`h-8 rounded-lg flex items-center justify-center text-[9px] font-black border transition-all ${
                          asig ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-slate-50 border-slate-100 text-slate-300'
                        }`}>
                          {asig ? asig.jornada.substring(0,1).toUpperCase() : '·'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-[#0f172a] text-white px-8 py-6 border-b border-white/5 shrink-0 flex items-center justify-between shadow-2xl z-30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none"></div>
        
        <div className="flex items-center gap-6 relative">
          <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2 transform -rotate-3 hover:rotate-0 transition-all cursor-pointer group shadow-lg shadow-black/20" onClick={() => window.location.href = '/'}>
            <img src="/logo.png" alt="CORAZA" className="w-full h-full object-contain brightness-125 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] animate-pulse">Operaciones Live</span>
              <span className="h-1 w-1 rounded-full bg-white/20"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Master Control</span>
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none">
              Gestión de <span className="text-primary not-italic">Puestos</span>
            </h1>
          </div>
          
          <div className="ml-12 flex items-center bg-black/40 border border-white/10 rounded-2xl p-1 shadow-inner">
            <button 
              onClick={() => { const d = new Date(anio, mes - 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="px-3 py-2 text-slate-500 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <div className="px-6 py-2 text-center min-w-[140px]">
              <p className="text-[9px] font-black text-primary uppercase tracking-widest">{anio}</p>
              <p className="text-sm font-black text-white uppercase">{MONTH_NAMES[mes]}</p>
            </div>
            <button 
              onClick={() => { const d = new Date(anio, mes + 1); setAnio(d.getFullYear()); setMes(d.getMonth()); }}
              className="px-3 py-2 text-slate-500 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 relative">
          <div className="relative group hidden lg:block">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg group-focus-within:text-primary transition-colors">search</span>
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filtro rápido..."
              className="bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm font-bold focus:outline-none focus:border-primary/40 focus:ring-8 focus:ring-primary/5 transition-all w-64 placeholder:text-slate-600 shadow-inner"
            />
          </div>

          <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block"></div>

          <div className="flex bg-black/40 border border-white/10 rounded-2xl p-1 shadow-inner">
            <button 
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'cards' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
              title="Vista de Tarjetas"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              <span className="hidden xl:inline">Cards</span>
            </button>
            <button 
              onClick={() => setViewMode('master_grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'master_grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
              title="Grilla Maestra Global"
            >
              <span className="material-symbols-outlined text-[18px]">table_rows</span>
              <span className="hidden xl:inline">Master</span>
            </button>
          </div>

          <button 
            onClick={() => setIsNewPuestoModalOpen(true)}
            className="flex items-center gap-3 bg-white text-[#0f172a] py-3.5 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95 shadow-xl shadow-black/40 border border-white/20"
          >
            <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
            <span className="hidden sm:inline">Nuevo Puesto</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col pt-6 px-8 pb-8">
        {viewMode === 'cards' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-8 shrink-0 gap-4">
              <div className="relative flex-1 max-w-lg group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">filter_list</span>
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por nombre, código o ID..."
                  className="w-full h-14 pl-12 pr-4 bg-white border-2 border-slate-100 rounded-3xl text-[13px] font-bold outline-none focus:border-primary/20 focus:ring-4 ring-primary/5 transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    console.log('[Coraza] 🔄 Sincronización manual activada...');
                    useProgramacionStore.getState().forceSync();
                  }}
                  disabled={!progLoaded}
                  className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-black/5 border border-slate-100 bg-white ${!progLoaded ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-slate-600 hover:border-primary/20 hover:text-primary active:scale-95'}`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${!progLoaded ? 'animate-spin' : ''}`}>sync</span>
                  <span>Refrescar</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {isInitialLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-64 bg-white border border-slate-100 rounded-3xl p-6 relative overflow-hidden">
                       <div className="flex justify-between items-start mb-4">
                          <div className="space-y-2">
                             <div className="h-2 w-16 bg-slate-100 rounded"></div>
                             <div className="h-4 w-32 bg-slate-100 rounded"></div>
                          </div>
                          <div className="size-8 rounded-full bg-slate-100"></div>
                       </div>
                       <div className="mt-8 space-y-4">
                          <div className="h-2 w-full bg-slate-50 rounded"></div>
                          <div className="h-2 w-3/4 bg-slate-50 rounded"></div>
                       </div>
                       <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-50"></div>
                    </div>
                  ))}
                </div>
              ) : pagedPuestos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-[48px] text-slate-300 mb-4">inventory_2</span>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No hay resultados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                  {pagedPuestos.map((p, idx) => (
                    <PuestoCard
                      key={p.dbId || p.id || `puesto-${idx}`}
                      puesto={p}
                      anio={anio}
                      mes={mes}
                      onClick={() => setSelectedPuesto({ dbId: p.dbId || p.id, nombre: p.nombre })}
                    />
                  ))}
                </div>
              )}

              {visibleCount < filteredPuestos.length && (
                <div className="flex justify-center pt-8 pb-12">
                  <button
                    onClick={() => setVisibleCount((v) => v + 60)}
                    className="px-12 py-4 bg-[#0f172a] text-white rounded-full font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20"
                  >
                    Expandir Cuadro (+60)
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          renderMasterGrid()
        )}
      </main>

      <PuestoModal 
        isOpen={isNewPuestoModalOpen}
        puestoId={puestoToEdit?.id}
        onClose={() => { setIsNewPuestoModalOpen(false); setPuestoToEdit(null); }}
        onCreated={() => fetchPuestos()}
      />
    </div>
  );
};

export default GestionPuestos;
