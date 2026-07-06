import React, { useState } from 'react';
import type { TurnoConfig } from '../../store/puestoStore';
import { showTacticalToast } from '../../utils/tacticalToast';

interface Props {
  turnosActuales: TurnoConfig[];
  onAdd: (turno: TurnoConfig) => void;
}

export const AddTurnoForm: React.FC<Props> = ({
  turnosActuales,
  onAdd,
}) => {
  const [nombre, setNombre] = useState('');
  const [inicio, setInicio] = useState('06:00');
  const [fin, setFin] = useState('18:00');
  const [color, setColor] = useState('#6366f1');

  const PRESET_COLORS = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Violet', value: '#8b5cf6' },
  ];

  const handleAdd = () => {
    const n = nombre.trim();
    if (!n) { showTacticalToast({ title: 'Campo vacío', message: 'Ingresa un nombre para el turno.', type: 'warning' }); return; }
    const isDup = turnosActuales.some(t => t.nombre.toLowerCase() === n.toLowerCase());
    if (isDup) { showTacticalToast({ title: 'Ya existe', message: `El turno "${n}" ya está en la lista.`, type: 'warning' }); return; }
    onAdd({ id: `turno_${Date.now()}`, nombre: n, inicio, fin, color });
    setNombre('');
    setInicio('06:00');
    setFin('18:00');
    showTacticalToast({ title: 'Turno Creado', message: `El turno ${n} ha sido inyectado al sistema.`, type: 'success' });
  };

  return (
    <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
      <div>
        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Identificador del Turno</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Turno Especial, Refuerzo..."
          className="w-full h-10 px-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] font-bold text-white outline-none focus:border-violet-400 placeholder-slate-700 transition-all"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Hora Inicio</label>
          <input type="time" value={inicio} onChange={e => setInicio(e.target.value)}
            className="w-full h-10 px-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] text-white outline-none focus:border-violet-400 transition-all" />
        </div>
        <div className="flex-1">
          <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Hora Fin</label>
          <input type="time" value={fin} onChange={e => setFin(e.target.value)}
            className="w-full h-10 px-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] text-white outline-none focus:border-violet-400 transition-all" />
        </div>
      </div>

      <div>
        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Color Distintivo</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`size-7 rounded-lg border-2 transition-all ${color === c.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleAdd}
        className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 group"
      >
        <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform">add_circle</span>
        Inyectar Turno al Tablero
      </button>
    </div>
  );
};
