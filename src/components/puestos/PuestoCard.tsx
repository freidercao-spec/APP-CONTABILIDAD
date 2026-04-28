import React, { useMemo, useState } from 'react';
import { useProgramacionStore } from '../../store/programacionStore';
import { useVigilanteStore } from '../../store/vigilanteStore';

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
    edificio:    { icon: 'domain',        color: '#6366f1' },
    comercial:   { icon: 'shopping_bag',  color: '#10b981' },
    industrial:  { icon: 'factory',       color: '#f59e0b' },
    residencial: { icon: 'home_work',     color: '#8b5cf6' },
    hospital:    { icon: 'local_hospital',color: '#f43f5e' },
    banco:       { icon: 'account_balance',color:'#06b6d4' },
    torre:       { icon: 'corporate_fare',color: '#a78bfa' },
    retail:      { icon: 'storefront',    color: '#fb923c' },
    logistica:   { icon: 'local_shipping',color: '#34d399' },
    puerto:      { icon: 'anchor',        color: '#38bdf8' },
    comando:     { icon: 'security',      color: '#818cf8' },
  };
  return meta[tipo] || meta.edificio;
};

/**
 * Tactical Animated Arc SVG
 * Represents coverage percentage with a neon-glow effect
 */
const CoberturaArc = ({ value, color }: { value: number; color: string }) => {
  const r = 24, cx = 30, cy = 30;
  const circ = 2 * Math.PI * r;
  // We use a 270 degree arc (starts at 135deg, ends at 405deg)
  const arcLength = (270 / 360) * circ;
  const dash = (value / 100) * arcLength;
  
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="rotate-[135deg]">
      {/* Background track */}
      <circle 
        cx={cx} cy={cy} r={r} 
        fill="none" 
        stroke="rgba(255,255,255,0.03)" 
        strokeWidth="6" 
        strokeDasharray={`${arcLength} ${circ}`}
        strokeLinecap="round"
      />
      {/* Active progress */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ 
          filter: `drop-shadow(0 0 8px ${color}80)`, 
          transition: 'all 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' 
        }}
      />
    </svg>
  );
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
    const guards = valid.map((p: any) => {
      const v = vigilantes.find(v => v.id === p.vigilanteId || v.dbId === p.vigilanteId);
      return v || { nombre: '?' };
    });
    return { count: valid.length, guards };
  }, [prog?.personal, vigilantes]);

  const tipo = getTipoMeta(puesto.tipo || 'edificio');
  
  // Semantic dynamic colors
  const cobColor = cobertura >= 85 ? '#00C97B' : cobertura >= 50 ? '#F5A623' : '#FF4C4C';
  const cobLabel = cobertura >= 85 ? 'ÓPTIMA' : cobertura >= 50 ? 'REVISAR' : 'CRÍTICA';

  const estadoConfig = {
    publicado: { label: 'OPERATIVO', color: '#00C97B', bg: 'rgba(0,201,123,0.08)', border: 'rgba(0,201,123,0.2)' },
    borrador:  { label: 'CALIFICANDO', color: '#F5A623', bg: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.2)' },
    default:   { label: 'PENDIENTE',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',  border: 'rgba(148,163,184,0.2)' },
  };
  const currentEstado = (estadoConfig as any)[prog?.estado] || estadoConfig.default;

  return (
    <div
      className="relative group cursor-pointer transition-all duration-500 hover:-translate-y-3"
      style={{
        borderRadius: '35px',
        background: 'linear-gradient(165deg, rgba(17, 24, 39, 0.8) 0%, rgba(11, 17, 32, 0.95) 100%)',
        border: `1px solid rgba(255,255,255,0.08)`,
        backdropFilter: 'blur(30px)',
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)'
      }}
    >
      {/* Dynamic Edge Glow */}
      <div className="absolute -inset-[1px] rounded-[35px] bg-gradient-to-br from-indigo-500/20 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

      {/* Internal Glow Effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-[35px] bg-gradient-to-tr from-[#5B6EE808] to-transparent shadow-[inset_0_0_30px_rgba(91,110,232,0.1)]" />

      {/* Alert Overlay Badge */}
      {alertas.length > 0 && (
        <div 
          className="absolute -top-3 -right-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 text-white text-[10px] font-black z-30 shadow-[0_10px_20px_rgba(244,63,94,0.4)] animate-bounce border border-white/20 uppercase tracking-tighter"
        >
          {alertas.length} ALERTAS CRÍTICAS
        </div>
      )}

      {/* Dots Menu Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className="absolute top-6 right-6 size-11 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all z-20 border border-transparent hover:border-white/10 active:scale-90"
      >
        <span className="material-symbols-outlined text-[22px]">more_vert</span>
      </button>

      {/* Floating Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-16 right-6 w-56 bg-[#0F172A] border border-white/10 rounded-[24px] shadow-2xl py-3 z-50 animate-in fade-in zoom-in slide-in-from-top-2 duration-300 backdrop-blur-xl">
            <div className="px-4 pb-2 mb-2 border-b border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">COMANDOS RÁPIDOS</p>
            </div>
            <button
              className="w-full px-5 py-3 flex items-center gap-3 text-white text-[11px] font-black hover:bg-indigo-500/10 transition-colors uppercase tracking-widest group/btn"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); if (onAsignar) onAsignar(); else onClick(); }}
            >
              <div className="size-8 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover/btn:bg-indigo-500 group-hover/btn:text-white transition-all">
                <span className="material-symbols-outlined text-[18px]">person_search</span>
              </div>
              Asignar Personal
            </button>
            <button
              className="w-full px-5 py-3 flex items-center gap-3 text-white text-[11px] font-black hover:bg-emerald-500/10 transition-colors uppercase tracking-widest group/btn"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); if (onHistorial) onHistorial(); else onClick(); }}
            >
              <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover/btn:bg-emerald-500 group-hover/btn:text-white transition-all">
                <span className="material-symbols-outlined text-[18px]">history</span>
              </div>
              Bitácora Mensual
            </button>
            <div className="h-[1px] bg-white/5 my-1" />
            <button
              className="w-full px-5 py-3 flex items-center gap-3 text-rose-400 text-[11px] font-black hover:bg-rose-500/10 transition-colors uppercase tracking-widest group/btn"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); if (onIncidencia) onIncidencia(); }}
            >
              <div className="size-8 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover/btn:bg-rose-500 group-hover/btn:text-white transition-all">
                <span className="material-symbols-outlined text-[18px]">warning</span>
              </div>
              Reportar Alerta
            </button>
          </div>
        </>
      )}

      <div className="p-10 relative z-10" onClick={onClick}>
        {/* Header: ICON + ID + Name */}
        <div className="flex items-start gap-6 mb-10">
          <div
            className="size-[68px] rounded-[24px] flex items-center justify-center shrink-0 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 shadow-2xl relative"
            style={{
              background: `linear-gradient(135deg, ${tipo.color}20 0%, ${tipo.color}05 100%)`,
              border: `1px solid ${tipo.color}40`,
            }}
          >
            <div className="absolute inset-0 rounded-[24px] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: tipo.color }} />
            <span className="material-symbols-outlined text-[32px] relative z-10" style={{ color: tipo.color }}>{tipo.icon}</span>
          </div>
          <div className="flex flex-col min-w-0 pt-1">
            <div className="flex items-center gap-3 mb-2">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[#7C8BFF] font-mono text-[10px] font-black tracking-widest uppercase">
                {puesto.id || 'CTA-XXXX'}
                </span>
                <div className={`size-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]`} style={{ color: currentEstado.color }} />
            </div>
            <h3 className="text-[24px] font-black text-white uppercase leading-[1.1] tracking-tighter drop-shadow-lg">
              {puesto.nombre}
            </h3>
            {puesto.zona && (
              <div className="flex items-center gap-1.5 mt-2 text-indigo-400">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{puesto.zona}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid: Tactical Layout */}
        <div className="grid grid-cols-2 gap-5 mb-10">
          {/* Cobertura Panel */}
          <div className="bg-black/40 border border-white/5 rounded-[28px] p-5 flex items-center gap-5 transition-all group-hover:bg-black/60 group-hover:border-white/10 group-hover:shadow-2xl">
            <div className="relative size-[64px] flex items-center justify-center shrink-0">
              <CoberturaArc value={cobertura} color={cobColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center mt-0.5">
                <span className="text-[14px] font-black text-white leading-none tracking-tighter">{cobertura}%</span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Status</span>
              <span className="text-[12px] font-black truncate drop-shadow-sm" style={{ color: cobColor }}>{cobLabel}</span>
            </div>
          </div>

          {/* Personnel Panel */}
          <div className="bg-black/40 border border-white/5 rounded-[28px] p-5 flex flex-col justify-center transition-all group-hover:bg-black/60 group-hover:border-white/10 group-hover:shadow-2xl">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Dotación</span>
            <div className="flex items-baseline gap-2">
              <span className="text-[34px] font-black text-white leading-none tracking-tighter italic drop-shadow-lg">{stats.count}</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase leading-none">Personal</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mt-1">Activo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Guard List: Premium Avatar Stack */}
        <div className="flex items-center justify-between mb-10">
            <div className="flex -space-x-3.5 items-center">
            {stats.guards.length > 0 ? (
                <>
                {stats.guards.slice(0, 5).map((g: any, i) => (
                    <div 
                    key={i} 
                    className="size-12 rounded-[18px] border-[3px] border-[#0B1120] overflow-hidden relative group/avatar transition-all duration-300 hover:scale-125 hover:z-20 hover:-rotate-3"
                    style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.6)' }}
                    title={g.nombre}
                    >
                    <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(g.nombre)}&background=1e293b&color=fff&bold=true&size=100`}
                        alt={g.nombre}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                    </div>
                ))}
                {stats.guards.length > 5 && (
                    <div className="size-12 rounded-[18px] border-[3px] border-[#0B1120] bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-[11px] font-black text-white z-10 transition-all hover:scale-110 shadow-lg">
                    +{stats.guards.length - 5}
                    </div>
                )}
                </>
            ) : (
                <div className="flex items-center gap-3 w-full bg-rose-500/5 border border-rose-500/20 rounded-[22px] px-6 py-3.5 backdrop-blur-sm shadow-inner group-hover:border-rose-500/40 transition-all">
                <div className="size-2.5 bg-rose-500 rounded-full animate-ping shadow-[0_0_12px_#f43f94]" />
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.25em] italic">Objetivo Crítico: Sin Personal</span>
                </div>
            )}
            </div>
            
            {stats.guards.length > 0 && (
                <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Equipo</span>
                    <span className="text-[10px] font-black text-indigo-400 uppercase">Completo</span>
                </div>
            )}
        </div>

        {/* Footer: Multi-Action Premium Bar */}
        <div className="flex items-center justify-between pt-8 border-t border-white/5">
          <div 
            className="flex items-center gap-3 px-5 py-2.5 rounded-2xl cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg"
            style={{ 
                background: `linear-gradient(to right, ${currentEstado.bg}, transparent)`, 
                border: `1px solid ${currentEstado.border}` 
            }}
          >
            <div className="size-2 rounded-full relative">
                <div className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ backgroundColor: currentEstado.color }} />
                <div className="relative size-full rounded-full" style={{ backgroundColor: currentEstado.color, boxShadow: `0 0 10px ${currentEstado.color}` }} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[2px]" style={{ color: currentEstado.color }}>{currentEstado.label}</span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="group/panel overflow-hidden relative flex items-center gap-3 px-8 py-4 rounded-[22px] font-black text-[12px] uppercase tracking-[3px] transition-all duration-500 shadow-2xl bg-white/05 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 text-slate-400 hover:text-white"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 opacity-0 group-hover/panel:opacity-100 transition-all duration-500" />
            <span className="material-symbols-outlined text-[20px] relative z-10 transition-transform duration-500 group-hover/panel:rotate-[360deg] group-hover/panel:scale-110">explore</span>
            <span className="relative z-10">Consola</span>
          </button>
        </div>
      </div>
    </div>
  );
});
