import React from 'react';
import { type AsignacionDia, ESTADOS_LABORALES, getEstadoLaboral } from '../../store/programacionStore';
import type { TurnoConfig, JornadaCustom } from '../../store/puestoStore';

interface CeldaCalendarioProps {
  asig: AsignacionDia;
  vigilanteNombre?: string | { nombre: string };
  onEdit: () => void;
  jornadasCustom?: JornadaCustom[];
  turnosConfig?: TurnoConfig[];
  hasConflict?: boolean;
  conflictDetail?: string;
  syncStatus?: 'synced' | 'pending' | 'error';
}

// ─── PALETA VISUAL PREMIUM ──────────────────────────────────────────────────
const JORNADA_STYLES: Record<string, {
  bg: string; border: string; badge: string; badgeText: string;
  nameColor: string; glow: string; label: string; icon: string;
  accentLine: string; hoverBorder: string;
}> = {
  normal: {
    bg:          'linear-gradient(145deg, #1e3a5f 0%, #0f172a 100%)',
    border:      'rgba(56,189,248,0.35)',
    badge:       '#0284c7',
    badgeText:   '#e0f2fe',
    nameColor:   '#e0f2fe',
    glow:        'rgba(56,189,248,0.12)',
    accentLine:  '#0ea5e9',
    hoverBorder: 'rgba(56,189,248,0.6)',
    label: 'D', icon: 'light_mode',
  },
  AM: {
    bg:          'linear-gradient(145deg, #1e3a5f 0%, #0f172a 100%)',
    border:      'rgba(56,189,248,0.35)',
    badge:       '#0284c7',
    badgeText:   '#e0f2fe',
    nameColor:   '#e0f2fe',
    glow:        'rgba(56,189,248,0.12)',
    accentLine:  '#0ea5e9',
    hoverBorder: 'rgba(56,189,248,0.6)',
    label: 'D', icon: 'light_mode',
  },
  PM: {
    bg:          'linear-gradient(145deg, #2e1065 0%, #0c0a1a 100%)',
    border:      'rgba(139,92,246,0.40)',
    badge:       '#7c3aed',
    badgeText:   '#ede9fe',
    nameColor:   '#e9d5ff',
    glow:        'rgba(139,92,246,0.15)',
    accentLine:  '#8b5cf6',
    hoverBorder: 'rgba(139,92,246,0.7)',
    label: 'N', icon: 'dark_mode',
  },
  '24H': {
    bg:          'linear-gradient(145deg, #052e16 0%, #0a0f0a 100%)',
    border:      'rgba(34,197,94,0.40)',
    badge:       '#16a34a',
    badgeText:   '#dcfce7',
    nameColor:   '#bbf7d0',
    glow:        'rgba(34,197,94,0.12)',
    accentLine:  '#22c55e',
    hoverBorder: 'rgba(34,197,94,0.6)',
    label: '24H', icon: 'brightness_5',
  },
  descanso_remunerado: {
    bg:          'linear-gradient(145deg, #064e3b 0%, #0a1610 100%)',
    border:      'rgba(16,185,129,0.35)',
    badge:       '#059669',
    badgeText:   '#d1fae5',
    nameColor:   '#a7f3d0',
    glow:        'rgba(16,185,129,0.10)',
    accentLine:  '#10b981',
    hoverBorder: 'rgba(16,185,129,0.6)',
    label: 'DR', icon: 'event_available',
  },
  descanso_no_remunerado: {
    bg:          'linear-gradient(145deg, #451a03 0%, #1a0e03 100%)',
    border:      'rgba(245,158,11,0.35)',
    badge:       '#d97706',
    badgeText:   '#fef3c7',
    nameColor:   '#fde68a',
    glow:        'rgba(245,158,11,0.10)',
    accentLine:  '#f59e0b',
    hoverBorder: 'rgba(245,158,11,0.6)',
    label: 'NR', icon: 'block',
  },
  vacacion: {
    bg:          'linear-gradient(145deg, #065f46 0%, #051a0f 100%)',
    border:      'rgba(52,211,153,0.40)',
    badge:       '#059669',
    badgeText:   '#d1fae5',
    nameColor:   '#6ee7b7',
    glow:        'rgba(52,211,153,0.12)',
    accentLine:  '#34d399',
    hoverBorder: 'rgba(52,211,153,0.65)',
    label: 'VAC', icon: 'beach_access',
  },
  licencia: {
    bg:          'linear-gradient(145deg, #713f12 0%, #1a0e00 100%)',
    border:      'rgba(234,179,8,0.40)',
    badge:       '#ca8a04',
    badgeText:   '#fef9c3',
    nameColor:   '#fde047',
    glow:        'rgba(234,179,8,0.12)',
    accentLine:  '#eab308',
    hoverBorder: 'rgba(234,179,8,0.6)',
    label: 'LC', icon: 'report',
  },
  suspension: {
    bg:          'linear-gradient(145deg, #450a0a 0%, #0f0000 100%)',
    border:      'rgba(239,68,68,0.45)',
    badge:       '#dc2626',
    badgeText:   '#fee2e2',
    nameColor:   '#fca5a5',
    glow:        'rgba(239,68,68,0.15)',
    accentLine:  '#ef4444',
    hoverBorder: 'rgba(239,68,68,0.7)',
    label: 'SP', icon: 'gavel',
  },
  incapacidad: {
    bg:          'linear-gradient(145deg, #3b0764 0%, #0f0520 100%)',
    border:      'rgba(167,139,250,0.40)',
    badge:       '#7c3aed',
    badgeText:   '#ede9fe',
    nameColor:   '#c4b5fd',
    glow:        'rgba(167,139,250,0.12)',
    accentLine:  '#a78bfa',
    hoverBorder: 'rgba(167,139,250,0.65)',
    label: 'IN', icon: 'medical_services',
  },
  accidente: {
    bg:          'linear-gradient(145deg, #881337 0%, #1a050a 100%)',
    border:      'rgba(244,63,94,0.50)',
    badge:       '#e11d48',
    badgeText:   '#ffe4e6',
    nameColor:   '#fda4af',
    glow:        'rgba(244,63,94,0.18)',
    accentLine:  '#f43f5e',
    hoverBorder: 'rgba(244,63,94,0.7)',
    label: 'AC', icon: 'emergency',
  },
};

