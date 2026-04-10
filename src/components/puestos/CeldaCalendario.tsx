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

  // ── CELDA CON ASIGNACIÓN (Diseño Tactical Dark Premium) ───────────────────
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
        background: `linear-gradient(165deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)`,
        borderColor: `${style.badge}55`, // Borde neón sutil
        boxShadow: `0 4px 15px -3px rgba(0, 0, 0, 0.5), inset 0 0 10px ${style.badge}11`
      }}
      className="w-full h-full flex flex-col items-center justify-center gap-0.5 rounded-2xl border backdrop-blur-md hover:border-white/20 hover:scale-[1.02] transition-all duration-300 group overflow-hidden px-1 py-2 relative"
    >
      {/* Luz ambiental del turno */}
      <div 
        className="absolute -top-6 -left-6 size-12 rounded-full blur-xl opacity-20 pointer-events-none"
        style={{ background: style.badge }}
      />

      {/* Indicador de Turno (Glass-Badge) */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
        <div className="flex items-center justify-center size-4 rounded-md bg-white/5 border border-white/10 shadow-sm">
          <span className="material-symbols-outlined text-[10px] font-black" style={{ color: style.badge }}>
            {isNight ? 'dark_mode' : 'light_mode'}
          </span>
        </div>
      </div>

      {/* Badge de Jornada Táctica */}
      <div 
        className="absolute top-1.5 right-1.5 text-[7px] font-black px-1.5 py-0.5 rounded-md border border-white/10 uppercase tracking-tighter"
        style={{ background: `${style.badge}22`, color: style.badge }}
      >
        {style.label}
      </div>

      {/* Identidad del Vigilante */}
      <div className="flex flex-col items-center justify-center w-full mt-2 space-y-0">
        <span className="text-[10px] font-black leading-tight text-white text-center w-full truncate px-1 uppercase tracking-tight group-hover:text-indigo-300 transition-colors">
          {nameParts[0]}
        </span>
        {nameParts[1] && (
          <span className="text-[7.5px] font-bold leading-none text-slate-400 text-center w-full truncate px-1 uppercase tracking-widest mt-0.5 opacity-80">
            {nameParts[1]}
          </span>
        )}
      </div>

      {/* Detalle Operativo (Etiqueta Flotante) */}
      <div className="mt-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
         <span className="text-[6.5px] font-black uppercase tracking-widest text-slate-300">
            {turnoConf?.nombre || (isNight ? 'NOCHE' : 'DÍA')}
         </span>
         {turnoConf?.inicio && (
           <span className="text-[6.5px] font-bold text-slate-500">/</span >
         )}
         {turnoConf?.inicio && (
           <span className="text-[6.5px] font-bold text-slate-500">{turnoConf.inicio}</span>
         )}
      </div>

      {/* Línea de estatus en la base */}
      <div 
        className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-40"
        style={{ color: style.badge }}
      />
    </button>
  );
});
