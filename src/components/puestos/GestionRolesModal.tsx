/**
 * GestionRolesModal — Gestión de Filas/Roles del Tablero
 * =========================================================
 * Permite al operador agregar, eliminar y reordenar las filas
 * del tablero (roles). Soporta 1 a 20+ roles por puesto.
 *
 * Cada rol tiene:
 *   - nombre visible (ej: "Turno Mañana 1", "Control Acceso 3")
 *   - turno asociado (horario)
 *   - vigilante titular asignado
 */

import React, { useState, useMemo } from 'react';
import { showTacticalToast } from '../../utils/tacticalToast';
import type { TurnoConfig } from '../../store/puestoStore';
import type { PersonalPuesto } from '../../store/programacionStore';

interface GestionRolesModalProps {
  roles: PersonalPuesto[];
  turnosConfig: TurnoConfig[];
  vigilantes: any[];
  onSave: (rolesActualizados: PersonalPuesto[]) => void;
  onClose: () => void;
  puestoNombre?: string;
}

const COLORES_ROL = [
  '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6',
  '#22c55e', '#a855f7', '#ef4444', '#0ea5e9', '#84cc16',
  '#d946ef', '#fb923c', '#34d399', '#60a5fa', '#f472b6',
];

const ICONOS_ROL = [
  'shield_person', 'security', 'person', 'groups', 'manage_accounts',
  'badge', 'supervisor_account', 'local_police', 'verified_user', 'how_to_reg',
];

