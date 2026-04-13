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
  const r = 28, cx = 35, cy = 35; 
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width="70" height="70" className="absolute inset-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 1.2s ease' }}
      />
    </svg>
  );
};

export const PuestoCard = React.memo(({ puesto, anio, mes, onClick }: PuestoCardProps) => {
  const prog = useProgramacionStore(s => {
    const key = `${puesto.id}-${anio}-${mes}`;
    const p = (s as any)._progMap?.get(key);
    if (p) return p;
    return (s as any)._progMap?.get((puesto.dbId || puesto.id) + `-${anio}-${mes}`);
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

  const estadoBadge = {
    publicado:       { label: 'CALIFICADO', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    borrador:        { label: 'EDICIÓN',    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    sin_programacion:{ label: 'VACÍO',      cls: 'bg-slate-800/50 text-slate-500 border-white/5' },
  }[progEstado as 'publicado'|'borrador'|'sin_programacion'] || { label: 'PENDIENTE', cls: 'bg-slate-800/50 text-slate-500 border-white/5' };

  return (
    <div
      onClick={onClick}
      className="relative group cursor-pointer rounded-[35px] border border-white/10 overflow-hidden transition-all duration-500 hover:border-primary/50 hover:bg-slate-900/40 p-1"
      style={{
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(25px)',
        boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5)`,
      }}
    >
      <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5">
        <div className="h-full bg-primary/40 transition-all duration-1000" style={{ width: `${cobertura}%` }} />
      </div>

      <div className="p-7">
        <div className="flex items-start justify-between mb-6">
          <div className="flex flex-col gap-1">
             <span className="text-[9px] font-black text-primary/60 uppercase tracking-[0.3em]">{puesto.id || 'PUESTO_ID'}</span>
             <h3 className="text-[19px] font-black text-white uppercase tracking-tighter truncate max-w-[180px] leading-tight italic">
               {puesto.nombre}
             </h3>
          </div>
          <div className={`size-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5 group-hover:bg-primary transition-all duration-500 group-hover:scale-110 shadow-xl`}>
            <span className="material-symbols-outlined text-[24px] group-hover:text-white text-slate-500">{tipo.icon}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
           <div className="bg-black/40 rounded-2xl p-4 flex items-center gap-4 border border-white/5">
              <div className="size-10 relative flex items-center justify-center shrink-0">
                <CoberturaRing value={cobertura} color={cobColor} />
                <span className="text-[11px] font-black text-white relative z-10">{cobertura}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">COBERTURA</span>
                <span className="text-[10px] font-black text-slate-300 uppercase">{cobertura >= 85 ? 'ÓPTIMA' : 'CRÍTICA'}</span>
              </div>
           </div>
           <div className="bg-black/40 rounded-2xl p-4 flex flex-col justify-center border border-white/5">
              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">CAPACIDAD</span>
              <span className="text-[13px] font-black text-white italic">{prog?.personal?.length || 0} <span className="text-[8px] text-slate-500 not-italic">UND</span></span>
           </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 min-h-[32px]">
          {personalNombres.length > 0 ? (
            personalNombres.slice(0, 4).map((p, i) => (
              <div key={i} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 group-hover:border-primary/20 transition-all">
                <div className="size-4 rounded-full bg-primary/30 flex items-center justify-center text-[8px] font-black text-white">{p.nombre[0]}</div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{p.nombre}</span>
              </div>
            ))
          ) : (
             <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 rounded-xl border border-rose-500/10">
                <span className="material-symbols-outlined text-[14px] text-rose-500">warning</span>
                <span className="text-[8px] font-black text-rose-500 uppercase">Sin personal asignado</span>
             </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-white/5">
           <div className="flex flex-col">
              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1.5 opacity-60">SITUACIÓN</span>
              <span className={`text-[10px] font-black px-3 py-1 rounded-lg border uppercase tracking-[0.1em] ${estadoBadge.cls}`}>
                {estadoBadge.label}
              </span>
           </div>
           
           <button className="flex items-center gap-3 px-6 py-2.5 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all transform active:scale-90 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <span className="material-symbols-outlined text-[18px]">near_me</span>
              <span>ADMIN</span>
           </button>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="absolute top-4 right-4 animate-bounce">
           <div className="size-2 bg-rose-500 rounded-full shadow-[0_0_10px_#f43f5e]" title={`${alertas.length} ALERTAS TOTALES`} />
        </div>
      )}
    </div>
  );
});
