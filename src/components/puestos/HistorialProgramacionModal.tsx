import React from 'react';
import type { ProgramacionMensual } from '../../store/programacionStore';
import { MONTH_NAMES } from '../../utils/puestosConstants';

interface Props {
  prog: ProgramacionMensual;
  puestoNombre: string;
  onClose: () => void;
}

export const HistorialProgramacionModal: React.FC<Props> = ({
  prog,
  puestoNombre,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-[#0a0f1d] border border-white/10 rounded-[40px] w-full max-w-2xl shadow-2xl flex flex-col h-[80vh] animate-in zoom-in-95 duration-300 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="size-2 bg-primary rounded-full animate-pulse"></span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">REGISTRO DE OPERACIONES</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              HISTORIAL <span className="text-primary not-italic">DEL</span> TABLERO
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{puestoNombre} — {MONTH_NAMES[prog.mes]} {prog.anio}</p>
          </div>
          <button onClick={onClose} className="size-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-4 custom-scrollbar">
          {(!prog.historialCambios || prog.historialCambios.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-700">
              <span className="material-symbols-outlined text-[64px] mb-4">history</span>
              <p className="text-[11px] font-black uppercase tracking-widest">No hay registros para este periodo</p>
            </div>
          ) : (
            [...prog.historialCambios].reverse().map((cambio, i) => (
              <div key={cambio.id || i} className="group relative pl-8 pb-8 last:pb-0">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-2 bottom-0 w-px bg-white/5 group-last:bg-transparent"></div>
                {/* Dot */}
                <div className={`absolute left-0 top-1.5 size-6 rounded-full border-4 border-[#0a0f1d] z-10 flex items-center justify-center transition-transform group-hover:scale-110 ${
                  cambio.tipo === 'publicacion' ? 'bg-emerald-500' : 
                  cambio.tipo === 'asignacion' ? 'bg-indigo-500' :
                  cambio.tipo === 'personal' ? 'bg-amber-500' : 'bg-slate-600'
                } shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                  <span className="material-symbols-outlined text-[10px] text-white">
                    {cambio.tipo === 'publicacion' ? 'verified' : 
                     cambio.tipo === 'asignacion' ? 'person_add' :
                     cambio.tipo === 'personal' ? 'badge' : 'info'}
                  </span>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-3xl p-6 transition-all hover:bg-white/[0.08] hover:border-white/10">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                        cambio.tipo === 'publicacion' ? 'bg-emerald-500/20 text-emerald-400' : 
                        cambio.tipo === 'asignacion' ? 'bg-indigo-500/20 text-indigo-400' :
                        cambio.tipo === 'personal' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {cambio.tipo}
                      </span>
                      <span className="text-[10px] font-black text-white italic truncate max-w-[200px]">{cambio.usuario}</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 font-mono">
                      {new Date(cambio.timestamp).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-[12px] font-medium text-slate-300 leading-relaxed">{cambio.descripcion}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-8 border-t border-white/5 bg-black/20 flex items-center justify-center">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">Audit Logging System v2.0</p>
        </div>
      </div>
    </div>
  );
};
