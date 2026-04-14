import React from 'react';
import { type AsignacionDia } from '../../store/programacionStore';
import { type JornadaCustom, type TurnoConfig } from '../../store/puestoStore';

interface CeldaCalendarioProps {
  asig: AsignacionDia;
  vigilanteNombre?: string;
  onEdit: () => void;
  jornadasCustom?: JornadaCustom[];
  turnosConfig?: TurnoConfig[];
  hasConflict?: boolean;
  conflictDetail?: string;
  syncStatus?: 'synced' | 'pending' | 'error';
}

// ─── PALETA VISUAL CLARA POR JORNADA ──────────────────────────────────────────
// Cada turno tiene fondo, texto y badge propio para diferenciarse a simple vista
const JORNADA_STYLES: Record<string, {
  bg: string; border: string; badge: string; badgeText: string;
  nameColor: string; glow: string; label: string; icon: string;
}> = {
  normal: {
    bg:        'linear-gradient(160deg, rgba(37,99,235,0.22) 0%, rgba(15,23,42,0.95) 100%)',
    border:    'rgba(59,130,246,0.45)',
    badge:     'rgba(37,99,235,0.9)',
    badgeText: '#bfdbfe',
    nameColor: '#bfdbfe',
    glow:      'rgba(59,130,246,0.20)',
    label: 'DÍA', icon: 'light_mode',
  },
  AM: {
    bg:        'linear-gradient(160deg, rgba(37,99,235,0.22) 0%, rgba(15,23,42,0.95) 100%)',
    border:    'rgba(59,130,246,0.45)',
    badge:     'rgba(37,99,235,0.9)',
    badgeText: '#bfdbfe',
    nameColor: '#bfdbfe',
    glow:      'rgba(59,130,246,0.20)',
    label: 'DÍA', icon: 'light_mode',
  },
  PM: {
    bg:        'linear-gradient(160deg, rgba(79,46,170,0.30) 0%, rgba(10,10,30,0.97) 100%)',
    border:    'rgba(139,92,246,0.55)',
    badge:     'rgba(109,40,217,0.95)',
    badgeText: '#ddd6fe',
    nameColor: '#e9d5ff',
    glow:      'rgba(139,92,246,0.22)',
    label: 'NOCHE', icon: 'dark_mode',
  },
  '24H': {
    bg:        'linear-gradient(160deg, rgba(20,83,45,0.30) 0%, rgba(10,20,10,0.97) 100%)',
    border:    'rgba(34,197,94,0.50)',
    badge:     'rgba(21,128,61,0.95)',
    badgeText: '#bbf7d0',
    nameColor: '#86efac',
    glow:      'rgba(34,197,94,0.18)',
    label: '24H', icon: 'brightness_5',
  },
  descanso_remunerado: {
    bg:        'linear-gradient(160deg, rgba(6,95,70,0.25) 0%, rgba(10,20,15,0.97) 100%)',
    border:    'rgba(16,185,129,0.40)',
    badge:     'rgba(5,150,105,0.90)',
    badgeText: '#a7f3d0',
    nameColor: '#6ee7b7',
    glow:      'rgba(16,185,129,0.15)',
    label: 'DR', icon: 'event_available',
  },
  descanso_no_remunerado: {
    bg:        'linear-gradient(160deg, rgba(120,53,15,0.25) 0%, rgba(20,10,5,0.97) 100%)',
    border:    'rgba(245,158,11,0.40)',
    badge:     'rgba(180,83,9,0.90)',
    badgeText: '#fde68a',
    nameColor: '#fcd34d',
    glow:      'rgba(245,158,11,0.15)',
    label: 'DNR', icon: 'event_busy',
  },
  vacacion: {
    bg:        'linear-gradient(160deg, rgba(91,33,182,0.25) 0%, rgba(15,10,30,0.97) 100%)',
    border:    'rgba(167,139,250,0.40)',
    badge:     'rgba(109,40,217,0.90)',
    badgeText: '#ede9fe',
    nameColor: '#c4b5fd',
    glow:      'rgba(167,139,250,0.15)',
    label: 'VAC', icon: 'beach_access',
  },
};

