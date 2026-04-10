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

  // ── CELDA VACÍA ─────────────────────────────────────────────────────────────
  if (isSinAsignar) {
    return (
      <button
        onClick={onEdit}
        title={`Día ${asig.dia} · Clic para asignar`}
        style={{ minWidth: 72, minHeight: 68 }}
        className="w-full h-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all group"
      >
        <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-400 transition-colors" style={{ fontSize: 20 }}>
          add_circle
        </span>
        <span className="text-[9px] font-bold text-slate-300 group-hover:text-blue-400 uppercase tracking-wide transition-colors">
          Asignar
        </span>
      </button>
    );
  }

  // ── CELDA CON ASIGNACIÓN ──────────────────────────────────────────────────
  const turnoConf = turnosConfig?.find(t => t.id === asig.turno);
  const style = getStyle(asig.jornada, asig.rol, turnoConf);
  const isNight = style.label === 'N';

  const nameParts = (vigilanteNombre || '').trim().split(' ');

  return (
    <button
      onClick={onEdit}
      title={`${vigilanteNombre} · ${style.label}`}
      style={{
        minWidth: 72,
        minHeight: 68,
        background: style.bg,
        border: `1.5px solid ${style.badge}33`,
      }}
      className="w-full h-full flex flex-col items-center justify-center gap-0.5 rounded-lg hover:brightness-95 hover:shadow-md transition-all group overflow-hidden px-1 py-1 relative"
    >
      {/* Icono de Sol/Luna (Evidencia Clara) */}
      <div className="absolute top-1.5 left-1.5 opacity-40">
        <span className="material-symbols-outlined text-[12px]" style={{ color: style.text }}>
          {isNight ? 'dark_mode' : 'light_mode'}
        </span>
      </div>

      {/* Badge de jornada (esquina sup derecha) */}
      <span
        className="absolute top-1 right-1 text-[7px] font-black px-1 py-0.5 rounded"
        style={{ background: style.badge, color: '#fff' }}
      >
        {style.label}
      </span>

      {/* Nombre del vigilante */}
      <span
        className="text-[9px] font-black leading-tight text-center w-full truncate mt-2 px-0.5"
        style={{ color: style.text }}
      >
        {nameParts[0]}
      </span>
      {nameParts[1] && (
        <span
          className="text-[8px] font-semibold leading-none text-center w-full truncate opacity-70 px-0.5"
          style={{ color: style.text }}
        >
          {nameParts[1]}
        </span>
      )}

      {/* Turno custom (hora) */}
      {turnoConf && (
        <span
          className="text-[7px] font-bold mt-0.5 opacity-60"
          style={{ color: style.text }}
        >
          {turnoConf.inicio}
        </span>
      )}
    </button>
  );
});
