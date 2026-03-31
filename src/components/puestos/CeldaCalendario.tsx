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
  { id: "normal", nombre: "Normal", short: "N", color: "#4318FF", textColor: "#fff" },
  { id: "descanso_remunerado", nombre: "Desc. Rem.", short: "DR", color: "#00b377", textColor: "#fff" },
  { id: "descanso_no_remunerado", nombre: "Desc. N/Rem.", short: "DNR", color: "#ff9500", textColor: "#fff" },
  { id: "vacacion", nombre: "Vacación", short: "VAC", color: "#8b5cf6", textColor: "#fff" },
  { id: "sin_asignar", nombre: "Sin asignar", short: "-", color: "#ef4444", textColor: "#fff" },
];

const TURNO_VISUAL: Record<string, { bg: string; bgGrad: string; text: string; icon: string; label: string; border: string }> = {
  AM:  { bg: '#2563EB', bgGrad: 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)', text: '#fff', icon: 'light_mode', label: 'DIA', border: '#60a5fa' },
  PM:  { bg: '#1e1b4b', bgGrad: 'linear-gradient(145deg, #312e81 0%, #0f0a3c 100%)', text: '#c7d2fe', icon: 'dark_mode', label: 'NOCHE', border: '#6366f1' },
  '24H': { bg: '#7c3aed', bgGrad: 'linear-gradient(145deg, #8b5cf6 0%, #6d28d9 100%)', text: '#fff', icon: 'schedule', label: '24H', border: '#a78bfa' },
};

const getTurnoVisual = (turnoId: string) => {
  if (turnoId in TURNO_VISUAL) return TURNO_VISUAL[turnoId];
  return TURNO_VISUAL['AM'];
};

export const CeldaCalendario = React.memo(({
  asig,
  vigilanteNombre,
  onEdit,
  jornadasCustom,
  turnosConfig,
}: CeldaCalendarioProps) => {
  const jList = jornadasCustom?.length ? jornadasCustom : DEFAULT_JORNADAS;
  const j = jList.find((x) => x.id === asig.jornada) ?? DEFAULT_JORNADAS[4];
  const isSinAsignar = asig.jornada === "sin_asignar" || !asig.vigilanteId;

  if (isSinAsignar) {
    return (
      <button
        onClick={onEdit}
        title={`Dia ${asig.dia} - Sin asignar`}
        className="w-full h-full rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-500 transition-all group"
        style={{ minHeight: "72px" }}
      >
        <span className="material-symbols-outlined text-red-400 text-[18px] group-hover:scale-110 transition-transform">
          person_add
        </span>
        <span className="text-[8px] font-black text-red-400 uppercase mt-0.5">Asignar</span>
      </button>
    );
  }

  const nameParts = (vigilanteNombre || "").trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ");
  
  const turnoConf = turnosConfig?.find(t => t.id === asig.turno);
  const tv = getTurnoVisual(asig.turno);
  const isDescanso = asig.jornada === 'descanso_remunerado' || asig.jornada === 'descanso_no_remunerado' || asig.jornada === 'vacacion';

  const cellGrad = isDescanso ? `linear-gradient(145deg, ${j.color} 0%, ${j.color}cc 100%)` : tv.bgGrad;
  const cellText = isDescanso ? j.textColor : tv.text;

  return (
    <button
      onClick={onEdit}
      className="w-full h-full rounded-xl flex flex-col items-center justify-center shadow-sm hover:scale-105 hover:shadow-lg hover:z-10 relative transition-all px-1 py-1 overflow-hidden group"
      style={{ background: cellGrad, minHeight: "72px", border: `2px solid ${isDescanso ? j.color : tv.border}44` }}
    >
      <span className="absolute top-1 left-1 material-symbols-outlined opacity-40 group-hover:opacity-70 transition-opacity" style={{ fontSize: '11px', color: cellText }}>
        {tv.icon}
      </span>
      <span className="absolute top-1 right-1 text-[6px] font-black uppercase tracking-tight px-1 py-0.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.2)', color: cellText }}>
        {tv.label}
      </span>
      <span className="text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight leading-none mb-0.5 mt-2" style={{ background: isDescanso ? 'rgba(0,0,0,0.25)' : j.color, color: '#fff' }}>
        {j.short}
      </span>
      <span className="text-[9px] font-black leading-tight text-center w-full px-0.5 truncate" style={{ color: cellText }}>
        {firstName}
      </span>
      {lastName && (
        <span className="text-[7px] font-bold leading-none text-center w-full px-0.5 opacity-80 truncate" style={{ color: cellText }}>
          {lastName.split(" ")[0]}
        </span>
      )}
      {turnoConf && (
        <span className="text-[6px] font-bold mt-auto pt-0.5 opacity-60" style={{ color: cellText }}>
          {turnoConf.inicio}-{turnoConf.fin}
        </span>
      )}
    </button>
  );
});