const getStyle = (asig: AsignacionDia, turnoConf?: TurnoConfig) => {
  // 1. Prioridad: Código personalizado (Mejora 1)
  if (asig.codigo_personalizado && asig.codigo_personalizado !== '-') {
    const est = ESTADOS_LABORALES.find(e => e.codigo === asig.codigo_personalizado);
    if (est) {
      const base = JORNADA_STYLES[est.jornada] || JORNADA_STYLES.normal;
      return { ...base, label: est.codigo, icon: est.icono };
    }
  }

  // 2. Por jornada (Motor de Turnos)
  const specialKeys = [
    'descanso_remunerado', 'descanso_no_remunerado', 'vacacion',
    'licencia', 'suspension', 'incapacidad', 'accidente'
  ];
  if (specialKeys.includes(asig.jornada)) {
    return JORNADA_STYLES[asig.jornada] ?? JORNADA_STYLES.normal;
  }

  // 3. Detectar noche por turno, rol o config
  const role = asig.rol || '';
  const startHour = turnoConf?.inicio ? parseInt(turnoConf.inicio.split(':')[0]) : 6;
  const isNight = asig.jornada === 'PM' ||
    asig.turno === 'PM' ||
    turnoConf?.id === 'PM' ||
    (startHour >= 17 || startHour < 5) ||
    (['b', 'pm', 'noche', 'nocturno', 'vigilia'].some(k => role.toLowerCase().includes(k)));

  const base = isNight ? { ...JORNADA_STYLES.PM } : { ...JORNADA_STYLES.AM };

  // Respetar color personalizado del turno
  if (turnoConf?.color) {
    base.badge = turnoConf.color;
    base.border = `${turnoConf.color}60`;
    base.glow   = `${turnoConf.color}18`;
    base.accentLine = turnoConf.color;
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
  syncStatus = 'synced',
}: CeldaCalendarioProps) => {

  const isSinAsignar = asig.jornada === 'sin_asignar' || !asig.vigilanteId;

  // ── CELDA VACÍA ─────────────────────────────────────────────────────────────
  if (isSinAsignar) {
    return (
      <button
        onClick={onEdit}
        title={`Día ${asig.dia} · Clic para asignar`}
        className="celda-vacia w-full h-full flex flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/[0.07] hover:border-sky-500/40 transition-all duration-300 group relative overflow-hidden"
        style={{ minHeight: 90, background: 'rgba(15,23,42,0.4)' }}
      >
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '12px 12px'
        }} />
        
        <div
          className="size-10 rounded-[14px] flex items-center justify-center text-slate-600 group-hover:text-sky-400 group-hover:scale-110 group-hover:rotate-90 transition-all duration-500 relative z-10"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="material-symbols-outlined text-[22px]">add</span>
        </div>
        <span className="text-[7px] font-black text-slate-700 group-hover:text-sky-400/80 uppercase tracking-[0.25em] transition-colors relative z-10">
          ASIGNAR
        </span>
        
        {/* Hover glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(14,165,233,0.06), transparent 70%)' }}
        />
      </button>
    );
  }

  // ── CELDA CON ASIGNACIÓN ────────────────────────────────────────────────────
  const turnoConf = turnosConfig?.find(t => t.id === asig.turno);
  const style = getStyle(asig, turnoConf);

  const rawName = typeof vigilanteNombre === 'string' ? vigilanteNombre : (vigilanteNombre?.nombre || '');
  const nameParts = rawName.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  // Conflicto → override rojo
  const conflictStyle = {
    bg:          'linear-gradient(145deg, #7f1d1d 0%, #1a0505 100%)',
    border:      'rgba(248,113,113,0.65)',
    badge:       '#dc2626',
    badgeText:   '#fee2e2',
    nameColor:   '#fecaca',
    glow:        'rgba(248,113,113,0.25)',
    accentLine:  '#f87171',
    hoverBorder: 'rgba(248,113,113,0.8)',
    label: '!!', icon: 'priority_high',
  };

  const s = hasConflict ? conflictStyle : style;

  return (
    <button
      onClick={onEdit}
      title={hasConflict ? `⚠️ DOBLE ASIGNACIÓN: ${conflictDetail}` : `${rawName} · ${s.label}`}
      className={`celda-asignada w-full h-full flex flex-col rounded-[18px] border-[1.5px] hover:scale-[1.04] hover:z-50 transition-all duration-300 group overflow-hidden relative ${hasConflict ? 'animate-pulse' : ''}`}
      style={{
        minHeight: 90,
        background: s.bg,
        borderColor: s.border,
        boxShadow: `0 4px 24px -6px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.hoverBorder || s.border; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = s.border; }}
    >
      {/* Conflicto badge */}
      {hasConflict && (
        <>
          <div className="absolute -top-1 -right-1 size-5 bg-rose-500 rounded-full animate-ping opacity-60 z-10" />
          <div className="absolute top-0.5 right-0.5 size-4 bg-rose-500 rounded-full z-20 flex items-center justify-center shadow-[0_0_14px_rgba(244,63,94,0.9)] border border-white/20">
            <span className="text-white text-[7px] font-black">!</span>
          </div>
        </>
      )}

      {/* Sync state badge */}
      {syncStatus === 'pending' && (
        <div className="absolute top-1.5 right-1.5 z-[60] flex items-center justify-center pointer-events-none">
           <div className="size-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="absolute top-1.5 right-1.5 size-3.5 bg-rose-600 rounded-full z-20 flex items-center justify-center shadow-[0_0_8px_rgba(225,29,72,0.7)] animate-pulse border border-white/20">
          <span className="text-white text-[7px] font-black">!</span>
        </div>
      )}

      {/* ── TOP BAR: badge + icon ── */}
      <div className="flex items-center justify-between px-2.5 pt-2 pb-1 relative z-10">
        <div
          className="flex items-center gap-1 px-2 py-[3px] rounded-lg"
          style={{ background: `${s.badge}22`, border: `1px solid ${s.badge}44` }}
        >
          <span className="material-symbols-outlined text-[12px]" style={{ color: s.badgeText }}>
            {s.icon}
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: s.badgeText }}>
            {s.label}
          </span>
        </div>
        
        {/* Estado punto */}
        <div className="size-2 rounded-full animate-pulse" style={{ backgroundColor: s.accentLine, boxShadow: `0 0 8px ${s.accentLine}` }} />
      </div>

      {/* ── GUARD NAME (centro) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 relative z-10 min-h-0">
        <span
          className="text-[13px] font-black leading-tight text-center w-full truncate uppercase tracking-wide"
          style={{ color: s.nameColor, textShadow: `0 1px 8px ${s.glow}` }}
        >
          {firstName}
        </span>
        {lastName && (
          <span
            className="text-[9px] font-bold leading-none text-center w-full truncate uppercase opacity-60 mt-0.5"
            style={{ color: s.nameColor }}
          >
            {lastName}
          </span>
        )}
      </div>

      {/* ── BOTTOM BAR: turno + hora ── */}
      <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 mx-2 mb-2 rounded-xl relative z-10"
        style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${s.border}` }}
      >
        <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: s.badgeText }}>
          {turnoConf?.nombre || s.label}
        </span>
        {turnoConf?.inicio && (
          <>
            <div className="w-px h-2.5 rounded-full" style={{ background: `${s.badge}66` }} />
            <span className="text-[8px] font-bold tabular-nums" style={{ color: `${s.badgeText}cc` }}>
              {turnoConf.inicio}
            </span>
          </>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-[10%] h-[2.5px] w-[80%] rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${s.accentLine}, transparent)`, opacity: 0.7 }}
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[18px]"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${s.glow}, transparent 70%)` }}
      />
    </button>
  );
});
