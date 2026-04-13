import React, { useMemo } from 'react';
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
    edificio:    { icon: 'domain',           color: '#6366f1' },
    comercial:   { icon: 'shopping_bag',     color: '#10b981' },
    industrial:  { icon: 'factory',          color: '#f59e0b' },
    residencial: { icon: 'home_work',        color: '#8b5cf6' },
  };
  return meta[tipo] || meta.edificio;
};

const CoberturaRing = ({ value, color }: { value: number; color: string }) => {
  const r = 26, cx = 35, cy = 35; 
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width="70" height="70" className="absolute inset-0 -rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'all 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
    </svg>
  );
};

export const PuestoCard = React.memo(({ puesto, anio, mes, onClick }: PuestoCardProps) => {
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
    if (!prog?.personal) return { count: 0, names: [] };
    const valid = prog.personal.filter((p:any) => p.vigilanteId);
    const names = valid.map((p:any) => {
      const v = vigilantes.find(v => v.id === p.vigilanteId || v.dbId === p.vigilanteId);
      return v?.nombre?.split(' ')[0] || '?';
    });
    return { count: valid.length, names };
  }, [prog?.personal, vigilantes]);

  const tipo = getTipoMeta(puesto.tipo || 'edificio');
  const cobColor = cobertura >= 85 ? '#10b981' : cobertura >= 50 ? '#f59e0b' : '#f43f5e';

  const estadoConfig = {
    publicado: { label: 'CALIFICADO', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    borrador:  { label: 'PROCESO',    cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    default:   { label: 'VAC?O',      cls: 'text-slate-500 bg-white/5 border-white/5' },
  };
  const currentEstado = (estadoConfig as any)[prog?.estado] || estadoConfig.default;

  return (
    <div
      onClick={onClick}
      className="relative group cursor-pointer rounded-[40px] border border-white/5 overflow-hidden transition-all duration-700 hover:scale-[1.02] hover:border-primary/40 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      style={{ background: 'linear-gradient(135deg, rgba(20,26,48,0.7) 0%, rgba(10,15,28,0.9) 100%)', backdropFilter: 'blur(30px)' }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2 group-hover:bg-primary/10 transition-colors" />

      <div className="p-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-primary/60 tracking-[0.3em] uppercase">{puesto.id || '---'}</span>
                {alertas.length > 0 && <div className="size-2 rounded-full bg-rose-500 animate-ping shadow-[0_0_8px_#f43f5e]" />}
             </div>
             <h3 className="text-[22px] font-black text-white uppercase italic tracking-tighter leading-tight truncate group-hover:text-primary-light transition-colors">
               {puesto.nombre}
             </h3>
          </div>
          <div className="size-14 rounded-[22px] bg-white/[0.03] border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:border-primary shadow-2xl transition-all duration-500 group-hover:rotate-12">
            <span className="material-symbols-outlined text-[30px] text-slate-500 group-hover:text-white">{tipo.icon}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
           <div className="bg-black/30 rounded-3xl p-5 flex items-center gap-5 border border-white/5 shadow-inner">
              <div className="size-11 relative flex items-center justify-center shrink-0">
                 <CoberturaRing value={cobertura} color={cobColor} />
                 <span className="text-[11px] font-black text-white relative z-10">{cobertura}%</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">COBERTURA</span>
                 <span className="text-[10px] font-black text-slate-300">{cobertura >= 85 ? '?PTIMA' : 'REVISAR'}</span>
              </div>
           </div>
           <div className="bg-black/30 rounded-3xl p-5 flex flex-col justify-center border border-white/5 shadow-inner">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">CAPACIDAD</span>
              <div className="flex items-baseline gap-1">
                 <span className="text-[16px] font-black text-white italic">{stats.count}</span>
                 <span className="text-[8px] font-black text-slate-500 uppercase">Per</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-2 mb-8 min-h-[40px] flex-wrap">
           {stats.names.length > 0 ? (
             stats.names.slice(0, 3).map((n, i) => (
                <div key={i} className="px-3 py-2 bg-white/5 border border-white/5 rounded-xl flex items-center gap-2 group-hover:border-primary/30 transition-all">
                   <div className="size-5 rounded-lg bg-primary/20 flex items-center justify-center text-[9px] font-black text-white">{n[0]}</div>
                   <span className="text-[9px] font-black text-slate-400 uppercase">{n}</span>
                </div>
             ))
           ) : (
             <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-500/5 rounded-2xl border border-rose-500/10 w-full">
                <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Alerta: Sin Personal</span>
             </div>
           )}
        </div>

        <div className="flex items-center justify-between pt-7 border-t border-white/10 relative z-10">
           <div className="flex flex-col">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1.5 opacity-60">SITUACI?N RED</span>
              <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border-2 uppercase tracking-[0.1em] ${currentEstado.cls}`}>
                {currentEstado.label}
              </span>
           </div>
           
           <button className="h-12 px-7 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-primary-light hover:text-white transition-all transform active:scale-95 shadow-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">insights</span>
              <span>ADMIN</span>
           </button>
        </div>
      </div>
    </div>
  );
});
