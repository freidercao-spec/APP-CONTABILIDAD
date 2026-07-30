import React, { useMemo, useState } from "react";
import { useProgramacionStore } from "../../store/programacionStore";
import { useVigilanteStore } from "../../store/vigilanteStore";

interface PuestoCardProps {
  puesto: any;
  anio: number;
  mes: number;
  onClick: () => void;
  onAsignar?: () => void;
  onHistorial?: () => void;
  onIncidencia?: () => void;
}

const getTipoMeta = (tipo: string) => {
  const meta: Record<string, { icon: string; color: string }> = {
    edificio:    { icon: "domain",         color: "#6366f1" },
    comercial:   { icon: "shopping_bag",   color: "#10b981" },
    industrial:  { icon: "factory",        color: "#f59e0b" },
    residencial: { icon: "home_work",      color: "#8b5cf6" },
    hospital:    { icon: "local_hospital", color: "#f43f5e" },
    banco:       { icon: "account_balance",color: "#06b6d4" },
    torre:       { icon: "corporate_fare", color: "#a78bfa" },
    retail:      { icon: "storefront",     color: "#fb923c" },
    logistica:   { icon: "local_shipping", color: "#34d399" },
    puerto:      { icon: "anchor",         color: "#38bdf8" },
    comando:     { icon: "security",       color: "#818cf8" },
  };
  return meta[tipo] || meta.edificio;
};

