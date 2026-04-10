import React, { useMemo } from 'react';
import { useProgramacionStore } from '../../store/programacionStore';

interface PuestoCardProps {
  puesto: any;
  anio: number;
  mes: number;
  onClick: () => void;
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const PuestoCard = React.memo(({ puesto, anio, mes, onClick }: PuestoCardProps) => {
  // PERFORMANCE CRITICAL: Use granular selector to avoid re-renders if other posts change.
  // _progMap provides O(1) access.
  const prog = useProgramacionStore(s => {
    const key = `${puesto.id}-${anio}-${mes}`;
    return s._progMap?.get(key) || s._progMap?.get(puesto.dbId + `-${anio}-${mes}`);
  });
  
  const getCoberturaPorcentaje = useProgramacionStore(s => s.getCoberturaPorcentaje);
  const getAlertas = useProgramacionStore(s => s.getAlertas);

  const progId = prog?.id || null;
  const progEstado = prog?.estado || 'sin_programacion';
  
  const cobertura = useMemo(() => progId ? getCoberturaPorcentaje(progId) : 0, [progId, getCoberturaPorcentaje]);
  const alertas = useMemo(() => progId ? getAlertas(progId) : [], [progId, getAlertas]);

  return (
    <div
      className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{puesto.id}</p>
          <h3 className="text-base font-black text-slate-900 mt-0.5 group-hover:text-primary transition-colors">{puesto.nombre}</h3>
        </div>
        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${puesto.estado === "cubierto" ? "bg-emerald-500/10 text-emerald-600" : puesto.estado === "alerta" ? "bg-orange-500/10 text-orange-600" : "bg-red-500/10 text-red-600"}`}>
          {puesto.estado}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PROG. {MONTH_NAMES[mes]}</span>
          <span className={`text-[11px] font-black ${cobertura >= 80 ? "text-emerald-500" : cobertura >= 50 ? "text-orange-500" : "text-red-500"}`}>{cobertura}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${cobertura}%`, backgroundColor: cobertura >= 80 ? '#10b981' : cobertura >= 50 ? '#f59e0b' : '#ef4444' }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${progEstado === "publicado" ? "bg-emerald-500/10 text-emerald-600" : progEstado === "borrador" ? "bg-orange-500/10 text-orange-600" : "bg-slate-100 text-slate-400"}`}>
            {progEstado === "publicado" ? "Publicado" : progEstado === "borrador" ? "Borrador" : "Pendiente"}
          </span>
          {prog?.syncStatus === 'pending' && (
            <span className="material-symbols-outlined text-primary text-[14px] animate-spin">sync</span>
          )}
        </div>
        {alertas.length > 0 && (
          <span className="text-[10px] font-black text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            {alertas.length}
          </span>
        )}
        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-[20px]">arrow_forward</span>
      </div>
    </div>
  );
});
