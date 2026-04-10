import React from 'react';
import { type AsignacionDia } from '../../store/programacionStore';
import { type JornadaCustom, type TurnoConfig } from '../../store/puestoStore';

interface CeldaCalendarioProps {
  asig: AsignacionDia;
  vigilanteNombre?: string;
  onEdit: () => void;
  jornadasCustom?: JornadaCustom[];
  turnosConfig?: TurnoConfig[];
}

const DEFAULT_JORNADAS: JornadaCustom[] = [
  { id: 'normal',               nombre: 'Normal',        short: 'N',   color: '#2563eb', textColor: '#fff' },
  { id: 'descanso_remunerado',  nombre: 'Desc. Rem.',    short: 'DR',  color: '#059669', textColor: '#fff' },
  { id: 'descanso_no_remunerado', nombre: 'Desc. N/Rem.', short: 'DNR', color: '#d97706', textColor: '#fff' },
  { id: 'vacacion',             nombre: 'Vacación',      short: 'VAC', color: '#7c3aed', textColor: '#fff' },
  { id: 'sin_asignar',          nombre: 'Sin asignar',   short: '-',   color: '#e2e8f0', textColor: '#94a3b8' },
];

const JORNADA_STYLES: Record<string, { bg: string; text: string; badge: string; label: string }> = {
  normal:                { bg: '#eff6ff', text: '#1e40af', badge: '#2563eb', label: 'D'   },
  AM:                    { bg: '#eff6ff', text: '#1e40af', badge: '#2563eb', label: 'D'   },
  PM:                    { bg: '#1e1b4b', text: '#c7d2fe', badge: '#4f46e5', label: 'N'   },
  '24H':                 { bg: '#f5f3ff', text: '#5b21b6', badge: '#7c3aed', label: '24H' },
  descanso_remunerado:   { bg: '#ecfdf5', text: '#065f46', badge: '#059669', label: 'DR'  },
  descanso_no_remunerado:{ bg: '#fffbeb', text: '#92400e', badge: '#d97706', label: 'DNR' },
  vacacion:              { bg: '#f5f3ff', text: '#4c1d95', badge: '#7c3aed', label: 'VAC' },
};

const getStyle = (jornada: string, role?: string, turnoConf?: TurnoConfig) => {
  // 1. Estilos de Descanso/Vacaciones (Prioridad absoluta sobre colores de trabajo)
  if (['descanso_remunerado', 'descanso_no_remunerado', 'vacacion'].includes(jornada)) {
    return JORNADA_STYLES[jornada] || JORNADA_STYLES.normal;
  }

  // 2. Lógica de Detección de Noche
  const startHour = turnoConf?.inicio ? parseInt(turnoConf.inicio.split(':')[0]) : 6;
  const isNight = jornada === 'PM' || 
                  turnoConf?.id === 'PM' || 
                  (startHour >= 16 || startHour < 5) ||
                  (['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => (role || '').toLowerCase().includes(k)));

  const baseStyle = isNight ? JORNADA_STYLES.PM : JORNADA_STYLES.AM;

  // 3. Respetar el Color Personalizado
  if (turnoConf?.color) {
    return {
      ...baseStyle,
      badge: turnoConf.color, 
      label: isNight ? 'N' : 'D'
    };
  }

  return baseStyle;
};

export const CeldaCalendario = React.memo(({
  asig,
  vigilanteNombre,
  onEdit,
  turnosConfig,
}: CeldaCalendarioProps) => {

  const isSinAsignar = asig.jornada === 'sin_asignar' || !asig.vigilanteId;

  // ── CELDA VACÍA (Diseño Crystal Dark) ──────────────────────────────────────
  if (isSinAsignar) {
    return (
      <button
        onClick={onEdit}
        title={`Día ${asig.dia} · Clic para asignar`}
        style={{ minHeight: 74 }}
        className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/10 transition-all duration-300 group shadow-inner"
      >
        <div className="size-8 rounded-xl bg-slate-900/50 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 group-hover:scale-110 transition-all duration-300 shadow-lg">
          <span className="material-symbols-outlined text-[18px]">add</span>
        </div>
        <span className="text-[8px] font-black text-slate-600 group-hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors">
          Asignar
        </span>
      </button>
    );
  }

  // ── CELDA CON ASIGNACIÓN (Diseño Premium) ──────────────────────────────────
  const turnoConf = turnosConfig?.find(t => t.id === asig.turno);
  const style = getStyle(asig.jornada, asig.rol, turnoConf);
  const isNight = style.label === 'N';

  const nameParts = (vigilanteNombre || '').trim().split(' ');

  return (
    <button
      onClick={onEdit}
      title={`${vigilanteNombre} · ${style.label}`}
      style={{
        minHeight: 74,
        background: `linear-gradient(135deg, ${style.bg} 0%, white 100%)`,
        borderColor: `${style.badge}44`,
      }}
      className="w-full h-full flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 hover:brightness-95 hover:shadow-xl hover:scale-[1.03] transition-all duration-300 group overflow-hidden px-1.5 py-2 relative shadow-md shadow-slate-200/50"
    >
      {/* Glow de Fondo */}
      <div 
        className="absolute -top-10 -right-10 size-20 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ background: style.badge }}
      />

      {/* Icono de Sol/Luna con Estilo Glass */}
      <div className="absolute top-2 left-2 flex items-center justify-center size-5 rounded-full bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm">
        <span className="material-symbols-outlined text-[12px] font-black" style={{ color: style.badge }}>
          {isNight ? 'dark_mode' : 'light_mode'}
        </span>
      </div>

      {/* Badge de jornada elegante */}
      <span
        className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-lg shadow-sm border border-white/20"
        style={{ background: style.badge, color: '#fff' }}
      >
        {style.label}
      </span>

      {/* Nombre del vigilante (Tipografía Refinada) */}
      <div className="flex flex-col items-center justify-center w-full mt-3">
        <span
          className="text-[10px] font-black leading-tight text-center w-full truncate px-0.5 uppercase tracking-tighter"
          style={{ color: '#1e293b' }}
        >
          {nameParts[0]}
        </span>
        {nameParts[1] && (
          <span
            className="text-[8px] font-bold leading-none text-center w-full truncate opacity-60 px-0.5 uppercase tracking-widest mt-0.5"
            style={{ color: '#475569' }}
          >
            {nameParts[1]}
          </span>
        )}
      </div>

      {/* Info de Turno / Horario */}
      <div className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/5 border border-slate-900/5">
         <span className="text-[7px] font-black uppercase opacity-60" style={{ color: style.badge }}>
            {turnoConf?.nombre || (isNight ? 'Nocturno' : 'Diurno')}
         </span>
         {turnoConf?.inicio && (
           <span className="text-[7px] font-bold text-slate-400">• {turnoConf.inicio}</span>
         )}
      </div>
    </button>
  );
});