export const PuestoCard = React.memo(({ puesto, anio, mes, onClick, onAsignar, onHistorial, onIncidencia }: PuestoCardProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const prog = useProgramacionStore(s => {
    const key = `${puesto.id}-${anio}-${mes}`;
    return (s as any)._progMap?.get(key) || (s as any)._progMap?.get((puesto.dbId || puesto.id) + `-${anio}-${mes}`);
  });
  const getCoberturaPorcentaje = useProgramacionStore(s => s.getCoberturaPorcentaje);
  const getAlertas = useProgramacionStore(s => s.getAlertas);
  const vigilantes = useVigilanteStore(s => s.vigilantes);

  const progId = prog?.id || null;
  const cobertura = useMemo(() => {
    const _ = prog?.asignaciones;
    return progId ? getCoberturaPorcentaje(progId) : 0;
  }, [progId, getCoberturaPorcentaje, prog?.asignaciones]);

  const alertas = useMemo(() => {
    const _ = prog?.asignaciones;
    return progId ? getAlertas(progId) : [];
  }, [progId, getAlertas, prog?.asignaciones]);

  const stats = useMemo(() => {
    const personal = prog?.personal;
    if (!personal) return { count: 0, guards: [] };
    const valid = personal.filter((p: any) => p.vigilanteId);
    const guards = valid.map((p: any) => {
      const v = vigilantes.find(v => v.id === p.vigilanteId || v.dbId === p.vigilanteId);
      return v || { nombre: "?" };
    });
    return { count: valid.length, guards };
  }, [prog?.personal, vigilantes]);

  const tipo = getTipoMeta(puesto.tipo || "edificio");
  const cobColor = cobertura >= 85 ? "#10b981" : cobertura >= 50 ? "#f59e0b" : "#f43f5e";
  
  const estadoConfig: any = {
    publicado: { label: "OPERATIVO",   color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
    borrador:  { label: "CALIFICANDO", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
    default:   { label: "PENDIENTE",   color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)" },
  };
  const estado = estadoConfig[prog?.estado] || estadoConfig.default;
  const barColor = alertas.length > 0 ? "#f43f5e" : estado.color;

  return (
    <div
      className="group relative flex items-stretch cursor-pointer transition-all duration-300 backdrop-blur-md hover:-translate-y-0.5 hover:shadow-2xl"
      onClick={onClick}
      style={{
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.96))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        overflow: "hidden"
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${barColor}50`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 30px ${barColor}15`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 255, 255, 0.08)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Side Color Indicator Bar */}
      <div
        className="w-[4px] shrink-0 transition-colors"
        style={{
          background: alertas.length > 0
            ? "linear-gradient(180deg, #f43f5e, #f87171)"
            : `linear-gradient(180deg, ${barColor}, ${barColor}44)`
        }}
      />

      <div className="flex-1 flex items-center gap-3.5 px-4 py-3.5 min-w-0">
        {/* Icon Avatar */}
        <div
          className="shrink-0 size-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
          style={{ background: `${tipo.color}18`, border: `1px solid ${tipo.color}35` }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ color: tipo.color }}>{tipo.icon}</span>
        </div>

        {/* Puesto Meta Info */}
        <div className="flex-1 min-w-[140px] md:min-w-[200px] flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[15px] font-black text-white uppercase tracking-wide truncate block leading-tight group-hover:text-indigo-300 transition-colors">
              {puesto.nombre}
            </span>
            {alertas.length > 0 && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-[8px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                {alertas.length} {alertas.length === 1 ? "ALERTA" : "ALERTAS"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-800/60 px-1.5 py-0.5 rounded text-slate-400">
              {puesto.id || "CTA-XXXX"}
            </span>
            {puesto.zona && (
              <>
                <span className="text-slate-700">·</span>
                <div className="flex items-center gap-1 text-slate-400">
                  <span className="material-symbols-outlined text-[11px] text-indigo-400">location_on</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider truncate">{puesto.zona}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Badges & Actions Right */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Coverage Badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm"
            style={{ background: `${cobColor}15`, border: `1px solid ${cobColor}35`, color: cobColor }}
          >
            <span className="material-symbols-outlined text-[12px]">{cobertura >= 85 ? "check_circle" : cobertura >= 50 ? "warning" : "dangerous"}</span>
            <span>{cobertura}%</span>
          </div>

          {/* Guard Count Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/70 border border-slate-700/60 text-[9px] font-black text-slate-300 uppercase">
            <span className="material-symbols-outlined text-[12px] text-indigo-400">shield_person</span>
            <span>{stats.count} Efectivos</span>
          </div>

          {/* Status Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider"
            style={{ background: estado.bg, border: `1px solid ${estado.border}`, color: estado.color }}
          >
            <div className="size-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: estado.color }} />
            <span>{estado.label}</span>
          </div>

          {/* Avatars preview */}
          {stats.guards.length > 0 && (
            <div className="hidden lg:flex -space-x-2 items-center ml-1">
              {stats.guards.slice(0, 3).map((g: any, i: number) => (
                <div key={i} className="size-7 rounded-full border-2 border-slate-900 overflow-hidden shadow-md" title={g.nombre}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(g.nombre)}&background=1e293b&color=fff&bold=true&size=50`}
                    alt={g.nombre}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {stats.guards.length > 3 && (
                <div className="size-7 rounded-full border-2 border-slate-900 bg-indigo-600 flex items-center justify-center text-[9px] font-black text-white shadow-md">
                  +{stats.guards.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/25 active:scale-95 shrink-0"
            title="Ingresar al panel mensual del puesto"
          >
            <span className="material-symbols-outlined text-[13px]">tune</span>
            <span>Gestionar</span>
          </button>

          {/* Options Menu Button */}
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="ml-1 size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>
      </div>

      {/* Context Menu Overlay */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full right-2 mt-1 w-56 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-2 z-50 backdrop-blur-xl animate-fade-in space-y-1">
            <div className="px-4 pb-1.5 mb-1 border-b border-slate-800">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Operaciones Tácticas</p>
            </div>
            <button
              className="w-full px-4 py-2 flex items-center gap-2.5 text-white text-[10px] font-bold hover:bg-indigo-600/20 transition-all uppercase"
              onClick={e => { e.stopPropagation(); setShowMenu(false); if (onAsignar) onAsignar(); else onClick(); }}
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-400">person_search</span>
              <span>Asignar Personal</span>
            </button>
            <button
              className="w-full px-4 py-2 flex items-center gap-2.5 text-white text-[10px] font-bold hover:bg-emerald-600/20 transition-all uppercase"
              onClick={e => { e.stopPropagation(); setShowMenu(false); if (onHistorial) onHistorial(); else onClick(); }}
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-400">history</span>
              <span>Bitácora & Historial</span>
            </button>
            <div className="h-px bg-slate-800 my-1 mx-3" />
            <button
              className="w-full px-4 py-2 flex items-center gap-2.5 text-rose-400 text-[10px] font-bold hover:bg-rose-500/20 transition-all uppercase"
              onClick={e => { e.stopPropagation(); setShowMenu(false); if (onIncidencia) onIncidencia(); }}
            >
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>Registrar Alerta</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
});