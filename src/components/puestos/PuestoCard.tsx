import React, { useMemo } from 'react';
import { useProgramacionStore } from '../../store/programacionStore';
import { useVigilanteStore } from '../../store/vigilanteStore';

interface PuestoCardProps {
  puesto: any;
  anio: number;
  mes: number;
  onClick: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const getTipoMeta = (tipo: string) => {
  const meta: Record<string, { icon: string; color: string; glow: string }> = {
    edificio:    { icon: 'domain',           color: '#6366f1', glow: 'rgba(99,102,241,0.3)' },
    comercial:   { icon: 'shopping_bag',     color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
    industrial:  { icon: 'factory',          color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
    residencial: { icon: 'home_work',        color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  };
  return meta[tipo] || meta.edificio;
};

const CoberturaRing = ({ value, color }: { value: number; color: string }) => {
  const r = 32, cx = 40, cy = 40; 
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width="80" height="80" className="absolute inset-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 10px ${color})`, transition: 'stroke-dasharray 1.2s ease' }}
      />
    </svg>
  );
};

export const PuestoCard = React.memo(({ puesto, anio, mes, onClick }: PuestoCardProps) => {
  const prog = useProgramacionStore(s => {
    const key = `${puesto.id}-${anio}-${mes}`;
    const p = (s as any)._progMap?.get(key);
    if (p) return p;
    return (s as any)._progMap?.get(puesto.dbId + `-${anio}-${mes}`);
  });

  const getCoberturaPorcentaje = useProgramacionStore(s => s.getCoberturaPorcentaje);
  const getAlertas = useProgramacionStore(s => s.getAlertas);
  const vigilantes = useVigilanteStore(s => s.vigilantes);

  const progId = prog?.id || null;
  const cobertura = useMemo(() => progId ? getCoberturaPorcentaje(progId) : 0, [progId, getCoberturaPorcentaje]);
  const alertas = useMemo(() => progId ? getAlertas(progId) : [], [progId, getAlertas]);

  const personalNombres = useMemo(() => {
    if (!prog?.personal) return [];
    return prog.personal
      .filter((p:any) => p.vigilanteId)
      .map((p:any) => {
        const v = vigilantes.find(v => v.id === p.vigilanteId || v.dbId === p.vigilanteId);
        return { rol: p.rol, nombre: v?.nombre?.split(' ')[0] || '?', turnoId: p.turnoId };
      });
  }, [prog?.personal, vigilantes]);

  const tipo = getTipoMeta(puesto.tipo || 'edificio');
  const progEstado = prog?.estado || 'sin_programacion';
  const syncStatus = (prog as any)?.syncStatus;

  const cobColor = cobertura >= 85 ? '#10b981' : cobertura >= 50 ? '#f59e0b' : '#f43f5e';
  const cobGlow  = cobertura >= 85 ? 'rgba(16,185,129,0.4)' : cobertura >= 50 ? 'rgba(245,158,11,0.4)' : 'rgba(244,63,94,0.4)';

  const estadoBadge = {
    publicado:       { label: 'Publicado',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' },
    borrador:        { label: 'Borrador',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' },
    sin_programacion:{ label: 'Pendiente',  cls: 'bg-slate-800/50 text-slate-500 border-white/5' },
  }[progEstado as 'publicado'|'borrador'|'sin_programacion'] || { label: 'Pendiente', cls: 'bg-slate-800/50 text-slate-500 border-white/5' };

  return (
    <div
      onClick={onClick}
      className="relative group cursor-pointer rounded-[40px] border border-white/10 overflow-hidden transition-all duration-500 hover:border-indigo-500/40 hover:scale-[1.02] hover:-translate-y-3 active:scale-[0.98] shadow-2xl"
      style={{
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 30px 60px -12px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)`,
      }}
    >
      <div
        className="absolute -top-20 -left-20 size-64 rounded-full blur-[80px] opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity duration-700"
        style={{ background: tipo.color }}
      />
      
      <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5 overflow-hidden">
        <div 
          className="h-full transition-all duration-1000 ease-out relative"
          style={{ width: `${cobertura}%`, background: `linear-gradient(90deg, transparent, ${cobColor})` }}
        >
          <div className="absolute right-0 top-0 h-full w-8 bg-white blur-sm opacity-50"></div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="absolute top-6 right-6 z-10 flex items-center gap-3 px-5 py-2.5 bg-rose-500/15 border border-rose-500/30 rounded-[20px] backdrop-blur-md animate-pulse">
          <div className="size-2.5 bg-rose-500 rounded-full shadow-[0_0_10px_#f43f5e]" />
          <span className="text-[11px] font-black text-rose-400 uppercase tracking-[0.2em]">{alertas.length} ALERTAS</span>
        </div>
      )}

      <div className="p-10">
        <div className="flex items-start gap-6 mb-10">
          <div
            className="size-20 rounded-[28px] flex items-center justify-center shrink-0 relative transition-transform duration-500 group-hover:rotate-6"
            style={{ 
               background: `${tipo.color}15`, 
               border: `1px solid ${tipo.color}35`,
               boxShadow: `0 0 30px ${tipo.glow}`
            }}
          >
            <div className="absolute inset-0 blur-lg opacity-20 bg-current rounded-full" style={{ color: tipo.color }}></div>
            <span className="material-symbols-outlined text-[42px] relative z-10" style={{ color: tipo.color }}>
              {tipo.icon}
            </span>
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-2">{puesto.id || 'T-PUESTO'}</p>
            <h3 className="text-[24px] font-black text-white leading-tight truncate group-hover:text-indigo-400 transition-colors tracking-tighter">
              {puesto.nombre}
            </h3>
            {puesto.direccion && (
              <div className="flex items-center gap-2 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-[18px] text-indigo-400">farsight_2</span>
                <p className="text-[12px] font-bold text-slate-400 truncate tracking-wide italic">
                  {puesto.direccion}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-10 mb-10">
          <div className="relative size-24 shrink-0 transform group-hover:scale-110 transition-transform duration-500">
            <CoberturaRing value={cobertura} color={cobColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[22px] font-black italic tracking-tighter" style={{ color: cobColor }}>{cobertura}%</span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">COBERTURA</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-5">
            <div className="bg-white/[0.03] rounded-3xl px-6 py-5 border border-white/5 backdrop-blur-md">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">ESTADO</p>
              <p className="text-[15px] font-black text-white italic">{MONTH_NAMES[mes].slice(0,3).toUpperCase()} {anio}</p>
            </div>
            <div className="bg-white/[0.03] rounded-3xl px-6 py-5 border border-white/5 backdrop-blur-md">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">CAPACIDAD</p>
              <p className="text-[15px] font-black text-white italic">{prog?.personal?.length || 0} TURNOS</p>
            </div>
          </div>
        </div>

        {personalNombres.length > 0 ? (
          <div className="flex flex-wrap gap-3 mb-10">
            {personalNombres.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all">
                <div
                  className="size-7 rounded-xl flex items-center justify-center text-[12px] font-black text-white shadow-lg"
                  style={{ background: p.turnoId === 'PM' ? 'linear-gradient(135deg, #4f46e5, #3730a3)' : 'linear-gradient(135deg, #10b981, #065f46)' }}
                >
                  {p.nombre[0]}
                </div>
                <span className="text-[13px] font-black text-slate-300 uppercase tracking-tight">{p.nombre}</span>
              </div>
            ))}
            {personalNombres.length > 3 && (
              <div className="flex items-center px-5 py-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <span className="text-[13px] font-black text-slate-600">+{personalNombres.length - 3}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-10 px-6 py-5 bg-amber-500/5 border border-amber-500/10 rounded-3xl animate-pulse">
            <span className="material-symbols-outlined text-amber-500/50 text-[26px]">gpp_maybe</span>
            <span className="text-[13px] font-black text-amber-500/50 uppercase tracking-widest">PENDIENTE DE ASIGNACIÓN</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-8 border-t border-white/5 relative z-10">
          <span className={`text-[12px] font-black px-5 py-2.5 rounded-2xl border uppercase tracking-[0.2em] ${estadoBadge.cls}`}>
            {estadoBadge.label}
          </span>

          <div className="flex items-center gap-6">
            {syncStatus === 'pending' && <span className="material-symbols-outlined text-indigo-400 text-[24px] animate-spin">sync_saved_locally</span>}
            <div className="flex items-center gap-4 px-8 py-3.5 bg-indigo-600 text-white rounded-[22px] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/60 group/btn">
              <span className="material-symbols-outlined text-[24px] group-hover/btn:translate-x-1 transition-transform">rocket_launch</span>
              <span className="text-[14px] font-black uppercase tracking-[0.25em]">GESTIONAR</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
