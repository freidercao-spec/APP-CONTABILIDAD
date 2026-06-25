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
  const cobertura = useMemo(() => progId ? getCoberturaPorcentaje(progId) : 0, [progId, getCoberturaPorcentaje, prog?.asignaciones]);
  const alertas = useMemo(() => progId ? getAlertas(progId) : [], [progId, getAlertas, prog?.asignaciones]);
  const stats = useMemo(() => {
    if (!prog?.personal) return { count: 0, guards: [] };
    const valid = prog.personal.filter((p: any) => p.vigilanteId);
    const guards = valid.map((p: any) => { const v = vigilantes.find(v => v.id === p.vigilanteId || v.dbId === p.vigilanteId); return v || { nombre: "?" }; });
    return { count: valid.length, guards };
  }, [prog?.personal, vigilantes]);
  const tipo = getTipoMeta(puesto.tipo || "edificio");
  const cobColor = cobertura >= 85 ? "#10b981" : cobertura >= 50 ? "#f59e0b" : "#f43f5e";
  const estadoConfig: any = {
    publicado: { label: "OPERATIVO",   color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)" },
    borrador:  { label: "CALIFICANDO", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)" },
    default:   { label: "PENDIENTE",   color: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.2)" },
  };
  const estado = estadoConfig[prog?.estado] || estadoConfig.default;
  const barColor = alertas.length > 0 ? "#f43f5e" : estado.color;
  return (
    <div className="group relative flex items-stretch cursor-pointer transition-all duration-200"
      onClick={onClick}
      style={{ background: "linear-gradient(90deg,rgba(13,21,37,0.9),rgba(7,11,20,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", overflow: "hidden" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${barColor}40`; (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg,rgba(16,24,44,0.95),rgba(10,14,26,0.98))"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg,rgba(13,21,37,0.9),rgba(7,11,20,0.95))"; }}
    >
      <div className="w-[3px] shrink-0" style={{ background: alertas.length > 0 ? "linear-gradient(180deg,#f43f5e,#f87171)" : `linear-gradient(180deg,${barColor}cc,${barColor}44)` }} />
      <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
        <div className="shrink-0 size-9 rounded-xl flex items-center justify-center" style={{ background: `${tipo.color}18`, border: `1px solid ${tipo.color}35` }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: tipo.color }}>{tipo.icon}</span>
        </div>
        <div className="flex-1 min-w-[140px] md:min-w-[200px] flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[15px] font-black text-white uppercase tracking-wide truncate block leading-tight">{puesto.nombre}</span>
            {alertas.length > 0 && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-[8px] font-black text-rose-400 uppercase">{alertas.length} {alertas.length === 1 ? "ALERTA" : "ALERTAS"}</span>}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider">{puesto.id || "CTA-XXXX"}</span>
            {puesto.zona && <><span className="text-slate-700">·</span><div className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[10px]">location_on</span><span className="text-[9px] font-bold uppercase tracking-wider truncate">{puesto.zona}</span></div></>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase" style={{ background: `${cobColor}12`, border: `1px solid ${cobColor}30`, color: cobColor }}>
            <span className="material-symbols-outlined text-[10px]">{cobertura >= 85 ? "check_circle" : cobertura >= 50 ? "warning" : "dangerous"}</span>
            {cobertura}%
          </div>
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[8px] font-black text-slate-400 uppercase">
            <span className="material-symbols-outlined text-[10px]">shield_person</span>{stats.count}
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase" style={{ background: estado.bg, border: `1px solid ${estado.border}`, color: estado.color }}>
            <div className="size-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: estado.color }} />{estado.label}
          </div>
          {stats.guards.length > 0 && <div className="hidden lg:flex -space-x-2 items-center ml-1">{stats.guards.slice(0,3).map((g: any, i: number) => (<div key={i} className="size-6 rounded-full border-2 border-[#070B14] overflow-hidden" title={g.nombre}><img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(g.nombre)}&background=1e293b&color=fff&bold=true&size=50`} alt={g.nombre} className="w-full h-full object-cover" /></div>))}{stats.guards.length > 3 && <div className="size-6 rounded-full border-2 border-[#070B14] bg-indigo-600 flex items-center justify-center text-[8px] font-black text-white">+{stats.guards.length - 3}</div>}</div>}
          
          <button 
            onClick={e => { e.stopPropagation(); onClick(); }} 
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95 shrink-0"
            title="Ingresar a gestionar el puesto"
          >
            <span className="material-symbols-outlined text-[11px]">terminal</span>
            <span>Gestionar</span>
          </button>

          <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }} className="ml-1 size-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/10 transition-all active:scale-90">
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
        </div>
      </div>
      {showMenu && (<><div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} /><div className="absolute top-full right-2 mt-1 w-52 bg-[#0A1120] border border-white/10 rounded-xl shadow-2xl py-2 z-50 backdrop-blur-2xl"><div className="px-4 pb-1.5 mb-1.5 border-b border-white/5"><p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.35em]">Operaciones</p></div><button className="w-full px-4 py-2.5 flex items-center gap-2.5 text-white text-[10px] font-black hover:bg-indigo-500/10 transition-all uppercase" onClick={e => { e.stopPropagation(); setShowMenu(false); if (onAsignar) onAsignar(); else onClick(); }}><span className="material-symbols-outlined text-[15px] text-indigo-400">person_search</span>Asignar Personal</button><button className="w-full px-4 py-2.5 flex items-center gap-2.5 text-white text-[10px] font-black hover:bg-emerald-500/10 transition-all uppercase" onClick={e => { e.stopPropagation(); setShowMenu(false); if (onHistorial) onHistorial(); else onClick(); }}><span className="material-symbols-outlined text-[15px] text-emerald-400">history</span>Bitacora</button><div className="h-px bg-white/5 my-1 mx-3" /><button className="w-full px-4 py-2.5 flex items-center gap-2.5 text-rose-400 text-[10px] font-black hover:bg-rose-500/10 transition-all uppercase" onClick={e => { e.stopPropagation(); setShowMenu(false); if (onIncidencia) onIncidencia(); }}><span className="material-symbols-outlined text-[15px]">warning</span>Alerta Roja</button></div></>)}
    </div>
  );
});