const getStyle = (jornada: string, role?: string, turnoConf?: TurnoConfig) => {
  // Prioridad: descanso/vacaciones
  if (['descanso_remunerado', 'descanso_no_remunerado', 'vacacion'].includes(jornada)) {
    return JORNADA_STYLES[jornada];
  }

  // Detectar noche por turno, rol o config
  const startHour = turnoConf?.inicio ? parseInt(turnoConf.inicio.split(':')[0]) : 6;
  const isNight = jornada === 'PM' ||
    turnoConf?.id === 'PM' ||
    (startHour >= 17 || startHour < 5) ||
    (['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => (role || '').toLowerCase().includes(k)));

  const base = isNight ? { ...JORNADA_STYLES.PM } : { ...JORNADA_STYLES.AM };

  // Respetar color personalizado del turno
  if (turnoConf?.color) {
    base.badge = turnoConf.color;
    base.border = `${turnoConf.color}88`;
    base.glow   = `${turnoConf.color}25`;
  }

  return base;
};

export const CeldaCalendario = React.memo(({
  asig,
  vigilanteNombre,
  onEdit,
  turnosConfig,
  hasConflict,
  conflictDetail,
  syncStatus,
}: CeldaCalendarioProps) => {

  const isSinAsignar = asig.jornada === 'sin_asignar' || !asig.vigilanteId;

  // ── CELDA VACÍA ─────────────────────────────────────────────────────────────
  if (isSinAsignar) {
    return (
      <button
        onClick={onEdit}
        title={`Día ${asig.dia} · Clic para asignar`}
        style={{ minHeight: 85, background: 'rgba(15,23,42,0.6)' }}
        className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/5 hover:border-indigo-500/40 transition-all duration-300 group shadow-inner relative"
      >
        <div
          className="size-9 rounded-xl flex items-center justify-center text-slate-600 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300 shadow-lg border border-white/[0.06] group-hover:border-indigo-500/30"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </div>
        <span className="text-[8px] font-black text-slate-700 group-hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors">
          ASIGNAR
        </span>
      </button>
    );
  }

  // ── CELDA CON ASIGNACIÓN ────────────────────────────────────────────────────
  const turnoConf = turnosConfig?.find(t => t.id === asig.turno);
  const style = getStyle(asig.jornada, asig.rol, turnoConf);

  const nameParts = (vigilanteNombre || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts[1] || '';

  // Conflicto → override rojo
  const conflictStyle = {
    bg:     'linear-gradient(160deg, rgba(127,7,32,0.55) 0%, rgba(20,5,10,0.98) 100%)',
    border: 'rgba(244,63,94,0.70)',
    badge:  'rgba(220,38,38,0.95)',
    badgeText: '#fecdd3',
    nameColor: '#fca5a5',
    glow:   'rgba(244,63,94,0.30)',
    label:  '!!', icon: 'priority_high',
  };

  const s = hasConflict ? conflictStyle : style;

  return (
    <button
      onClick={onEdit}
      title={hasConflict ? `⚠️ DOBLE ASIGNACIÓN: ${conflictDetail}` : `${vigilanteNombre} · ${s.label}`}
      style={{
        minHeight: 85,
        background: s.bg,
        borderColor: s.border,
        boxShadow: `0 6px 20px -4px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border backdrop-blur-md hover:scale-[1.06] hover:z-50 transition-all duration-300 group overflow-hidden px-2 py-2.5 relative ${hasConflict ? 'border-2 animate-pulse' : ''}`}
    >
      {/* Conflicto badge */}
      {hasConflict && (
        <>
          <div className="absolute -top-1 -right-1 size-4 bg-rose-500 rounded-full animate-ping opacity-75 z-10" />
          <div className="absolute -top-0.5 -right-0.5 size-3 bg-rose-500 rounded-full z-20 flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.9)]">
            <span className="text-white text-[6px] font-black">!</span>
          </div>
        </>
      )}

      {/* Sync state badge */}
      {syncStatus === 'pending' && (
        <div className="absolute top-1.5 right-1.5 z-[60] flex items-center justify-center pointer-events-none">
           <div className="size-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="absolute top-1.5 right-1.5 size-3 bg-rose-600 rounded-full z-20 flex items-center justify-center shadow-[0_0_8px_rgba(225,29,72,0.7)] animate-pulse border border-white/20">
          <span className="text-white text-[7px] font-black">!</span>
        </div>
      )}

      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 30% 0%, ${s.glow} 0%, transparent 60%)` }}
      />

      {/* Top-left: turno icon */}
      <div className="absolute top-2 left-2">
        <div
          className="size-[18px] rounded-md flex items-center justify-center"
          style={{ background: `${s.badge}33`, border: `1px solid ${s.badge}55` }}
        >
          <span className="material-symbols-outlined text-[11px]" style={{ color: s.badgeText }}>
            {s.icon}
          </span>
        </div>
      </div>

      {/* Top-right: jornada label */}
      <div
        className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider"
        style={{ background: s.badge, color: s.badgeText, letterSpacing: '0.05em' }}
      >
        {s.label}
      </div>

      {/* Guard name */}
      <div className="flex flex-col items-center justify-center w-full mt-4 space-y-0">
        <span
          className="text-[11px] font-black leading-tight text-center w-full truncate px-1 uppercase"
          style={{ color: s.nameColor }}
        >
          {firstName}
        </span>
        {lastName && (
          <span
            className="text-[8px] font-bold leading-none text-center w-full truncate px-1 uppercase opacity-70"
            style={{ color: s.nameColor }}
          >
            {lastName}
          </span>
        )}
      </div>

      {/* Bottom: turno/hora */}
      <div
        className="mt-auto flex items-center gap-1 px-2 py-0.5 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.30)', border: `1px solid ${s.border}55` }}
      >
        <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: `${s.badgeText}bb` }}>
          {turnoConf?.nombre || s.label}
        </span>
        {turnoConf?.inicio && (
          <>
            <div className="w-px h-2 bg-white/15" />
            <span className="text-[7px] font-bold" style={{ color: s.badgeText }}>{turnoConf.inicio}</span>
          </>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 h-[2px] w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${s.badge}, transparent)`, opacity: 0.6 }}
      />
    </button>
  );
});
