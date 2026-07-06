import React, { useState, useMemo } from 'react';
import { useVigilanteStore } from '../../store/vigilanteStore';
import type { PersonalPuesto, ProgramacionMensual } from '../../store/programacionStore';
import type { TurnoConfig } from '../../store/puestoStore';
import { showTacticalToast } from '../../utils/tacticalToast';

interface Props {
  prog: ProgramacionMensual;
  puestoNombre: string;
  turnosConfig: TurnoConfig[];
  onClose: () => void;
  onSave: (personal: PersonalPuesto[]) => void;
}

export const GestionPersonalModal: React.FC<Props> = ({
  prog,
  puestoNombre,
  turnosConfig,
  onClose,
  onSave,
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
    const v = vigilantes.find((v) => v.id === p?.vigilanteId || v.dbId === p?.vigilanteId);
    return v?.nombre || p?.vigilanteId;
  };

  const handleSave = () => {
    onSave(personal);
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
        <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
              Personal del Puesto
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              {puestoNombre} — Define el equipo base para este objetivo
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
              <div key={rol} className="bg-white/[0.04] rounded-3xl p-5 border border-white/5 transition-all hover:bg-white/[0.06]">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`size-9 rounded-xl ${color} flex items-center justify-center shadow-lg shadow-indigo-500/10`}>
                    <span className="material-symbols-outlined text-white text-[18px]">{icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-black text-white uppercase">{label}</p>
                      <div className="flex items-center gap-2 bg-black/40 px-2 py-0.5 rounded-lg border border-white/10">
                        <span className="material-symbols-outlined text-[14px] text-indigo-400">
                          {(personal.find(p => p.rol === rol)?.turnoId?.includes('PM') || personal.find(p => p.rol === rol)?.rol.toLowerCase().includes('b')) ? 'dark_mode' : 'light_mode'}
                        </span>
                        <select 
                          value={personal.find(p => p.rol === rol)?.turnoId || "AM"}
                          onChange={(e) => setPersonalTurno(rol, e.target.value)}
                          className="bg-transparent text-[9px] font-black text-slate-300 border-none outline-none cursor-pointer hover:text-white transition-all appearance-none"
                        >
                          {turnosConfig.map((t: any) => (
                            <option key={t.id} value={t.id} className="bg-slate-800 text-white font-bold">
                              {t.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {nombreAsignado ? (
                      <p className="text-[10px] text-emerald-400 font-bold mt-1">✓ {nombreAsignado}</p>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Vacante — Pendiente Asignar</p>
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
                    placeholder="Localizar personal por nombre o cédula..."
                    value={q}
                    onChange={(e) =>
                      setSearchTerms((prev) => ({ ...prev, [rol]: e.target.value }))
                    }
                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-[11px] font-bold text-white placeholder:text-slate-600 placeholder:font-bold placeholder:tracking-widest focus:border-indigo-500/50 outline-none transition-all"
                  />
                  {q && filtered.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      {filtered.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setPersonalVigilante(rol, v.id)}
                          className="w-full px-4 py-3 text-left hover:bg-indigo-600 flex items-center justify-between border-b border-white/5 last:border-0 group"
                        >
                          <div>
                            <p className="text-[11px] font-black text-white uppercase">{v.nombre}</p>
                            <p className="text-[9px] text-indigo-400 font-bold">CC: {v.cedula} • {v.rango}</p>
                          </div>
                          <span className="material-symbols-outlined text-white/20 group-hover:text-white text-[18px]">add_circle</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!showAddRol ? (
            <button
              onClick={() => setShowAddRol(true)}
              className="w-full py-4 border border-dashed border-white/10 rounded-3xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
            >
              + Añadir Nuevo Rol/Turno al Puesto
            </button>
          ) : (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-3xl p-5 animate-in slide-in-from-top-2">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">Definir Nuevo Rol</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: TITULAR C, APOYO, etc."
                  value={newRolName}
                  onChange={(e) => setNewRolName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomRol()}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white outline-none focus:border-indigo-500"
                  autoFocus
                />
                <button
                  onClick={addCustomRol}
                  className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  Añadir
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-black/20 border-t border-white/10 flex items-center justify-between">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
            Configuración segura y persistente en Supabase
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[11px] font-black uppercase transition-all"
            >
              Cerrar
            </button>
            <button
              onClick={handleSave}
              className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase transition-all shadow-lg shadow-emerald-900/40"
            >
              Confirmar y Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
