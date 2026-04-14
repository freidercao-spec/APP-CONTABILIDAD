import React, { useMemo, useState } from 'react';
import { useProgramacionStore } from '../../store/programacionStore';
import { useVigilanteStore } from '../../store/vigilanteStore';

interface PuestoCardProps {
  puesto: any;
  anio: number;
  mes: number;
  onClick: () => void;
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

export const PuestoCard = React.memo(({ puesto, anio, mes, onClick }: PuestoCardProps) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const prog = useProgramacionStore(s => {
    const key = `${puesto.id}-${anio}-${mes}`;
    return (s as any)._progMap?.get(key) || (s as any)._progMap?.get((puesto.dbId || puesto.id) + `-${anio}-${mes}`);
  });

  const getCoberturaPorcentaje = useProgramacionStore(s => s.getCoberturaPorcentaje);
  const getAlertas = useProgramacionStore(s => s.getAlertas);
  const vigilantes = useVigilanteStore(s => s.vigilantes);

  const progId = prog?.id || null;
  const cobertura = useMemo(() => progId ? getCoberturaPorcentaje(progId) : 0, [progId, getCoberturaPorcentaje]);
  const alertas = useMemo(() => progId ? getAlertas(progId) : [], [progId, getAlertas]);

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
      className="relative group cursor-pointer transition-all duration-500 hover:-translate-y-2"
      style={{
        borderRadius: '32px',
        background: 'linear-gradient(165deg, #111827 0%, #0B1120 100%)',
        border: `1px solid rgba(255,255,255,0.05)`,
        backdropFilter: 'blur(40px)',
        boxShadow: '0 12px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)'
      }}
    >
      {/* Blue Gloaw on Hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-[32px] shadow-[0_0_40px_rgba(91,110,232,0.15)] bg-gradient-to-tr from-[#5B6EE805] to-transparent" />

      {/* Alert Overlay Badge */}
      {alertas.length > 0 && (
        <div 
          className="absolute -top-2 -right-2 px-3 py-1 rounded-full bg-[#FF4C4C] text-white text-[9px] font-black z-30 shadow-[0_0_15px_rgba(255,76,76,0.5)] animate-bounce"
        >
          {alertas.length} ALERTAS
        </div>
      )}

      {/* Dots Menu Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className="absolute top-4 right-4 size-10 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all z-20"
      >
        <span className="material-symbols-outlined text-[20px]">more_vert</span>
      </button>

      {/* Floating Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-12 right-4 w-48 bg-[#1F2937] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200">
            <button className="w-full px-4 py-2.5 flex items-center gap-3 text-white text-[10px] font-black hover:bg-white/5 transition-colors uppercase tracking-widest">
              <span className="material-symbols-outlined text-[18px] text-blue-400">person_search</span>
              Asignar Vigilante
            </button>
            <button className="w-full px-4 py-2.5 flex items-center gap-3 text-white text-[10px] font-black hover:bg-white/5 transition-colors uppercase tracking-widest">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">history</span>
              Ver Historial
            </button>
            <div className="h-[1px] bg-white/5 my-1" />
            <button className="w-full px-4 py-2.5 flex items-center gap-3 text-rose-400 text-[10px] font-black hover:bg-rose-500/10 transition-colors uppercase tracking-widest">
              <span className="material-symbols-outlined text-[18px]">emergency_home</span>
              Reportar Incidencia
            </button>
          </div>
        </>
      )}

      <div className="p-8" onClick={onClick}>
        {/* Header: ID + Name */}
        <div className="flex items-center gap-5 mb-8">
          <div
            className="size-[56px] rounded-[20px] flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 shadow-lg"
            style={{
              background: `${tipo.color}15`,
              border: `1px solid ${tipo.color}30`,
              boxShadow: `0 0 25px ${tipo.color}10`
            }}
          >
            <span className="material-symbols-outlined text-[28px]" style={{ color: tipo.color }}>{tipo.icon}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[10px] font-black tracking-widest text-[#5B6EE8] uppercase mb-1 drop-shadow-[0_0_8px_rgba(91,110,232,0.4)]">
              {puesto.id || 'CTA-XXXX'}
            </span>
            <h3 className="text-[20px] font-black text-white uppercase leading-none truncate tracking-tight">
              {puesto.nombre}
            </h3>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Cobertura Arc */}
          <div className="bg-black/30 border border-white/5 rounded-3xl p-4 flex items-center gap-4 transition-all group-hover:bg-black/40">
            <div className="relative size-[60px] flex items-center justify-center">
              <CoberturaArc value={cobertura} color={cobColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                <span className="text-[12px] font-black text-white leading-none">{cobertura}%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">Status</span>
              <span className="text-[11px] font-black whitespace-nowrap" style={{ color: cobColor }}>{cobLabel}</span>
            </div>
          </div>

          {/* Personnel Count */}
          <div className="bg-black/30 border border-white/5 rounded-3xl p-4 flex flex-col justify-center transition-all group-hover:bg-black/40">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Operativos</span>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-black text-white leading-none tracking-tighter italic">{stats.count}</span>
              <span className="text-[9px] font-black text-slate-600 uppercase">Pax</span>
            </div>
          </div>
        </div>

        {/* Guard List (with Avatars) */}
        <div className="flex -space-x-3 mb-8 items-center min-h-[44px]">
          {stats.guards.length > 0 ? (
            <>
              {stats.guards.slice(0, 4).map((g: any, i) => (
                <div 
                  key={i} 
                  className="size-11 rounded-2xl border-2 border-[#111827] overflow-hidden relative group/avatar transition-transform hover:scale-110 hover:z-20"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                  title={g.nombre}
                >
                  <img 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(g.nombre)}&background=1e293b&color=fff&bold=true`}
                    alt={g.nombre}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {stats.guards.length > 4 && (
                <div className="size-11 rounded-2xl border-2 border-[#111827] bg-[#1e293b] flex items-center justify-center text-[10px] font-black text-white z-10 transition-transform hover:scale-110">
                  +{stats.guards.length - 4}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 w-full bg-[#FF4C4C0a] border border-[#FF4C4C20] rounded-2xl px-4 py-2.5">
              <div className="size-2 bg-[#FF4C4C] rounded-full animate-pulse shadow-[0_0_8px_#FF4C4C]" />
              <span className="text-[9px] font-black text-[#FF4C4C] uppercase tracking-[0.2em]">Puesto en Riesgo: Sin Personal</span>
            </div>
          )}
        </div>

        {/* Footer: State Badge + Dashboard Button */}
        <div className="flex items-center justify-between pt-6 border-t border-white/5">
          <div 
            className="flex items-center gap-2.5 px-4 py-2 rounded-full cursor-pointer hover:brightness-125 transition-all"
            style={{ background: currentEstado.bg, border: `1px solid ${currentEstado.border}` }}
          >
            <div className="size-1.5 rounded-full" style={{ backgroundColor: currentEstado.color, boxShadow: `0 0 8px ${currentEstado.color}` }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: currentEstado.color }}>{currentEstado.label}</span>
          </div>

          <button
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 transform active:scale-95 group-hover:bg-[#5B6EE8] group-hover:text-white border border-white/10 group-hover:border-[#5B6EE8] group-hover:shadow-[0_8px_25px_rgba(91,110,232,0.4)] text-slate-400"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            <span>Panel</span>
          </button>
        </div>
      </div>
    </div>
  );
});
