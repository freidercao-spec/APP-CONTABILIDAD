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
  isGuardRetired?: boolean;   // true si el vigilante asignado ya fue dado de baja y no tiene turno trabajado
  isGuardInactiveWorked?: boolean; // true si la persona trabajó este turno pero está dada de baja actualmente
}

// ─── PALETA VISUAL PREMIUM ──────────────────────────────────────────────────
const JORNADA_STYLES: Record<string, {
  bg: string; border: string; badge: string; badgeText: string;
  nameColor: string; glow: string; label: string; icon: string;
  accentLine: string; hoverBorder: string;
}> = {
  normal: {
    bg:          '#f0f9ff', // Light Sky
    border:      '#bae6fd',
    badge:       '#0284c7',
    badgeText:   '#0369a1',
    nameColor:   '#0f172a',
    glow:        'rgba(0,0,0,0.02)',
    accentLine:  '#0284c7',
    hoverBorder: '#38bdf8',
    label: 'D', icon: 'light_mode',
  },
  AM: {
    bg:          '#f0f9ff', // Light Sky
    border:      '#bae6fd',
    badge:       '#0284c7',
    badgeText:   '#0369a1',
    nameColor:   '#0f172a',
    glow:        'rgba(0,0,0,0.02)',
    accentLine:  '#0284c7',
    hoverBorder: '#38bdf8',
    label: 'D', icon: 'light_mode',
  },
  PM: {
    bg:          '#faf5ff', // Light Purple
    border:      '#e9d5ff',
    badge:       '#7c3aed',
    badgeText:   '#6d28d9',
    nameColor:   '#0f172a',
    glow:        'rgba(0,0,0,0.02)',
    accentLine:  '#7c3aed',
    hoverBorder: '#c084fc',
    label: 'N', icon: 'dark_mode',
  },
  '24H': {
    bg:          '#f0fdf4', // Light Green
    border:      '#bbf7d0',
    badge:       '#16a34a',
    badgeText:   '#15803d',
    nameColor:   '#0f172a',
    glow:        'rgba(0,0,0,0.02)',
    accentLine:  '#16a34a',
    hoverBorder: '#4ade80',
    label: '24H', icon: 'brightness_5',
  },
  descanso_remunerado: {
    bg:          '#ecfdf5', // Light Emerald
    border:      '#a7f3d0',
    badge:       '#059669',
    badgeText:   '#047857',
    nameColor:   '#064e3b',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#059669',
    hoverBorder: '#34d399',
    label: 'DR', icon: 'event_available',
  },
  descanso_no_remunerado: {
    bg:          '#fffbeb', // Light Amber
    border:      '#fde68a',
    badge:       '#d97706',
    badgeText:   '#b45309',
    nameColor:   '#78350f',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#d97706',
    hoverBorder: '#fbbf24',
    label: 'NR', icon: 'block',
  },
  vacacion: {
    bg:          '#eff6ff', // Light Blue
    border:      '#bfdbfe',
    badge:       '#2563eb',
    badgeText:   '#1d4ed8',
    nameColor:   '#1e3a8a',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#2563eb',
    hoverBorder: '#60a5fa',
    label: 'VAC', icon: 'beach_access',
  },
  licencia: {
    bg:          '#fefce8', // Light Yellow
    border:      '#fef08a',
    badge:       '#ca8a04',
    badgeText:   '#a16207',
    nameColor:   '#713f12',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#ca8a04',
    hoverBorder: '#facc15',
    label: 'LC', icon: 'report',
  },
  suspension: {
    bg:          '#fef2f2', // Light Red
    border:      '#fecaca',
    badge:       '#dc2626',
    badgeText:   '#b91c1c',
    nameColor:   '#7f1d1d',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#dc2626',
    hoverBorder: '#f87171',
    label: 'SP', icon: 'gavel',
  },
  incapacidad: {
    bg:          '#faf5ff', // Light Violet
    border:      '#e9d5ff',
    badge:       '#8b5cf6',
    badgeText:   '#7c3aed',
    nameColor:   '#5b21b6',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#8b5cf6',
    hoverBorder: '#a78bfa',
    label: 'IN', icon: 'medical_services',
  },
  accidente: {
    bg:          '#fff1f2', // Light Rose
    border:      '#fecdd3',
    badge:       '#f43f5e',
    badgeText:   '#e11d48',
    nameColor:   '#881337',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#f43f5e',
    hoverBorder: '#fb7185',
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
  isGuardRetired = false,
  isGuardInactiveWorked = false,
}: CeldaCalendarioProps) => {

  const isSinAsignar = asig.jornada === 'sin_asignar';

  // ── CELDA BAJA / RETIRADO (Solo para celdas sin turno trabajado post-retiro) ─
  if (isGuardRetired && isSinAsignar && asig.vigilanteId) {
    const nombre = typeof vigilanteNombre === 'string' ? vigilanteNombre : vigilanteNombre?.nombre ?? 'Efectivo';
    return (
      <button
        onClick={onEdit}
        title="Vigilante retirado del sistema"
        style={{
          background: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: 10,
          width: '100%',
          minHeight: 56,
          padding: '4px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          cursor: 'pointer',
          opacity: 0.85,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 900, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1 }}>BAJA</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#fca5a5', marginTop: 1 }}>person_off</span>
      </button>
    );
  }

  // ── CELDA VACÍA ─────────────────────────────────────────────────────────────
  if (isSinAsignar) {
    return (
      <button
        onClick={onEdit}
        title={`Día ${asig.dia} · Clic para asignar`}
        className="celda-vacia w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-slate-300 hover:border-primary/45 transition-all duration-150 group relative overflow-hidden shadow-xs"
        style={{ minHeight: 82, background: '#f8fafc' }}
      >
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
          backgroundSize: '12px 12px'
        }} />
        
        <div
          className="size-8 rounded-[8px] flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all duration-300 relative z-10"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </div>
        <span className="text-[7.5px] font-bold text-slate-400 group-hover:text-primary uppercase tracking-[0.2em] transition-colors relative z-10">
          ASIGNAR
        </span>
        
        {/* Hover glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(13,110,253,0.04), transparent 70%)' }}
        />
      </button>
    );
  }

  // ── CELDA CON ASIGNACIÓN ────────────────────────────────────────────────────
  const turnoConf = turnosConfig?.find(t => t.id === asig.turno);
  const style = getStyle(asig, turnoConf);

  let firstName = '';
  let lastName = '';
  const isVacant = !asig.vigilanteId;

  if (isVacant) {
    firstName = '⚠️ VACANTE';
    lastName = 'Sin Vigilante';
  } else {
    const rawName = typeof vigilanteNombre === 'string' ? vigilanteNombre : (vigilanteNombre?.nombre || '');
    const nameParts = rawName.trim().split(' ');
    firstName = nameParts[0] || '';
    lastName  = nameParts.slice(1).join(' ') || '';
  }

  // Conflicto → override rojo
  const conflictStyle = {
    bg:          '#fee2e2', // Light Red
    border:      '#fecaca',
    badge:       '#dc2626',
    badgeText:   '#b91c1c',
    nameColor:   '#7f1d1d',
    glow:        'rgba(0,0,0,0.01)',
    accentLine:  '#dc2626',
    hoverBorder: '#ef4444',
    label: '!!', icon: 'priority_high',
  };

  const s = hasConflict ? conflictStyle : style;

  return (
    <button
      onClick={onEdit}
      title={hasConflict ? `⚠️ DOBLE ASIGNACIÓN: ${conflictDetail}` : `${isVacant ? 'Turno Vacante' : firstName + ' ' + lastName} · ${s.label}`}
      className={`celda-asignada w-full h-full flex flex-col rounded-[12px] border hover:scale-[1.02] hover:z-50 transition-all duration-150 group overflow-hidden relative ${hasConflict ? 'animate-pulse' : ''}`}
      style={{
        minHeight: 82,
        background: s.bg,
        borderColor: s.border,
        borderStyle: isVacant ? 'dashed' : 'solid',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.hoverBorder || s.border; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = s.border; }}
    >
      {/* Conflicto badge */}
      {hasConflict && (
        <div className="absolute top-0.5 right-0.5 size-4 bg-red-600 rounded-full z-20 flex items-center justify-center border border-white">
          <span className="text-white text-[7.5px] font-bold">!</span>
        </div>
      )}

      {/* Sync state badge */}
      {syncStatus === 'pending' && (
        <div className="absolute top-1 right-1 z-[60] flex items-center justify-center pointer-events-none">
           <div className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="absolute top-1 right-1 size-3 bg-red-600 rounded-full z-20 flex items-center justify-center border border-white">
          <span className="text-white text-[7px] font-bold">!</span>
        </div>
      )}

      {/* ── TOP BAR: badge + icon ── */}
      <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5 relative z-10 w-full">
        <div
          className="flex items-center gap-0.5 px-1.5 py-[1px] rounded"
          style={{ background: `${s.badge}15`, border: `1px solid ${s.badge}30` }}
        >
          <span className="material-symbols-outlined text-[10px]" style={{ color: s.badgeText }}>
            {s.icon}
          </span>
          <span className="text-[7.5px] font-bold uppercase tracking-wider" style={{ color: s.badgeText }}>
            {s.label}
          </span>
        </div>
        
        {isGuardInactiveWorked ? (
          <div className="flex items-center gap-0.5 px-1 py-[1px] bg-red-100 border border-red-300 rounded text-[7px] font-black text-red-700 tracking-tight" title="Efectivo dado de baja del sistema (Turno trabajado registrado para liquidación)">
            <span className="material-symbols-outlined text-[8px] text-red-600">person_off</span>
            <span>BAJA</span>
          </div>
        ) : (
          /* Estado punto */
          <div className="size-1.5 rounded-full" style={{ backgroundColor: s.accentLine }} />
        )}
      </div>

      {/* ── GUARD NAME (centro) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-1.5 relative z-10 min-h-0 w-full">
        <span
          className="text-[11px] font-bold leading-tight text-center w-full truncate uppercase tracking-tight"
          style={{ color: isVacant ? '#64748b' : s.nameColor }}
        >
          {firstName}
        </span>
        {lastName && (
          <span
            className="text-[8px] font-semibold leading-none text-center w-full truncate uppercase opacity-75 mt-0.5"
            style={{ color: isVacant ? '#94a3b8' : s.nameColor }}
          >
            {lastName}
          </span>
        )}
      </div>

      {/* ── BOTTOM BAR: turno + hora ── */}
      <div className="flex items-center justify-center gap-1 px-1.5 py-1 mx-1.5 mb-1.5 rounded-md relative z-10 border w-[calc(100%-12px)]"
        style={{ background: '#ffffff', borderColor: '#cbd5e1' }}
      >
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-700">
          {turnoConf?.nombre || s.label}
        </span>
        {(asig.inicio || turnoConf?.inicio) && (
          <>
            <div className="w-px h-2 bg-slate-300" />
            <span className="text-[7.5px] font-semibold text-slate-600 tabular-nums">
              {asig.inicio || turnoConf?.inicio}
              {(asig.fin || turnoConf?.fin) ? `-${asig.fin || turnoConf?.fin}` : ''}
            </span>
          </>
        )}
      </div>
    </button>
  );
});