export const GestionRolesModal: React.FC<GestionRolesModalProps> = ({
  roles,
  turnosConfig,
  vigilantes,
  onSave,
  onClose,
  puestoNombre,
}) => {
  const [localRoles, setLocalRoles] = useState<PersonalPuesto[]>(() =>
    roles.map(r => ({ ...r }))
  );
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTurno, setNuevoTurno] = useState(turnosConfig[0]?.id || 'AM');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const vigilanteMap = useMemo(() => {
    const m = new Map<string, string>();
    vigilantes.forEach(v => {
      if (v?.id) m.set(v.id, v.nombre || 'Sin nombre');
      if (v?.dbId) m.set(v.dbId, v.nombre || 'Sin nombre');
    });
    return m;
  }, [vigilantes]);

  const getRolLabel = (rol: string) => {
    const base: Record<string, string> = {
      titular_a: 'Titular A',
      titular_b: 'Titular B',
      relevante: 'Relevante',
    };
    return base[rol] || rol.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const agregarRol = () => {
    const n = nuevoNombre.trim();
    if (!n) {
      showTacticalToast({ title: 'Campo vacío', message: 'Indica el nombre del rol/turno.', type: 'warning' });
      return;
    }
    const rolId = `turno_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nuevo: PersonalPuesto = {
      rol: rolId,
      vigilanteId: null,
      turnoId: nuevoTurno,
    };
    setLocalRoles(prev => [...prev, nuevo]);
    setNuevoNombre('');
    showTacticalToast({ title: '✅ Fila Añadida', message: n, type: 'success' });
  };

  const eliminarRol = (idx: number) => {
    const rol = localRoles[idx];
    if (localRoles.length <= 1) {
      showTacticalToast({ title: 'Mínimo 1 fila', message: 'El tablero requiere al menos una fila operativa.', type: 'warning' });
      return;
    }
    if (confirm(`¿Eliminar la fila "${getRolLabel(rol.rol)}"? Se perderán sus asignaciones en este tablero.`)) {
      setLocalRoles(prev => prev.filter((_, i) => i !== idx));
      showTacticalToast({ title: 'Fila eliminada', message: getRolLabel(rol.rol), type: 'success' });
    }
  };

  const actualizarNombreRol = (idx: number, nuevoLabel: string) => {
    setLocalRoles(prev => {
      const next = [...prev];
      // Si es un rol base, no modificar el id por compatibilidad con asignaciones existentes
      // Solo actualizamos un campo de display name si existiera, de lo contrario el id ya ES el label
      if (!['titular_a', 'titular_b', 'relevante'].includes(next[idx].rol)) {
        // Para roles personalizados, el ID encapsula el nombre: reemplazamos solo el suffix del ID
        // Pero la solución más simple es guardar un campo `displayName`
        (next[idx] as any).displayName = nuevoLabel;
      }
      return next;
    });
  };

  const actualizarTurnoRol = (idx: number, turnoId: string) => {
    setLocalRoles(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], turnoId };
      return next;
    });
  };

  const moverArriba = (idx: number) => {
    if (idx === 0) return;
    setLocalRoles(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moverAbajo = (idx: number) => {
    setLocalRoles(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    if (localRoles.length === 0) {
      showTacticalToast({ title: 'Sin roles', message: 'Agrega al menos un rol.', type: 'error' });
      return;
    }
    onSave(localRoles);
    showTacticalToast({
      title: '✅ Tablero Actualizado',
      message: `${localRoles.length} filas operativas configuradas.`,
      type: 'success',
    });
    onClose();
  };

  const colorForIdx = (idx: number) => COLORES_ROL[idx % COLORES_ROL.length];
  const iconoForIdx = (idx: number) => ICONOS_ROL[idx % ICONOS_ROL.length];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#0b1220] border border-white/10 rounded-[40px] shadow-[0_32px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-10 py-8 bg-gradient-to-r from-violet-500/10 via-transparent to-transparent border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <div className="size-14 rounded-2xl bg-violet-600 flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.5)]">
              <span className="material-symbols-outlined text-white text-[28px]">grid_view</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.3em] mb-1">Estructura del Tablero</p>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                FILAS OPERATIVAS
              </h2>
              {puestoNombre && (
                <p className="text-[11px] text-slate-500 mt-0.5">{puestoNombre}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="size-10 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Instrucción */}
        <div className="px-10 pt-6 shrink-0">
          <div className="flex items-center gap-3 px-5 py-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
            <span className="material-symbols-outlined text-violet-400 text-[20px]">info</span>
            <p className="text-[11px] font-bold text-violet-300">
              Cada fila representa un puesto de guardia activo simultáneamente. Un hospital de turno completo puede tener 15–20 filas. Ordénalas y configura sus horarios.
            </p>
          </div>
        </div>

        {/* Lista de roles */}
        <div className="px-10 py-6 overflow-y-auto flex-1 custom-scrollbar space-y-2">
          {localRoles.map((rol, idx) => {
            const label = (rol as any).displayName || getRolLabel(rol.rol);
            const turno = turnosConfig.find(t => t.id === rol.turnoId) || turnosConfig[0];
            const vigNombre = rol.vigilanteId ? (vigilanteMap.get(rol.vigilanteId) || 'Asignado') : null;
            const color = colorForIdx(idx);
            const icono = iconoForIdx(idx);

            return (
              <div
                key={`${rol.rol}-${idx}`}
                className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-white/10 transition-all group"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                {/* Número */}
                <div
                  className="size-9 rounded-xl flex items-center justify-center text-[13px] font-black shrink-0 text-white"
                  style={{ backgroundColor: `${color}30`, color }}
                >
                  {idx + 1}
                </div>

                {/* Icono + Nombre */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icono}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-white truncate">{label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {turno && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: `${color}40` }}>
                          {turno.nombre} ({turno.inicio}–{turno.fin})
                        </span>
                      )}
                      {vigNombre && (
                        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                          {vigNombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selector de turno */}
                <select
                  value={rol.turnoId || ''}
                  onChange={e => actualizarTurnoRol(idx, e.target.value)}
                  className="h-9 px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-white outline-none focus:border-violet-400 transition-all shrink-0"
                  style={{ minWidth: 100 }}
                >
                  {turnosConfig.map(t => (
                    <option key={t.id} value={t.id} className="bg-slate-900">
                      {t.nombre}
                    </option>
                  ))}
                  {turnosConfig.length === 0 && (
                    <>
                      <option value="AM" className="bg-slate-900">Diurno (AM)</option>
                      <option value="PM" className="bg-slate-900">Nocturno (PM)</option>
                    </>
                  )}
                </select>

                {/* Controles orden y eliminar */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moverArriba(idx)}
                    disabled={idx === 0}
                    className="size-8 flex items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-20 transition-all text-slate-400 hover:text-white"
                    title="Subir fila"
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    onClick={() => moverAbajo(idx)}
                    disabled={idx === localRoles.length - 1}
                    className="size-8 flex items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-20 transition-all text-slate-400 hover:text-white"
                    title="Bajar fila"
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
                  </button>
                  <button
                    onClick={() => eliminarRol(idx)}
                    className="size-8 flex items-center justify-center rounded-xl hover:bg-rose-500/20 transition-all text-slate-600 hover:text-rose-400"
                    title="Eliminar fila"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}

          {localRoles.length === 0 && (
            <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
              <span className="material-symbols-outlined text-[40px] text-slate-700 mb-3 block">table_rows</span>
              <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Sin filas operativas</p>
            </div>
          )}
        </div>

        {/* Añadir nuevo rol */}
        <div className="px-10 py-6 border-t border-white/5 bg-black/20 shrink-0">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">
            ➕ Agregar Nueva Fila ({localRoles.length} activas)
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarRol()}
              placeholder="Ej: Control Acceso 3, Turno Mañana 7..."
              className="flex-1 h-11 px-5 bg-white/5 border border-white/10 rounded-2xl text-[12px] font-bold text-white outline-none focus:border-violet-400 placeholder:text-slate-700 transition-all"
            />
            <select
              value={nuevoTurno}
              onChange={e => setNuevoTurno(e.target.value)}
              className="h-11 px-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-bold text-white outline-none focus:border-violet-400 transition-all"
            >
              {turnosConfig.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900">{t.nombre}</option>
              ))}
              {turnosConfig.length === 0 && (
                <>
                  <option value="AM" className="bg-slate-900">Diurno AM</option>
                  <option value="PM" className="bg-slate-900">Nocturno PM</option>
                </>
              )}
            </select>
            <button
              onClick={agregarRol}
              className="h-11 px-6 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl text-[11px] font-black uppercase transition-all flex items-center gap-2 shadow-lg shadow-violet-600/20"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Añadir
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-slate-950 border-t border-white/5 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-slate-600">
            {localRoles.length} fila{localRoles.length !== 1 ? 's' : ''} · {localRoles.length * 30} días de programación al mes
          </p>
          <div className="flex gap-4">
            <button onClick={onClose} className="px-8 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:text-white transition-all">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-12 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-[0_8px_30px_rgba(124,58,237,0.4)] hover:-translate-y-0.5 transition-all"
            >
              Aplicar al Tablero
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GestionRolesModal;
