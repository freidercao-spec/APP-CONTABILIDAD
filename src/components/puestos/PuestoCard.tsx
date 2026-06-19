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
      className="relative group cursor-pointer transition-all duration-700 hover:-translate-y-4"
      onClick={onClick}
      style={{
        borderRadius: '40px',
        background: 'linear-gradient(165deg, rgba(13, 21, 37, 0.9) 0%, rgba(7, 11, 20, 0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(40px)',
        boxShadow: '0 30px 70px -20px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.05)'
      }}
    >
      {/* Animated Holographic Border */}
      <div className="absolute -inset-[2px] rounded-[42px] bg-gradient-to-br from-indigo-500/0 via-white/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

      {/* Internal Tactical Pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none overflow-hidden rounded-[40px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:24px_24px]"></div>
      </div>

      {/* Alert Overlay Badge */}
      {alertas.length > 0 && (
        <div 
          className="absolute -top-4 -right-2 px-6 py-2 rounded-full bg-gradient-to-r from-rose-600 to-rose-400 text-white text-[11px] font-black z-30 shadow-[0_15px_30px_rgba(244,63,94,0.5)] animate-bounce border-2 border-white/20 uppercase tracking-widest italic"
        >
          {alertas.length} ALERTAS CRÍTICAS
        </div>
      )}

      {/* Dots Menu Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className="absolute top-8 right-8 size-12 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all z-20 border border-transparent hover:border-white/10 active:scale-90 bg-white/05"
      >
        <span className="material-symbols-outlined text-[24px]">more_vert</span>
      </button>

      {/* Floating Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-20 right-8 w-64 bg-[#0A1120] border border-white/10 rounded-[30px] shadow-2xl py-4 z-50 animate-in fade-in zoom-in slide-in-from-top-4 duration-500 backdrop-blur-2xl">
            <div className="px-6 pb-3 mb-3 border-b border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">OPERACIONES</p>
            </div>
            <button
              className="w-full px-6 py-4 flex items-center gap-4 text-white text-[12px] font-black hover:bg-indigo-500/10 transition-all uppercase tracking-widest group/btn active:scale-95"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); if (onAsignar) onAsignar(); else onClick(); }}
            >
              <div className="size-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover/btn:bg-indigo-500 group-hover/btn:text-white transition-all shadow-lg">
                <span className="material-symbols-outlined text-[20px]">person_search</span>
              </div>
              Asignar Personal
            </button>
            <button
              className="w-full px-6 py-4 flex items-center gap-4 text-white text-[12px] font-black hover:bg-emerald-500/10 transition-all uppercase tracking-widest group/btn active:scale-95"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); if (onHistorial) onHistorial(); else onClick(); }}
            >
              <div className="size-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover/btn:bg-emerald-500 group-hover/btn:text-white transition-all shadow-lg">
                <span className="material-symbols-outlined text-[20px]">history</span>
              </div>
              Bitácora
            </button>
            <div className="h-[1px] bg-white/5 my-2 mx-4" />
            <button
              className="w-full px-6 py-4 flex items-center gap-4 text-rose-400 text-[12px] font-black hover:bg-rose-500/10 transition-all uppercase tracking-widest group/btn active:scale-95"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); if (onIncidencia) onIncidencia(); }}
            >
              <div className="size-10 rounded-2xl bg-rose-500/10 flex items-center justify-center group-hover/btn:bg-rose-500 group-hover/btn:text-white transition-all shadow-lg">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
              Alerta Roja
            </button>
          </div>
        </>
      )}

      <div className="p-12 relative z-10">
        {/* Header: ICON + ID + Name */}
        <div className="flex items-start gap-8 mb-12">
          <div
            className="size-[84px] rounded-[32px] flex items-center justify-center shrink-0 transition-all duration-1000 group-hover:scale-110 group-hover:rotate-12 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${tipo.color}15 0%, ${tipo.color}05 100%)`,
              border: `1px solid ${tipo.color}30`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute inset-0 rounded-[32px] blur-2xl opacity-10 group-hover:opacity-30 transition-opacity" style={{ backgroundColor: tipo.color }} />
            <span className="material-symbols-outlined text-[40px] relative z-10 drop-shadow-2xl" style={{ color: tipo.color }}>{tipo.icon}</span>
          </div>
          <div className="flex flex-col min-w-0 pt-2">
            <div className="flex items-center gap-4 mb-3">
                <span className="px-3 py-1.5 rounded-xl bg-white/05 border border-white/10 text-white/40 font-mono text-[11px] font-black tracking-[0.2em] uppercase transition-colors group-hover:text-indigo-400 group-hover:border-indigo-500/30">
                {puesto.id || 'CTA-XXXX'}
                </span>
                <div className="flex items-center gap-2">
                  <div className={`size-2.5 rounded-full animate-pulse shadow-[0_0_12px_currentColor]`} style={{ color: currentEstado.color }} />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{currentEstado.label}</span>
                </div>
            </div>
            <h3 className="text-[32px] font-black text-white uppercase leading-[0.95] tracking-tighter drop-shadow-2xl group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-500 transition-all duration-700">
              {puesto.nombre}
            </h3>
            {puesto.zona && (
              <div className="flex items-center gap-2 mt-4 text-white/30 group-hover:text-indigo-400/80 transition-colors">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                <span className="text-[11px] font-black uppercase tracking-[0.3em]">{puesto.zona}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid: Premium Glass Panels */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          {/* Cobertura Panel */}
          <div className="bg-white/03 border border-white/05 rounded-[32px] p-6 flex items-center gap-6 transition-all duration-500 group-hover:bg-white/05 group-hover:border-white/10 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <div className="relative size-[72px] flex items-center justify-center shrink-0">
              <CoberturaArc value={cobertura} color={cobColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                <span className="text-[16px] font-black text-white leading-none tracking-tighter tabular-nums">{cobertura}%</span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 leading-none">Cobertura</span>
              <span className="text-[14px] font-black truncate drop-shadow-sm italic" style={{ color: cobColor }}>{cobLabel}</span>
            </div>
          </div>

          {/* Personnel Panel */}
          <div className="bg-white/03 border border-white/05 rounded-[32px] p-6 flex flex-col justify-center transition-all duration-500 group-hover:bg-white/05 group-hover:border-white/10 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 leading-none">Personal Activo</span>
            <div className="flex items-baseline gap-3">
              <span className="text-[42px] font-black text-white leading-none tracking-tighter italic drop-shadow-2xl">{stats.count}</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-white/20 uppercase leading-none group-hover:text-indigo-400 transition-colors">Vigilantes</span>
                <span className="text-[9px] font-bold text-slate-600 uppercase leading-none mt-1">En Nómina</span>
              </div>
            </div>
          </div>
        </div>

        {/* Guard List: Premium Avatar Stack */}
        <div className="flex items-center justify-between mb-12 h-16">
            <div className="flex -space-x-4 items-center">
            {stats.guards.length > 0 ? (
                <>
                {stats.guards.slice(0, 5).map((g: any, i) => (
                    <div 
                    key={i} 
                    className="size-14 rounded-[22px] border-[4px] border-[#070B14] overflow-hidden relative group/avatar transition-all duration-500 hover:scale-125 hover:z-20 hover:-rotate-6"
                    style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.6)' }}
                    title={g.nombre}
                    >
                    <img 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(g.nombre)}&background=1e293b&color=fff&bold=true&size=100`}
                        alt={g.nombre}
                        className="w-full h-full object-cover grayscale group-hover/avatar:grayscale-0 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                    </div>
                ))}
                {stats.guards.length > 5 && (
                    <div className="size-14 rounded-[22px] border-[4px] border-[#070B14] bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center text-[12px] font-black text-white z-10 transition-all hover:scale-110 shadow-2xl">
                    +{stats.guards.length - 5}
                    </div>
                )}
                </>
            ) : (
                <div className="flex items-center gap-4 w-full bg-rose-500/05 border border-rose-500/20 rounded-[30px] px-8 py-4 backdrop-blur-md shadow-[inset_0_0_20px_rgba(244,63,94,0.05)] group-hover:border-rose-500/40 transition-all duration-700">
                  <div className="relative size-3 flex items-center justify-center">
                    <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping" />
                    <div className="relative size-2 bg-rose-500 rounded-full shadow-[0_0_15px_#f43f5e]" />
                  </div>
                  <span className="text-[11px] font-black text-rose-500/80 uppercase tracking-[0.3em] italic">Despliegue Crítico: Sin Personal</span>
                </div>
            )}
            </div>
            
            {stats.guards.length > 0 && (
                <div className="flex flex-col items-end opacity-40 group-hover:opacity-100 transition-opacity duration-700">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Estado de Red</span>
                    <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Sincronizado</span>
                </div>
            )}
        </div>

        {/* Footer: Multi-Action Premium Bar */}
        <div className="flex items-center justify-between pt-10 border-t border-white/05">
          <div 
            className="flex items-center gap-4 px-6 py-3 rounded-2xl transition-all duration-700 shadow-xl"
            style={{ 
                background: `linear-gradient(to right, ${currentEstado.bg}, transparent)`, 
                border: `1px solid ${currentEstado.border}` 
            }}
          >
            <div className="size-2.5 rounded-full relative">
                <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: currentEstado.color }} />
                <div className="relative size-full rounded-full" style={{ backgroundColor: currentEstado.color, boxShadow: `0 0 15px ${currentEstado.color}` }} />
            </div>
            <span className="text-[12px] font-black uppercase tracking-[3px] italic" style={{ color: currentEstado.color }}>{currentEstado.label}</span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="group/panel relative flex items-center gap-4 px-10 py-5 rounded-[24px] font-black text-[13px] uppercase tracking-[4px] transition-all duration-700 shadow-2xl bg-white/05 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 text-white/50 hover:text-white active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover/panel:opacity-100 transition-all duration-700" />
            <span className="material-symbols-outlined text-[22px] relative z-10 transition-all duration-700 group-hover/panel:rotate-[360deg] group-hover/panel:scale-125">terminal</span>
            <span className="relative z-10 italic">Consola</span>
            
            {/* Action Shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-0 group-hover/panel:opacity-100 transition-opacity duration-1000"></div>
          </button>
        </div>
      </div>
    </div>
  );
});
