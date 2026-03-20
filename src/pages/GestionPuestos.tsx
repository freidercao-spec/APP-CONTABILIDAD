import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  usePuestoStore,
  type TurnoConfig,
  type JornadaCustom,
} from "../store/puestoStore";
import { useVigilanteStore } from "../store/vigilanteStore";
import {
  useProgramacionStore,
  type AsignacionDia,
  type TipoJornada,
  RolPuesto,
  type TemplateProgramacion,
  type TurnoHora,
} from "../store/programacionStore";
import { useAuthStore } from "../store/authStore";
import { useAuditStore } from "../store/auditStore";
import { useAIStore } from "../store/aiStore";
import { showTacticalToast } from "../utils/tacticalToast";
import { MilitaryTimeInput } from "../components/ui/MilitaryTimeInput";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";

// â”€â”€ Default turn config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEFAULT_TURNOS: TurnoConfig[] = [
  { id: "AM", nombre: "Turno AM", inicio: "06:00", fin: "18:00" },
  { id: "PM", nombre: "Turno PM", inicio: "18:00", fin: "06:00" },
];

// â”€â”€ Default jornada colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEFAULT_JORNADAS: JornadaCustom[] = [
  {
    id: "normal",
    nombre: "Normal",
    short: "N",
    color: "#4318FF",
    textColor: "#fff",
  },
  {
    id: "descanso_remunerado",
    nombre: "Desc. Rem.",
    short: "DR",
    color: "#00b377",
    textColor: "#fff",
  },
  {
    id: "descanso_no_remunerado",
    nombre: "Desc. N/Rem.",
    short: "DNR",
    color: "#ff9500",
    textColor: "#fff",
  },
  {
    id: "vacacion",
    nombre: "Vacación",
    short: "VAC",
    color: "#8b5cf6",
    textColor: "#fff",
  },
  {
    id: "sin_asignar",
    nombre: "Sin asignar",
    short: "-",
    color: "#ef4444",
    textColor: "#fff",
  },
];

const getJornada = (id: string, custom?: JornadaCustom[]) => {
  const list = custom?.length ? custom : DEFAULT_JORNADAS;
  return list.find((j) => j.id === id) ?? DEFAULT_JORNADAS[4];
};

const ROL_LABELS: Record<RolPuesto, string> = {
  titular_a: "Titular A",
  titular_b: "Titular B",
  relevante: "Relevante",
};

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// â”€â”€ Legacy compat shim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const JORNADA_COLORS: Record<
  string,
  { bg: string; text: string; label: string; short: string }
> = {
  normal: { bg: "#4318FF", text: "#fff", label: "Normal", short: "N" },
  descanso_remunerado: {
    bg: "#00b377",
    text: "#fff",
    label: "Desc. Rem.",
    short: "DR",
  },
  descanso_no_remunerado: {
    bg: "#ff9500",
    text: "#fff",
    label: "Desc. N/Rem.",
    short: "DNR",
  },
  vacacion: { bg: "#8b5cf6", text: "#fff", label: "Vacación", short: "VAC" },
  sin_asignar: {
    bg: "#ef4444",
    text: "#fff",
    label: "Sin asignar",
    short: "!",
  },
};

// â”€â”€ Subcomponents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Helper to keep row keys unique even with many turnos (AM, PM, and custom ones)
const getRolForTurno = (tConf: TurnoConfig, tIdx: number): RolPuesto => {
  if (tIdx === 0) return "titular_a";
  if (tIdx === 1) return "titular_b";
  if (tIdx === 2) return "relevante";
  // For any extra rows (4, 5, etc.), use the specific turno ID to prevent collisions
  return tConf.id as RolPuesto;
};

interface CeldaCalendarioProps {
  asig: AsignacionDia;
  vigilanteNombre?: string;
  onEdit: () => void;
  jornadasCustom?: JornadaCustom[];
  turnosConfig?: TurnoConfig[];
}

const hexToRgb = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const TURNO_VISUAL: Record<string, { bg: string; bgGrad: string; text: string; icon: string; label: string; border: string }> = {
  AM:  { bg: '#2563EB', bgGrad: 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)', text: '#fff', icon: 'light_mode', label: 'DIA', border: '#60a5fa' },
  PM:  { bg: '#1e1b4b', bgGrad: 'linear-gradient(145deg, #312e81 0%, #0f0a3c 100%)', text: '#c7d2fe', icon: 'dark_mode', label: 'NOCHE', border: '#6366f1' },
  '24H': { bg: '#7c3aed', bgGrad: 'linear-gradient(145deg, #8b5cf6 0%, #6d28d9 100%)', text: '#fff', icon: 'schedule', label: '24H', border: '#a78bfa' },
};

const getTurnoVisual = (turnoId: string) => {
  if (turnoId in TURNO_VISUAL) return TURNO_VISUAL[turnoId];
  // Heuristic: if start hour is before 14:00 treat as AM-ish, else PM-ish
  return TURNO_VISUAL['AM'];
};

const CeldaCalendario = ({
  asig,
  vigilanteNombre,
  onEdit,
  jornadasCustom,
  turnosConfig,
}: CeldaCalendarioProps) => {
  const jList = jornadasCustom?.length ? jornadasCustom : DEFAULT_JORNADAS;
  const j = jList.find((x) => x.id === asig.jornada) ?? DEFAULT_JORNADAS[4];
  const isSinAsignar = asig.jornada === "sin_asignar" || !asig.vigilanteId;

  const nameParts = (vigilanteNombre || "").trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ");
  
  // Determine turno visual style
  const turnoConf = turnosConfig?.find(t => t.id === asig.turno);
  const tv = getTurnoVisual(asig.turno);
  const isDescanso = asig.jornada === 'descanso_remunerado' || asig.jornada === 'descanso_no_remunerado' || asig.jornada === 'vacacion';

  if (isSinAsignar) {
    return (
      <button
        onClick={onEdit}
        title={`Dia ${asig.dia} - Sin asignar - Click para asignar`}
        className="w-full h-full rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-500 transition-all group"
        style={{ minHeight: "72px" }}
      >
        <span className="material-symbols-outlined text-red-400 text-[18px] group-hover:scale-110 transition-transform">
          person_add
        </span>
        <span className="text-[8px] font-black text-red-400 uppercase mt-0.5">
          Asignar
        </span>
      </button>
    );
  }

  // For descansos/vacaciones, use jornada color but STILL show turno indicator
  const cellBg = isDescanso ? j.color : tv.bg;
  const cellGrad = isDescanso ? `linear-gradient(145deg, ${j.color} 0%, ${j.color}cc 100%)` : tv.bgGrad;
  const cellText = isDescanso ? j.textColor : tv.text;
  const turnoIcon = tv.icon;

  return (
    <button
      onClick={onEdit}
      title={`${vigilanteNombre} | ${turnoConf?.nombre || asig.turno} (${turnoConf?.inicio || ''}-${turnoConf?.fin || ''}) | ${j.nombre}`}
      className="w-full h-full rounded-xl flex flex-col items-center justify-center shadow-sm hover:scale-105 hover:shadow-lg hover:z-10 relative transition-all px-1 py-1 overflow-hidden group"
      style={{ background: cellGrad, minHeight: "72px", border: `2px solid ${isDescanso ? j.color : tv.border}44` }}
    >
      {/* Turno icon indicator (top-left) */}
      <span 
        className="absolute top-1 left-1 material-symbols-outlined opacity-40 group-hover:opacity-70 transition-opacity"
        style={{ fontSize: '11px', color: cellText }}
      >
        {turnoIcon}
      </span>

      {/* Turno label (top-right) */}
      <span 
        className="absolute top-1 right-1 text-[6px] font-black uppercase tracking-tight px-1 py-0.5 rounded-sm"
        style={{ background: 'rgba(255,255,255,0.2)', color: cellText }}
      >
        {tv.label}
      </span>

      {/* Jornada badge */}
      <span
        className="text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight leading-none mb-0.5 mt-2"
        style={{ background: isDescanso ? 'rgba(0,0,0,0.25)' : j.color, color: '#fff' }}
      >
        {j.short}
      </span>

      {/* Vigilante first name */}
      {firstName && (
        <span
          className="text-[9px] font-black leading-tight text-center w-full px-0.5"
          style={{ color: cellText }}
        >
          {firstName}
        </span>
      )}
      {/* Vigilante last name (first word) */}
      {lastName && (
        <span
          className="text-[7px] font-bold leading-none text-center w-full px-0.5 opacity-80"
          style={{ color: cellText }}
        >
          {lastName.split(" ")[0]}
        </span>
      )}

      {/* Turno time footer */}
      {turnoConf && (
        <span 
          className="text-[6px] font-bold mt-auto pt-0.5 opacity-60"
          style={{ color: cellText }}
        >
          {turnoConf.inicio}-{turnoConf.fin}
        </span>
      )}
    </button>
  );
};

// Empty turno slot — shows a [â +â ] add button
const CeldaVacia = ({
  onAdd,
  isWeekend,
}: {
  onAdd: () => void;
  isWeekend?: boolean;
}) => (
  <button
    onClick={onAdd}
    className={`w-full h-full rounded-lg flex items-center justify-center border border-dashed transition-all group ${
      isWeekend
        ? "border-slate-200 bg-slate-50/80"
        : "border-slate-100 bg-slate-50/40"
    } hover:border-primary/40 hover:bg-primary/5`}
    style={{ minHeight: "72px" }}
    title="Click para asignar este turno"
  >
    <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-primary/60 transition-colors">
      add_circle
    </span>
  </button>
);

// Modal for editing a single day cell — with cross-validation
interface EditCeldaModalProps {
  asig: AsignacionDia;
  vigilantes: { id: string; nombre: string; estado?: string }[];
  titularesId: string[];
  ocupados: Map<string, string[]>; // vigilanteId -> ['dia-turno',...]
  turnosConfig: TurnoConfig[];
  jornadasCustom: JornadaCustom[];
  onSave: (data: Partial<AsignacionDia>) => void;
  onClose: () => void;
}

const EditCeldaModal = ({
  asig,
  vigilantes,
  titularesId,
  ocupados,
  turnosConfig,
  jornadasCustom,
  onSave,
  onClose,
}: EditCeldaModalProps) => {
  const [vigilanteId, setVigilanteId] = useState(asig.vigilanteId || "");
  const [turno, setTurno] = useState(asig.turno);
  const [jornada, setJornada] = useState<TipoJornada>(asig.jornada);
  const [conflicto, setConflicto] = useState<string | null>(null);

  const rolLabel = ROL_LABELS[asig.rol] || asig.rol;
  const jornadasList = jornadasCustom.length
    ? jornadasCustom
    : DEFAULT_JORNADAS;
  const turnoConf = turnosConfig.find((t) => t.id === turno);

  const checkConflict = (vid: string, t: string): string | null => {
    if (!vid) return null;
    const slots = ocupados.get(vid) || [];
    const match = slots.find((s) => s.slot === `${asig.dia}-${t}`);
    if (match) {
      const v = vigilantes.find((gv) => gv.id === vid || gv.dbId === vid);
      return `🚫 ${v?.nombre || "Efectivo"} ya tiene turno en "${match.puesto}" (Día ${asig.dia} ${t})`;
    }
    if (t === "AM") {
      const prevDay = asig.dia - 1;
      const pmMatch = slots.find((s) => s.slot === `${prevDay}-PM`);
      if (pmMatch) {
        const v = vigilantes.find((gv) => gv.id === vid || gv.dbId === vid);
        return `🚫 Turno Descansado: ${v?.nombre || "Efectivo"} trabajó PM en "${pmMatch.puesto}" el día anterior.`;
      }
    }
    return null;
  };

  const handleVigChange = (vid: string) => {
    setVigilanteId(vid);
    setConflicto(checkConflict(vid, turno));
  };
  const handleTurnoChange = (t: string) => {
    setTurno(t as typeof turno);
    setConflicto(checkConflict(vigilanteId, t));
  };

  const selectedVig = vigilantes.find(
    (v) => v.id === vigilanteId || v.dbId === vigilanteId,
  );
  const jornadaActual =
    jornadasList.find((j) => j.id === jornada) ?? jornadasList[0];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-5 duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* â”€â”€ Header â”€â”€ */}
        <div
          className="px-6 pt-6 pb-4 border-b border-slate-100"
          style={{
            background: "linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  edit_calendar
                </span>
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
                  Editar Turno
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase">
                  {rolLabel}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg">
                  Día {asig.dia}
                </span>
                {turnoConf && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg">
                    {turnoConf.nombre} · {turnoConf.inicio}–{turnoConf.fin}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-slate-500">
                close
              </span>
            </button>
          </div>

          {/* Current assignment preview */}
          {selectedVig && (
            <div
              className="mt-3 flex items-center gap-2 py-2 px-3 rounded-xl"
              style={{ background: jornadaActual.color + "22" }}
            >
              <div
                className="size-7 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0"
                style={{ background: jornadaActual.color }}
              >
                {selectedVig.nombre.charAt(0)}
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-800">
                  {selectedVig.nombre}
                </p>
                <p
                  className="text-[9px] font-bold"
                  style={{ color: jornadaActual.color }}
                >
                  {jornadaActual.nombre}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Conflict alert â”€â”€ */}
        {conflicto && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 items-start">
            <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5 shrink-0">
              block
            </span>
            <p className="text-[11px] font-bold text-red-700">{conflicto}</p>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* â”€â”€ Turno selector â”€â”€ */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Turno
            </label>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(turnosConfig.length, 3)}, 1fr)`,
              }}
            >
              {turnosConfig.map((t, idx) => {
                const turnoColors = [
                  "#4318FF",
                  "#0ea5e9",
                  "#10b981",
                  "#f59e0b",
                  "#8b5cf6",
                  "#ef4444",
                ];
                const col = turnoColors[idx % turnoColors.length];
                const isSelected = turno === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTurnoChange(t.id)}
                    className={`py-2.5 px-2 rounded-xl text-[10px] font-black border-2 transition-all`}
                    style={{
                      background: isSelected ? col : "transparent",
                      borderColor: isSelected ? col : "#e2e8f0",
                      color: isSelected ? "#fff" : col,
                    }}
                  >
                    <span className="block font-black">{t.nombre}</span>
                    <span className="block text-[8px] opacity-80 mt-0.5">
                      {t.inicio}–{t.fin}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* â”€â”€ Jornada type â”€â”€ */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Tipo de Jornada
            </label>
            <div className="grid grid-cols-3 gap-2">
              {jornadasList.map((j) => {
                const isSelected = jornada === j.id;
                return (
                  <button
                    key={j.id}
                    onClick={() => setJornada(j.id as TipoJornada)}
                    className={`py-2.5 px-2 rounded-xl text-[10px] font-black border-2 transition-all text-center`}
                    style={{
                      background: isSelected ? j.color : j.color + "15",
                      borderColor: isSelected ? j.color : j.color + "40",
                      color: isSelected ? j.textColor : j.color,
                    }}
                  >
                    <span className="block text-[12px] mb-0.5">{j.short}</span>
                    <span className="block text-[8px] leading-tight">
                      {j.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* â”€â”€ Vigilante quick-pick â”€â”€ */}
          {titularesId.length > 0 && (
            <div>
              <label className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 block">
                Titulares del Puesto
              </label>
              <div className="flex flex-wrap gap-2">
                {titularesId.map((vid) => {
                  const v = vigilantes.find(
                    (vig) => vig.id === vid || vig.dbId === vid,
                  );
                  if (!v) return null;
                  const v_id = v.id;
                  const isSelected =
                    vigilanteId === v.id || vigilanteId === v.dbId;
                  const c = checkConflict(v.id, turno);
                  return (
                    <button
                      key={v.id}
                      onClick={() => handleVigChange(v.id)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold border-2 transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                          : c
                            ? "bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {c ? "warning" : "person"}
                      </span>
                      {v.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* â”€â”€ Full vigilante selector â”€â”€ */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
              Todos los Vigilantes
            </label>
            <select
              value={vigilanteId}
              onChange={(e) => handleVigChange(e.target.value)}
              className="w-full h-11 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary/60 transition-colors"
            >
              <option value="">— Sin asignar —</option>
              <optgroup label="✅ TITULARES DEL PUESTO">
                {vigilantes
                  .filter(
                    (v) =>
                      titularesId.includes(v.id) ||
                      (v.dbId && titularesId.includes(v.dbId)),
                  )
                  .map((v) => {
                    const c = checkConflict(v.id, turno);
                    return (
                      <option key={v.id} value={v.id}>
                        {c ? `⚠️ ${v.nombre}` : v.nombre}
                      </option>
                    );
                  })}
              </optgroup>
              <optgroup label="🔄 REEMPLAZOS / OTROS">
                {vigilantes
                  .filter(
                    (v) =>
                      !titularesId.includes(v.id) &&
                      !(v.dbId && titularesId.includes(v.dbId)),
                  )
                  .map((v) => {
                    const c = checkConflict(v.id, turno);
                    return (
                      <option key={v.id} value={v.id}>
                        {c ? `⚠️ ${v.nombre}` : v.nombre}
                      </option>
                    );
                  })}
              </optgroup>
            </select>
          </div>
        </div>

        {/* â”€â”€ Actions â”€â”€ */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={() =>
              onSave({
                vigilanteId: null,
                turno: turno as TurnoHora,
                jornada: "sin_asignar",
                rol: asig.rol,
              })
            }
            className="px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-50 hover:text-red-500 transition-all"
            title="Limpiar esta celda"
          >
            <span className="material-symbols-outlined text-[16px]">
              delete
            </span>
          </button>
          <button
            onClick={() =>
              onSave({
                vigilanteId: vigilanteId || null,
                turno: turno as TurnoHora,
                jornada,
                rol: asig.rol,
              })
            }
            className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg ${
              conflicto
                ? "bg-orange-500 text-white hover:brightness-110 shadow-orange-500/30"
                : "bg-primary text-white hover:brightness-110 shadow-primary/30 active:scale-95"
            }`}
          >
            {conflicto ? "Guardar con Aviso" : "Guardar Cambios"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€ Panel de Programación Mensual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface PanelMensualProps {
  puestoId: string;
  puestoNombre: string;
  anio: number;
  mes: number;
  onClose: () => void;
}

const PanelMensualPuesto = ({
  puestoId,
  puestoNombre,
  anio,
  mes,
  onClose,
}: PanelMensualProps) => {
  const { username } = useAuthStore();
  const vigilantes = useVigilanteStore((s) => s.vigilantes);
  const logAction = useAuditStore((s) => s.logAction);
  const addAIAction = useAIStore((s) => s.addAction);
  const allPuestos = usePuestoStore((s) => s.puestos);
  const puesto = useMemo(
    () => allPuestos.find((p) => p.id === puestoId || p.dbId === puestoId),
    [allPuestos, puestoId],
  );
  const updatePuesto = usePuestoStore((s) => s.updatePuesto);
  const allProgramaciones = useProgramacionStore((s) => s.programaciones);
  const updateGuardStatus = useVigilanteStore((s) => s.updateGuardStatus);

  // Use individual stable selectors instead of destructuring the whole store
  // (destructuring causes new object references each render = infinite loops)
  const crearOObtenerProgramacion = useProgramacionStore(
    (s) => s.crearOObtenerProgramacion,
  );
  const asignarPersonal = useProgramacionStore((s) => s.asignarPersonal);
  const actualizarAsignacion = useProgramacionStore(
    (s) => s.actualizarAsignacion,
  );
  const publicarProgramacion = useProgramacionStore(
    (s) => s.publicarProgramacion,
  );
  const guardarBorrador = useProgramacionStore((s) => s.guardarBorrador);
  const isSyncing = useProgramacionStore((s) => s.isSyncing);
  const lastSyncError = useProgramacionStore((s) => s.lastSyncError);
  const guardarComoPlantilla = useProgramacionStore(
    (s) => s.guardarComoPlantilla,
  );
  const aplicarPlantilla = useProgramacionStore((s) => s.aplicarPlantilla);
  const eliminarPlantilla = useProgramacionStore((s) => s.eliminarPlantilla);
  const getDiasTrabajoVigilante = useProgramacionStore(
    (s) => s.getDiasTrabajoVigilante,
  );
  const getDiasDescansoVigilante = useProgramacionStore(
    (s) => s.getDiasDescansoVigilante,
  );
  const getCoberturaPorcentaje = useProgramacionStore(
    (s) => s.getCoberturaPorcentaje,
  );
  const getAlertas = useProgramacionStore((s) => s.getAlertas);

  const getProgramacion = useProgramacionStore((s) => s.getProgramacion);
  const prog = useMemo(
    () => getProgramacion(puestoId, anio, mes),
    [allProgramaciones, getProgramacion, puestoId, anio, mes],
  );

  const allTemplates = useProgramacionStore((s) => s.templates);
  const templates = useMemo(() => {
    const pStore = usePuestoStore.getState().puestos;
    const currentPuesto = pStore.find(
      (p) => p.id === puestoId || p.dbId === puestoId,
    );
    const uuid = currentPuesto?.dbId || puestoId;
    const short = currentPuesto?.id || puestoId;
    return allTemplates.filter(
      (t) => t.puestoId === uuid || t.puestoId === short,
    );
  }, [allTemplates, puestoId]);

  const [editCell, setEditCell] = useState<AsignacionDia | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "calendario"
    | "personal"
    | "historial"
    | "alertas"
    | "config"
    | "plantillas"
  >("calendario");
  const [showJustificacion, setShowJustificacion] = useState<{
    vigilante: any;
    per: any;
    newVigilanteId: string;
  } | null>(null);
  const [justificacionText, setJustificacionText] = useState("");
  const [showSaveTplModal, setShowSaveTplModal] = useState(false);
  const [tplNombre, setTplNombre] = useState("");
  const alertasDisparadas = useRef<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Compare Panel State ---
  const [comparePuestoId, setComparePuestoId] = useState<string | null>(null);
  const [compareExpanded, setCompareExpanded] = useState(true);
  const fetchProgramacionById = useProgramacionStore(
    (s) => s.fetchProgramacionById,
  );

  // If prog not found in global store, try one targeted fetch before giving up
  useEffect(() => {
    if (!prog && !isRefreshing) {
      const checkDb = async () => {
        setIsRefreshing(true);
        // Search if there's any prog in DB for this posto/anio/mes
        const { data } = await supabase
          .from("programacion_mensual")
          .select("id")
          .eq("puesto_id", puestoId)
          .eq("anio", anio)
          .eq("mes", mes)
          .single();

        if (data?.id) {
          await fetchProgramacionById(data.id);
        }
        setIsRefreshing(false);
      };
      checkDb();
    }
  }, [prog, puestoId, anio, mes, fetchProgramacionById]);

  const handleGuardarPlantilla = () => {
    if (!tplNombre) return;
    guardarComoPlantilla(
      prog!.id,
      tplNombre,
      puestoNombre,
      username || "Sistema",
    );
    setShowSaveTplModal(false);
    setTplNombre("");
  };

  // Warn before closing if sync is pending
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSyncing) {
        e.preventDefault();
        e.returnValue =
          "Hay cambios guardándose en la nube. ¿Deseas salir de todas formas?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSyncing]);

  const handleAplicarPlantilla = (tpl: TemplateProgramacion) => {
    aplicarPlantilla(tpl.id, puestoId, anio, mes, username || "Sistema");
    showTacticalToast({
      title: "Plantilla Aplicada",
      message: `Se cargó "${tpl.nombre}" — puedes editar cualquier celda libremente.`,
      type: "info",
    });
    logAction(
      "PROGRAMACION",
      "Plantilla aplicada",
      `"${tpl.nombre}" — ${MONTH_NAMES[mes]} ${anio}`,
      "info",
    );
    setActiveTab("calendario");
  };

  const turnosConfig: TurnoConfig[] = puesto?.turnosConfig?.length
    ? puesto.turnosConfig
    : DEFAULT_TURNOS;
  const jornadasCustom: JornadaCustom[] = puesto?.jornadasCustom?.length
    ? puesto.jornadasCustom
    : [];

  // Cross-programacion occupied slots map — vigilanteId -> [{ slot: 'dia-turno', puesto: 'Name' }]
  const ocupados = useMemo(() => {
    const map = new Map<string, { slot: string; puesto: string }[]>();
    const pStore = usePuestoStore.getState().puestos;
    const currentPuesto = pStore.find(
      (p) => p.id === puestoId || p.dbId === puestoId,
    );
    const currentUuid = currentPuesto?.dbId || puestoId;
    const currentShort = currentPuesto?.id || puestoId;

    allProgramaciones
      .filter(
        (p) =>
          p.anio === anio &&
          p.mes === mes &&
          p.puestoId !== currentUuid &&
          p.puestoId !== currentShort,
      )
      .forEach((p) => {
        const externalPName =
          pStore.find((px) => px.id === p.puestoId || px.dbId === p.puestoId)
            ?.nombre || p.puestoId;
        p.asignaciones.forEach((a) => {
          if (!a.vigilanteId) return;
          const list = map.get(a.vigilanteId) || [];
          list.push({ slot: `${a.dia}-${a.turno}`, puesto: externalPName });
          map.set(a.vigilanteId, list);
        });
      });
    return map;
  }, [allProgramaciones, anio, mes, puestoId]);

  // Quincena rest counters — use stable string IDs as deps, not object references
  const progId = prog?.id;
  const progAsignacionesKey = prog?.asignaciones?.length ?? 0;
  const progPersonalKey =
    prog?.personal?.map((p) => p.vigilanteId).join(",") ?? "";
  const restCounters = useMemo(() => {
    if (!prog) return {};
    const result: Record<
      string,
      { q1rem: number; q1nrem: number; q2rem: number; q2nrem: number }
    > = {};
    (prog.personal || []).forEach((per) => {
      if (!per.vigilanteId) return;
      const vid = per.vigilanteId;
      result[vid] = { q1rem: 0, q1nrem: 0, q2rem: 0, q2nrem: 0 };
      (prog.asignaciones || [])
        .filter((a) => a.vigilanteId === vid)
        .forEach((a) => {
          const q = a.dia <= 15 ? "q1" : "q2";
          const key =
            `${q}${a.jornada === "descanso_remunerado" ? "rem" : "nrem"}` as keyof (typeof result)[string];
          if (result[vid][key] !== undefined) result[vid][key]++;
        });
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progId, progAsignacionesKey, progPersonalKey]);

  // Alert on unassigned cells - Only when tab is calendar, debounced to avoid loop
  const progIdForEffect = prog?.id;
  const progAsignacionesCountForEffect =
    prog?.asignaciones?.filter((a) => !a.vigilanteId).length ?? 0;
  useEffect(() => {
    if (!progIdForEffect || activeTab !== "calendario") return;
    if (progAsignacionesCountForEffect > 0) {
      const key = `missing-${progIdForEffect}-${progAsignacionesCountForEffect}`;
      if (alertasDisparadas.current.has(key)) return;
      alertasDisparadas.current.add(key);
      addAIAction({
        text: `**ASIGNACIÁ“N INCOMPLETA:** El puesto "${puestoNombre}" tiene ${progAsignacionesCountForEffect} turnos sin vigilante asignado para ${MONTH_NAMES[mes]}.`,
        type: "notification",
        sender: "ai",
        priority: "medium",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progIdForEffect, activeTab, progAsignacionesCountForEffect]);

  if (isRefreshing) {
    return (
      <div className="absolute inset-0 z-[50] bg-slate-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="relative size-16 mb-4">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Buscando datos en el servidor...
        </p>
      </div>
    );
  }

  if (!prog) {
    return (
      <div className="absolute inset-0 z-[50] bg-slate-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="size-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all border border-slate-200"
            >
              <span className="material-symbols-outlined font-black">
                arrow_back
              </span>
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
                {puestoNombre}
              </h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {MONTH_NAMES[mes]} {anio} · Programación Mensual
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <span className="material-symbols-outlined text-[80px] text-slate-200 mb-6 font-light">
            edit_calendar
          </span>
          <h3 className="text-2xl font-black text-slate-900 mb-2">
            Programación de {MONTH_NAMES[mes]} {anio}
          </h3>
          <p className="text-sm text-slate-500 mb-8 max-w-sm">
            No se ha iniciado la programación para este mes. Haz clic en el
            botón para generar el cuadro de turnos en blanco.
          </p>
          <button
            onClick={() => {
              crearOObtenerProgramacion(
                puestoId,
                anio,
                mes,
                username || "Sistema",
              );
              showTacticalToast({
                title: "Sistema Inicializado",
                message: `Panel de ${MONTH_NAMES[mes]} listo para despliegue.`,
                type: "success",
              });
            }}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 shadow-xl shadow-primary/30 transition-all hover:-translate-y-1"
          >
            <span className="material-symbols-outlined text-[20px]">
              add_circle
            </span>
            Iniciar Programación
          </button>
        </div>
      </div>
    );
  }

  const daysInMonth = new Date(anio, mes + 1, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const cobertura = getCoberturaPorcentaje(prog.id);
  const alertas = getAlertas(prog.id);

  const getVigilanteName = (id: string | null) => {
    if (!id) return undefined;
    return vigilantes.find((v) => v.dbId === id || v.id === id)?.nombre;
  };

  const handleSaveCell = (data: Partial<AsignacionDia>) => {
    if (!editCell) return;
    const resultado = actualizarAsignacion(
      prog.id,
      editCell.dia,
      { ...data, rol: editCell.rol },
      username || "Sistema",
    );
    if (!resultado.permitido) {
      showTacticalToast({
        title: "Restricción de Sistema",
        message: resultado.mensaje,
        type: "error",
      });
      logAction(
        "PROGRAMACION",
        "Asignación bloqueada por IA",
        resultado.regla || resultado.mensaje,
        "critical",
      );
    } else {
      showTacticalToast({
        title: "✅ Guardado Automático",
        message: `Día ${editCell.dia} actualizado y sincronizado con la base de datos.`,
        type: "success",
      });
      logAction(
        "PROGRAMACION",
        `Turno editado — Día ${editCell.dia}`,
        `Puesto: ${puestoNombre}`,
        "info",
      );
    }
    setEditCell(null);
  };

  const handlePublicar = () => {
    publicarProgramacion(prog.id, username || "Sistema");
    logAction(
      "PROGRAMACION",
      "Programación PUBLICADA",
      `Puesto: ${puestoNombre} · ${MONTH_NAMES[mes]} ${anio}`,
      "success",
    );
    showTacticalToast({
      title: "Despliegue Exitoso",
      message: "Programación publicada y activa para el personal.",
      type: "success",
    });
  };

  const handleBorrador = () => {
    guardarBorrador(prog.id, username || "Sistema");
    logAction(
      "PROGRAMACION",
      "Borrador guardado",
      `Puesto: ${puestoNombre}`,
      "info",
    );
    showTacticalToast({
      title: "Progreso Guardado",
      message: "Borrador almacenado en el núcleo del sistema.",
      type: "info",
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const accent: [number, number, number] = [11, 20, 65]; // Header bg
    const accentLight: [number, number, number] = [67, 24, 255]; // Primary
    const margin = 8;

    // â”€â”€ Helper to convert image to Base64 (Reliable Rendering) â”€â”€
    const getBase64Image = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } else reject();
        };
        img.onerror = reject;
        img.src = url;
      });
    };

    const generatePDF = async () => {
      const logoBase64 = await getBase64Image("/logo_premium.png").catch(
        () => null,
      );
      const now = new Date();
      const timestampStr = now.toLocaleString("es-CO", {
        dateStyle: "long",
        timeStyle: "short",
      });
      const shortTimestamp =
        now.toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " " +
        now.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

      const addHeaderLogo = (doc: jsPDF) => {
        if (logoBase64) {
          try {
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin + 2, 4, 26, 26, 3, 3, "F");
            doc.addImage(logoBase64, "PNG", margin + 3, 5, 24, 24);
          } catch (e) {
            console.error(e);
          }
        }
      };

      const addGridHeader = (
        doc: jsPDF,
        pageNum: number,
        totalPages: number,
      ) => {
        // Reset background
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageW, pageH, "F");

        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(0, 0, pageW, 25, "F");
        addHeaderLogo(doc);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(
          `CUADRO OPERATIVO MENSUAL — ${puestoNombre.toUpperCase()}`,
          margin + 34,
          10,
        );
        doc.setFontSize(7);
        doc.text(
          `MES: ${MONTH_NAMES[mes].toUpperCase()} ${anio} · EMISIÁ“N: ${shortTimestamp}`,
          margin + 34,
          16,
        );
        doc.text(
          `RESPONSABLE: ${username?.toUpperCase() || "CENTRAL"} · PÁGINA: ${pageNum}`,
          margin + 34,
          21,
        );
      };

      // ── PAGE 1: DETALLES Y RESUMEN ──
      doc.setFillColor(255, 255, 255); // White background
      doc.rect(0, 0, pageW, pageH, "F");
      
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.rect(0, 0, pageW, 34, "F");
      addHeaderLogo(doc);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(
        "REPORTE TÁCTICO DE PROGRAMACIÁ“N — CORAZA SEGURIDAD CTA",
        margin + 34,
        13,
      );

      doc.setFontSize(8);
      doc.setTextColor(180, 200, 255);
      doc.text(`INSTALACIÁ“N: ${puestoNombre.toUpperCase()}`, margin + 34, 20);
      doc.text(
        `MES OPERATIVO: ${MONTH_NAMES[mes].toUpperCase()} ${anio}`,
        margin + 34,
        26,
      );
      doc.text(
        `GENERADO POR: ${username?.toUpperCase() || "CENTRAL DE OPERACIONES"} — ${timestampStr.toUpperCase()}`,
        margin + 34,
        31,
      );

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(
        `VERSIÁ“N: ${prog.version} · ESTADO: ${prog.estado.toUpperCase()}`,
        pageW - margin,
        13,
        { align: "right" },
      );

      let curY = 42;
      doc.setFillColor(245, 247, 252);
      doc.roundedRect(margin, curY, pageW - margin * 2, 38, 3, 3, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(accentLight[0], accentLight[1], accentLight[2]);
      doc.text("DETALLES TÁ‰CNICOS DEL PUESTO", margin + 5, curY + 7);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 90);

      const details = [
        ["Puesto / Cliente:", `${puestoNombre} / ${puesto?.cliente || "—"}`],
        ["ID Interno:", puesto?.id || "—"],
        ["Ubicación:", puesto?.direccion || "ZONA METROPOLITANA"],
        ["Contacto Puesto:", puesto?.contacto || "—"],
        ["Teléfono:", puesto?.telefono || "—"],
        ["Tipo Servicio:", puesto?.tipoServicio || "PROGRAMA FIJO"],
        [
          "Armamento:",
          puesto?.conArmamento ? "SI (CON ARMA)" : "NO (SIN ARMA)",
        ],
        ["Prioridad:", (puesto?.prioridad || "media").toUpperCase()],
      ];
      details.forEach((pair, i) => {
        const x = i % 2 === 0 ? margin + 6 : pageW / 2.2;
        const r = Math.floor(i / 2);
        doc.setFont("helvetica", "bold");
        doc.text(pair[0], x, curY + 16 + r * 5);
        doc.setFont("helvetica", "normal");
        doc.text(pair[1].substring(0, 50), x + 35, curY + 16 + r * 5);
      });

      curY += 46;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMEN DE PERSONAL OPERATIVO", margin + 2, curY);
      curY += 6;
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.rect(margin, curY, pageW - margin * 2, 7.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      const headersSummary = [
        "ROL",
        "CÁ‰DULA / ID",
        "NOMBRES Y APELLIDOS COMPLETOS",
        "DÁAS T.",
        "Q1 (R/NR)",
        "Q2 (R/NR)",
        "TOTAL DESC.",
      ];
      const colWidthsSum = [28, 25, 65, 20, 30, 30, 20];
      let hx = margin + 2;
      headersSummary.forEach((h, i) => {
        doc.text(h, hx, curY + 5);
        hx += colWidthsSum[i];
      });
      curY += 7.5;

      prog.personal.forEach((per, pIdx) => {
        if (!per.vigilanteId) return;
        const vig = vigilantes.find((v) => v.id === per.vigilanteId);
        const diasT = getDiasTrabajoVigilante(prog.id, per.vigilanteId);
        const diasD = getDiasDescansoVigilante(prog.id, per.vigilanteId);
        const r = restCounters[per.vigilanteId] || {
          q1rem: 0,
          q1nrem: 0,
          q2rem: 0,
          q2nrem: 0,
        };
        doc.setFillColor(
          pIdx % 2 === 0 ? 250 : 255,
          pIdx % 2 === 0 ? 251 : 255,
          pIdx % 2 === 0 ? 255 : 255,
        );
        doc.rect(margin, curY, pageW - margin * 2, 7, "F");
        doc.setTextColor(40, 40, 70);
        doc.setFontSize(6.5);
        const row = [
          ROL_LABELS[per.rol].toUpperCase(),
          vig?.cedula || per.vigilanteId,
          (vig?.nombre || "VACANTE").toUpperCase(),
          String(diasT),
          `${r.q1rem} / ${r.q1nrem}`,
          `${r.q2rem} / ${r.q2nrem}`,
          String(diasD.remunerados + diasD.noRemunerados),
        ];
        let rx = margin + 2;
        row.forEach((cell, ci) => {
          doc.setFont("helvetica", ci === 0 ? "bold" : "normal");
          doc.text(cell, rx, curY + 4.5);
          rx += colWidthsSum[ci];
        });
        curY += 7;
      });

      // ── PAGE 2+: CALENDAR GRID ──
      doc.addPage("a4", "landscape");
      let currentPage = 2;
      addGridHeader(doc, currentPage, 0);

      let gridY = 32;
      const colW = (pageW - margin * 2) / (daysInMonth + 5); // Added more space for names
      const headerRowH = 10;
      const dataRowH = 16;

      const drawStickyHeader = (y: number) => {
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(margin, y, colW * 4.5, headerRowH, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text("VIGILANTE / TURNO", margin + colW * 2.25, y + 6, {
          align: "center",
        });
        dayNumbers.forEach((d, i) => {
          const x = margin + colW * 4.5 + i * colW;
          const dateObj = new Date(anio, mes, d);
          const dName = dateObj
            .toLocaleDateString("es-CO", { weekday: "short" })
            .charAt(0)
            .toUpperCase();
          const isW = dateObj.getDay() === 0 || dateObj.getDay() === 6;
          doc.setFillColor(
            isW ? 20 : accent[0],
            isW ? 30 : accent[1],
            isW ? 80 : accent[2],
          );
          doc.rect(x, y, colW, headerRowH, "F");
          doc.setFontSize(5);
          doc.text(dName, x + colW / 2, y + 4, { align: "center" });
          doc.setFontSize(6);
          doc.text(String(d).padStart(2, "0"), x + colW / 2, y + 8, {
            align: "center",
          });
        });
      };

      drawStickyHeader(gridY);
      gridY += headerRowH;

      // â”€â”€ Render one row per (personal Á— turno) combination â”€â”€
      const allRows: Array<{
        per: (typeof prog.personal)[0];
        turno: TurnoConfig;
      }> = [];
      prog.personal.forEach((per) => {
        turnosConfig.forEach((tc2) => {
          allRows.push({ per, turno: tc2 });
        });
      });

      allRows.forEach(({ per, turno: tRow }, pIdx) => {
        if (gridY + dataRowH > pageH - 40) {
          doc.addPage("a4", "landscape");
          currentPage++;
          addGridHeader(doc, currentPage, 0);
          gridY = 32;
          drawStickyHeader(gridY);
          gridY += headerRowH;
        }

        const titularVig = per.vigilanteId
          ? vigilantes.find((v) => v.id === per.vigilanteId)
          : null;
        const vigNombre = titularVig?.nombre || "VACANTE";
        doc.setFillColor(
          pIdx % 2 === 0 ? 248 : 255,
          pIdx % 2 === 0 ? 250 : 255,
          pIdx % 2 === 0 ? 252 : 255,
        );
        doc.rect(margin, gridY, pageW - margin * 2, dataRowH, "F");
        doc.setDrawColor(220, 220, 225);
        doc.rect(margin, gridY, pageW - margin * 2, dataRowH, "S");
        doc.setTextColor(30, 30, 60);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        const label = `${vigNombre.toUpperCase()} · ${tRow.nombre.toUpperCase()} (${tRow.inicio}-${tRow.fin})`;
        let lines = doc.splitTextToSize(label, colW * 4.3);
        doc.text(
          lines,
          margin + 2,
          gridY + dataRowH / 2 - (lines.length - 1) * 1.5,
          { baseline: "middle" },
        );

        dayNumbers.forEach((d, i) => {
          // Find assignment for this person & this specific turno on day d
          const asig = prog.asignaciones.find(
            (a) => a.dia === d && a.rol === per.rol && a.turno === tRow.id,
          );
          // Fallback: any assignment for this person on this day
          const asigAny =
            asig ??
            prog.asignaciones.find((a) => a.dia === d && a.rol === per.rol);
          const jornada = asigAny?.jornada ?? "sin_asignar";
          const showThisTurno = asigAny?.turno === tRow.id;
          const jCfg = getJornada(jornada, jornadasCustom);
          const cellVig = vigilantes.find((v) => v.id === asigAny?.vigilanteId);
          const nameParts = (cellVig?.nombre || "").split(" ");
          const displayName =
            nameParts[0] + (nameParts[1] ? ` ${nameParts[1][0]}.` : "");
          const isSA =
            !showThisTurno ||
            jornada === "sin_asignar" ||
            !asigAny?.vigilanteId;
          const rgb = hexToRgb(isSA ? "#f1f5f9" : jCfg.color);
          const x = margin + colW * 4.5 + i * colW;

          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.rect(x + 0.3, gridY + 0.6, colW - 0.6, dataRowH - 1.2, "F");
          doc.setDrawColor(230, 230, 235);
          doc.rect(x, gridY, colW, dataRowH, "S");

          if (isSA) {
            doc.setTextColor(200, 210, 220);
            doc.setFontSize(4);
            doc.text("-", x + colW / 2, gridY + 9, { align: "center" });
          } else {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(4);
            doc.text(jCfg.short, x + colW / 2, gridY + 3.8, {
              align: "center",
            });
            doc.setFontSize(3);
            doc.setFont("helvetica", "bold");
            doc.text(`${tRow.inicio}-${tRow.fin}`, x + colW / 2, gridY + 7, {
              align: "center",
            });
            doc.setFontSize(3.2);
            doc.setFont("helvetica", "bold");
            doc.text(displayName.toUpperCase(), x + colW / 2, gridY + 10.5, {
              align: "center",
              maxWidth: colW - 0.5,
            });
            if (cellVig?.cedula) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(2.5);
              doc.text(cellVig.cedula, x + colW / 2, gridY + 13.5, {
                align: "center",
              });
            }
          }
        });
        gridY += dataRowH;
      });

      // â”€â”€ PAGE 3+: INDIVIDUAL GUARD SCHEDULE CARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // One page per vigilante — the card they carry with them
      const personalConVigilante = prog.personal.filter(
        (per) => per.vigilanteId,
      );
      const guardsProcessed = new Set<string>();

      for (const per of personalConVigilante) {
        const vid = per.vigilanteId!;
        if (guardsProcessed.has(vid)) continue;
        guardsProcessed.add(vid);

        const vig = vigilantes.find((v) => v.id === vid);
        if (!vig) continue;

        doc.addPage("a4", "portrait");
        const pW = doc.internal.pageSize.getWidth();
        const pH = doc.internal.pageSize.getHeight();
        const m = 12;

        // ── 100% WHITE BACKGROUND ──
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pW, pH, "F");

        // ── Clean Header (No blue box) ──
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(m, 32, pW - m, 32);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("PROGRAMACION INDIVIDUAL DE TURNO", m, 11);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`PUESTO: ${puestoNombre.toUpperCase()}`, m, 18);
        doc.text(`MES: ${MONTH_NAMES[mes].toUpperCase()} ${anio}`, m, 23);
        doc.text(`EMISION: ${timestampStr.toUpperCase()}`, m, 28);

        // Guard Name Box (Light gray instead of blue)
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(pW / 2 - 40, 35, 80, 8, 1, 1, "F");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(vig.nombre.toUpperCase(), pW / 2, 40.5, { align: "center" });

        // Sub info
        doc.setFontSize(6);
        doc.text(
          `CED: ${vig.cedula || "—"}  |  EMPLEADOR: CORAZA SEGURIDAD CTA`,
          pW / 2,
          46,
          { align: "center" },
        );

        let cardY = 48;
        // â”€â”€ Section: Turnos configured â”€â”€
        doc.setFillColor(240, 242, 252);
        doc.roundedRect(m, cardY, pW - m * 2, 16, 2, 2, "F");
        doc.setTextColor(accentLight[0], accentLight[1], accentLight[2]);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.text("TURNOS ASIGNADOS EN ESTE PUESTO:", m + 4, cardY + 6);
        doc.setTextColor(40, 40, 70);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        const turnosStr = turnosConfig
          .map((t) => `${t.nombre}: ${t.inicio}–${t.fin}`)
          .join("   |   ");
        doc.text(turnosStr, m + 4, cardY + 12);
        cardY += 20;

        // â”€â”€ Day-by-day table â”€â”€
        // Header row
        const thH = 7;
        const tdH = 7;
        const colDate = 22;
        const colDay = 14;
        const colTurno = 34;
        const colHoras = 34;
        const colJornada = pW - m * 2 - colDate - colDay - colTurno - colHoras;

        // header bg
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(m, cardY, pW - m * 2, thH, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        let hx = m + 2;
        const headers = ["FECHA", "DIA", "TURNO", "HORARIO", "JORNADA"];
        const widths = [colDate, colDay, colTurno, colHoras, colJornada];
        headers.forEach((h, hi) => {
          doc.text(h, hx, cardY + 5);
          hx += widths[hi];
        });
        cardY += thH;

        // Day rows — only show days for THIS vigilante
        const diasDelVig = prog.asignaciones.filter(
          (a) =>
            a.vigilanteId === vid ||
            (a.rol === per.rol && per.vigilanteId === vid),
        );

        const weekdays = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

        dayNumbers.forEach((d, dIdx) => {
          if (cardY + tdH > pH - 40) {
            // Add page continuation for long months
            doc.addPage("a4", "portrait");
            cardY = 16;
            doc.setFillColor(accent[0], accent[1], accent[2]);
            doc.rect(m, cardY, pW - m * 2, thH, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(5.5);
            doc.setFont("helvetica", "bold");
            hx = m + 2;
            headers.forEach((h, hi) => {
              doc.text(h, hx, cardY + 5);
              hx += widths[hi];
            });
            cardY += thH;
          }

          const dateObj2 = new Date(anio, mes, d);
          const isWeekend2 = dateObj2.getDay() === 0 || dateObj2.getDay() === 6;

          const asig = prog.asignaciones.find(
            (a) =>
              a.dia === d &&
              (a.vigilanteId === vid || a.vigilanteId === vig?.dbId) &&
              (a.rol === per.rol)
          );
          
          const jornada = asig?.jornada ?? "sin_asignar";
          const jCfg2 = getJornada(jornada, jornadasCustom);
          const tCfg2 = asig?.turno
            ? turnosConfig.find((t) => t.id === asig.turno)
            : null;
          const isWork = jornada === "normal";

          // Row background
          let rowBg: [number, number, number] = isWork
            ? hexToRgb(jCfg2.color)
            : isWeekend2
              ? [248, 248, 255]
              : dIdx % 2 === 0
                ? [252, 253, 255]
                : [255, 255, 255];
          if (isWork) rowBg = [rowBg[0], rowBg[1], rowBg[2]]; // Keep work color subtle
          doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
          doc.rect(m, cardY, pW - m * 2, tdH, "F");
          doc.setDrawColor(230, 232, 240);
          doc.line(m, cardY + tdH, m + pW - m * 2, cardY + tdH);

          // Date
          const dateStr = `${String(d).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${anio}`;
          doc.setTextColor(
            isWork ? accentLight[0] : 100,
            isWork ? accentLight[1] : 100,
            isWork ? accentLight[2] : 120,
          );
          doc.setFontSize(5.5);
          doc.setFont("helvetica", isWork ? "bold" : "normal");
          doc.text(dateStr, m + 2, cardY + 5);

          // Day of week
          doc.setTextColor(
            isWeekend2 ? 160 : 80,
            isWeekend2 ? 80 : 80,
            isWeekend2 ? 160 : 100,
          );
          doc.text(weekdays[dateObj2.getDay()], m + colDate + 2, cardY + 5);

          // Turno & Hours
          if (isWork && tCfg2) {
            doc.setTextColor(accentLight[0], accentLight[1], accentLight[2]);
            doc.setFont("helvetica", "bold");
            doc.text(
              tCfg2.nombre.toUpperCase(),
              m + colDate + colDay + 2,
              cardY + 5,
            );
            doc.text(
              `${tCfg2.inicio} – ${tCfg2.fin}`,
              m + colDate + colDay + colTurno + 2,
              cardY + 5,
            );
          } else {
            doc.setTextColor(160, 160, 180);
            doc.setFont("helvetica", "normal");
            doc.text("—", m + colDate + colDay + 2, cardY + 5);
            doc.text("—", m + colDate + colDay + colTurno + 2, cardY + 5);
          }

          // Jornada
          const jRgb = hexToRgb(jCfg2.color);
          doc.setTextColor(jRgb[0], jRgb[1], jRgb[2]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.5);
          doc.text(
            jCfg2.nombre.toUpperCase(),
            m + colDate + colDay + colTurno + colHoras + 2,
            cardY + 5,
          );

          cardY += tdH;
        });

        // â”€â”€ Summary box â”€â”€
        cardY += 4;
        const diasTrabajados = diasDelVig.filter(
          (a) => a.jornada === "normal",
        ).length;
        const descRem = diasDelVig.filter(
          (a) => a.jornada === "descanso_remunerado",
        ).length;
        const descNRem = diasDelVig.filter(
          (a) => a.jornada === "descanso_no_remunerado",
        ).length;

        if (cardY + 18 < pH - 50) {
          doc.setFillColor(240, 245, 255);
          doc.roundedRect(m, cardY, pW - m * 2, 16, 2, 2, "F");
          doc.setTextColor(accent[0], accent[1], accent[2]);
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.text("RESUMEN DEL MES:", m + 4, cardY + 6);
          doc.setTextColor(40, 40, 70);
          doc.setFont("helvetica", "normal");
          doc.text(
            `Días trabajados: ${diasTrabajados}   |   Descansos Rem.: ${descRem}   |   Descansos No Rem.: ${descNRem}   |   Total horas estimadas: ${diasTrabajados * 12}h`,
            m + 4,
            cardY + 12,
          );
          cardY += 20;
        }

        // â”€â”€ Signature area at bottom â”€â”€
        const sigY2 = pH - 38;
        doc.setDrawColor(180, 180, 200);
        doc.line(m, sigY2, m + 70, sigY2);
        doc.line(pW - m - 70, sigY2, pW - m, sigY2);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(accent[0], accent[1], accent[2]);
        doc.text("FIRMA RESPONSABLE CTA", m + 35, sigY2 + 4, {
          align: "center",
        });
        doc.text("RECIBIDO Y CONFORME — VIGILANTE", pW - m - 35, sigY2 + 4, {
          align: "center",
        });
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 100);
        doc.text(
          `Nombre: ${username?.toUpperCase() || "____________________"}`,
          m,
          sigY2 + 9,
        );
        doc.text(`Fecha: ${shortTimestamp}`, m, sigY2 + 14);
        doc.text(`Cargo: JEFE DE OPERACIONES`, m, sigY2 + 19);
        doc.text(`Nombre: ${vig.nombre.toUpperCase()}`, pW - m - 70, sigY2 + 9);
        doc.text(
          `Cédula: ${vig.cedula || "___________"}`,
          pW - m - 70,
          sigY2 + 14,
        );
        doc.text(`Firma: _______________________`, pW - m - 70, sigY2 + 19);

        // â”€â”€ Footer note â”€â”€
        doc.setFontSize(5);
        doc.setTextColor(160, 160, 180);
        doc.text(
          "CORAZA SEGURIDAD CTA · Documento generado automáticamente. Válido solo con firma del responsable CTA.",
          pW / 2,
          pH - 8,
          { align: "center" },
        );
      }

      // â”€â”€ SIGNATURES on last summary page â”€â”€
      doc.addPage("a4", "landscape");
      currentPage++;
      addGridHeader(doc, currentPage, 0);
      let sigY = pageH - 32;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, sigY, margin + 80, sigY);
      doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
      doc.line(pageW - margin - 80, sigY, pageW - margin, sigY);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text("FIRMA RESPONSABLE CTA", margin + 40, sigY + 4, {
        align: "center",
      });
      doc.text("VÂ°BÂ° CONTROL Y SUPERVISIÁ“N", pageW / 2, sigY + 4, {
        align: "center",
      });
      doc.text("RECIBIDO VIGILANTE / CLIENTE", pageW - margin - 40, sigY + 4, {
        align: "center",
      });
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 100);
      doc.text(
        `NOMBRE: ${username?.toUpperCase() || "____________________"}`,
        margin + 2,
        sigY + 9,
      );
      doc.text(`FECHA: ${shortTimestamp}`, margin + 2, sigY + 13);
      doc.text("CARGO: JEFE DE OPERACIONES", margin + 2, sigY + 17);
      doc.text("NOMBRE: ____________________", pageW / 2 - 38, sigY + 9);
      doc.text("FECHA/HORA: ____/____/____", pageW / 2 - 38, sigY + 13);
      doc.text("NOMBRE: ____________________", pageW - margin - 78, sigY + 9);
      doc.text(
        "FIRMA Y SELLO: _______________",
        pageW - margin - 78,
        sigY + 13,
      );

      const filename = `CORAZA_PROGRAMA_${puestoNombre.replace(/\s+/g, "_").toUpperCase()}_${MONTH_NAMES[mes].toUpperCase()}.pdf`;
      doc.save(filename);
      showTacticalToast({
        title: "Reporte Generado",
        message:
          "PDF con horarios individuales y cuadro de turnos completo generado.",
        type: "success",
      });
    };

    generatePDF();
  };

  const statsBar = prog.personal
    .map((per) => {
      if (!per.vigilanteId) return null;
      const nombre =
        vigilantes.find((v) => v.id === per.vigilanteId)?.nombre ||
        per.vigilanteId;
      const dias = getDiasTrabajoVigilante(prog.id, per.vigilanteId);
      const desc = getDiasDescansoVigilante(prog.id, per.vigilanteId);
      return { nombre, dias, ...desc, rol: per.rol };
    })
    .filter(Boolean);

  return (
    <div className="absolute inset-0 z-[50] bg-slate-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            onClick={onClose}
            className="shrink-0 size-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all border border-slate-200"
          >
            <span className="material-symbols-outlined font-black">
              arrow_back
            </span>
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight truncate leading-none">
              {puestoNombre}
            </h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {MONTH_NAMES[mes]} {anio} · Programación Mensual
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 no-scrollbar">
          {/* Auto-save indicator */}
          <div
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all duration-500 ${
              lastSyncError
                ? "bg-red-50 text-red-700 border-red-200"
                : isSyncing
                  ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[14px] ${
                lastSyncError
                  ? "text-red-500"
                  : isSyncing
                    ? "text-blue-500 animate-spin"
                    : "text-emerald-500"
              }`}
            >
              {lastSyncError
                ? "sync_problem"
                : isSyncing
                  ? "sync"
                  : "cloud_done"}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest">
              {lastSyncError
                ? "Error de red"
                : isSyncing
                  ? "Guardando..."
                  : "Sincronizado"}
            </span>
          </div>
          {/* Coverage badge */}
          <div
            className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl font-black text-[10px] sm:text-[11px] uppercase ${cobertura >= 80 ? "bg-success/10 text-success border border-success/20" : cobertura >= 50 ? "bg-warning/10 text-warning border border-warning/20" : "bg-danger/10 text-danger border border-danger/20"}`}
          >
            {cobertura}% Cobertura
          </div>
          <div
            className={`shrink-0 px-2 sm:px-3 py-2 rounded-xl font-black text-[9px] sm:text-[10px] uppercase ${prog.estado === "publicado" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
          >
            {prog.estado === "publicado" ? "✓ Publicado" : "✎ Borrador"}
          </div>
          <button
            onClick={handleExportPDF}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200/50"
          >
            <span className="material-symbols-outlined text-[16px]">
              picture_as_pdf
            </span>{" "}
            PDF
          </button>
          {/* Save as template button */}
          <button
            onClick={() => {
              setTplNombre("");
              setShowSaveTplModal(true);
            }}
            title="Guardar como plantilla reutilizable"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-violet-50 text-violet-700 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-violet-100 transition-all border border-violet-200"
          >
            <span className="material-symbols-outlined text-[16px]">
              bookmark_add
            </span>{" "}
            Plantilla
          </button>
          <button
            onClick={handlePublicar}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:brightness-110 shadow-lg shadow-primary/30 transition-all border border-primary-light/20"
          >
            <span className="material-symbols-outlined text-[16px]">
              publish
            </span>{" "}
            Publicar
          </button>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveTplModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowSaveTplModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-5 bg-gradient-to-br from-violet-50 to-indigo-50 border-b border-violet-100">
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-outlined text-violet-600 text-[28px]">
                  bookmark_add
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">
                    Guardar Plantilla
                  </h3>
                  <p className="text-[11px] text-violet-600 font-bold">
                    Reutilizable en cualquier mes futuro
                  </p>
                </div>
              </div>
            </div>

            {/* What will be saved preview */}
            <div className="px-8 py-4 bg-violet-50/50 border-b border-violet-100">
              <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-3">
                Lo que se guardará en la plantilla:
              </p>
              <div className="space-y-2">
                {prog.personal
                  .filter((p) => p.vigilanteId)
                  .map((per) => {
                    const vig = vigilantes.find(
                      (v) => v.id === per.vigilanteId,
                    );
                    const dias = prog.asignaciones.filter(
                      (a) => a.rol === per.rol && a.jornada !== "sin_asignar",
                    ).length;
                    const descansos = prog.asignaciones.filter(
                      (a) =>
                        a.rol === per.rol &&
                        (a.jornada === "descanso_remunerado" ||
                          a.jornada === "descanso_no_remunerado"),
                    ).length;
                    return (
                      <div
                        key={per.rol}
                        className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-violet-100"
                      >
                        <div className="size-8 rounded-lg bg-violet-100 flex items-center justify-center">
                          <span className="material-symbols-outlined text-violet-600 text-[16px]">
                            person
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-slate-800 truncate">
                            {vig?.nombre || "Sin asignar"}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400">
                            {ROL_LABELS[per.rol]} · {dias} días turnos ·{" "}
                            {descansos} descansos
                          </p>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          ✓ Incluido
                        </span>
                      </div>
                    );
                  })}
                {prog.personal.filter((p) => p.vigilanteId).length === 0 && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="text-[11px] font-bold text-orange-700">
                      ⚠ No hay vigilantes asignados. La plantilla guardará solo
                      el patrón de turnos y jornadas.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-slate-400">
                  info
                </span>
                <p className="text-[9px] font-bold text-slate-400">
                  También se guardan los asignaciones día a día, incluyendo
                  reemplazos y variaciones.
                </p>
              </div>
            </div>

            <div className="px-8 py-5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Nombre de la plantilla
              </label>
              <input
                autoFocus
                value={tplNombre}
                onChange={(e) => setTplNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuardarPlantilla()}
                placeholder="Ej: Turnos Estándar Marzo 2026"
                className="w-full h-11 border-2 border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-violet-400 transition-all"
              />
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleGuardarPlantilla}
                  disabled={!tplNombre.trim()}
                  className="flex-1 py-3 bg-violet-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-violet-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-200"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      bookmark_add
                    </span>
                    Guardar Plantilla Completa
                  </span>
                </button>
                <button
                  onClick={() => setShowSaveTplModal(false)}
                  className="px-5 py-3 bg-slate-100 text-slate-500 font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts strip */}
      {alertas.length > 0 && (
        <div className="bg-warning/10 border-b border-warning/20 px-6 py-2 flex items-center gap-3 flex-wrap">
          <span className="material-symbols-outlined text-warning text-[18px]">
            warning
          </span>
          {alertas.map((a, i) => (
            <span key={i} className="text-[11px] font-bold text-warning">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 px-6 flex gap-1 overflow-x-auto">
        {(
          [
            ["calendario", "calendar_month", "Calendario"],
            ["personal", "people", "Personal"],
            ["plantillas", "bookmarks", "Plantillas"],
            ["historial", "history", "Historial"],
            ["alertas", "notifications", "Alertas IA"],
            ["config", "tune", "Configurar"],
          ] as const
        ).map(([tab, icon, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {icon}
            </span>
            {label}
            {tab === "plantillas" && templates.length > 0 && (
              <span className="ml-1 bg-violet-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">
                {templates.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* — CALENDARIO —————————————————————————————————————————————————— */}
        {activeTab === "calendario" && (
          <div className="space-y-5">
            {/* — Stats bar: vigilante cards —————————————————— */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {prog.personal.map((per) => {
                const vig = per.vigilanteId
                  ? vigilantes.find((v) => v.id === per.vigilanteId)
                  : null;
                const dias = per.vigilanteId
                  ? getDiasTrabajoVigilante(prog.id, per.vigilanteId)
                  : 0;
                const desc = per.vigilanteId
                  ? getDiasDescansoVigilante(prog.id, per.vigilanteId)
                  : { remunerados: 0, noRemunerados: 0 };
                const rolColors: Record<RolPuesto, string> = {
                  titular_a: "#4318FF",
                  titular_b: "#0ea5e9",
                  relevante: "#10b981",
                };
                return (
                  <div
                    key={per.rol}
                    className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4"
                  >
                    <div
                      className="size-10 rounded-xl flex items-center justify-center shrink-0 font-black text-white text-sm"
                      style={{ background: rolColors[per.rol] }}
                    >
                      {vig ? vig.nombre.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[9px] font-black uppercase tracking-widest mb-0.5"
                        style={{ color: rolColors[per.rol] }}
                      >
                        {ROL_LABELS[per.rol]}
                      </p>
                      <p className="text-sm font-black text-slate-900 truncate">
                        {vig?.nombre || "— Sin asignar —"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                          {dias}d trabajados
                        </span>
                        <span className="text-[9px] font-bold bg-success/10 text-success px-1.5 py-0.5 rounded-full">
                          {desc.remunerados} DR
                        </span>
                        <span className="text-[9px] font-bold bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">
                          {desc.noRemunerados} DNR
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* -- Legend: Turnos + Jornadas --------------------------------- */}
            <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Turnos:
              </span>
              {/* AM/PM Visual */}
              <div className="flex items-center gap-1.5">
                <div className="size-5 rounded-md flex items-center justify-center shrink-0" style={{ background: TURNO_VISUAL.AM.bgGrad }}>
                  <span className="material-symbols-outlined text-white" style={{ fontSize: '11px' }}>light_mode</span>
                </div>
                <span className="text-[10px] font-black text-blue-700">AM / DIA</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-5 rounded-md flex items-center justify-center shrink-0" style={{ background: TURNO_VISUAL.PM.bgGrad }}>
                  <span className="material-symbols-outlined text-indigo-200" style={{ fontSize: '11px' }}>dark_mode</span>
                </div>
                <span className="text-[10px] font-black text-indigo-900">PM / NOCHE</span>
              </div>

              <div className="w-px h-5 bg-slate-200 mx-1" />
              
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Jornadas:
              </span>
              {(jornadasCustom.length ? jornadasCustom : DEFAULT_JORNADAS).map(
                (j) => (
                  <div key={j.id} className="flex items-center gap-1.5">
                    <div
                      className="size-3 rounded-sm shrink-0"
                      style={{ background: j.color }}
                    />
                    <span className="text-[10px] font-bold text-slate-600">
                      {j.nombre}
                    </span>
                  </div>
                ),
              )}
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="size-3 rounded-sm border-2 border-dashed border-red-400 bg-red-50 shrink-0" />
                  <span className="text-[10px] font-bold text-red-500">
                    Sin asignar
                  </span>
                </div>
              </div>
            </div>

            {/* — CALENDAR GRID — turno-centric ————————————————— */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
              {/* Grid top bar: turno pills + month info */}
              <div className="bg-slate-900 px-5 py-3 flex items-center gap-3 flex-wrap border-b border-slate-800">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                  Turnos:
                </span>
                {turnosConfig.map((tc2, tIdx) => {
                  const turnoColors = [
                    "#4318FF",
                    "#0ea5e9",
                    "#10b981",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ef4444",
                  ];
                  const col = turnoColors[tIdx % turnoColors.length];
                  return (
                    <span
                      key={tc2.id}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border"
                      style={{
                        background: col + "22",
                        color: col,
                        borderColor: col + "55",
                      }}
                    >
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ background: col }}
                      />
                      {tc2.nombre} · {tc2.inicio}–{tc2.fin}
                    </span>
                  );
                })}
                <span className="ml-auto text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  {MONTH_NAMES[mes]} {anio} · {daysInMonth} días
                </span>
              </div>

              <div className="overflow-x-auto">
                <table
                  className="w-full border-collapse"
                  style={{ minWidth: `${dayNumbers.length * 72 + 200}px` }}
                >
                  {/* Day header */}
                  <thead>
                    <tr>
                      <th
                        className="sticky left-0 z-30 bg-slate-800 px-4 py-3 text-left text-[10px] font-black text-slate-300 uppercase tracking-widest border-r border-slate-700"
                        style={{ minWidth: "190px" }}
                      >
                        Turno / Horario
                      </th>
                      {dayNumbers.map((d) => {
                        const dateObj = new Date(anio, mes, d);
                        const dow = dateObj.getDay();
                        const isW = dow === 0 || dow === 6;
                        const isSun = dow === 0;
                        const dayNames = ["D", "L", "M", "X", "J", "V", "S"];
                        return (
                          <th
                            key={d}
                            className={`py-2 text-center border-r border-slate-700 ${isSun ? "bg-red-900/30" : isW ? "bg-indigo-900/20" : "bg-slate-800"}`}
                            style={{ minWidth: "72px" }}
                          >
                            <div className="flex flex-col items-center">
                              <span
                                className={`text-[8px] font-bold ${isSun ? "text-red-400" : isW ? "text-indigo-400" : "text-slate-500"}`}
                              >
                                {dayNames[dow]}
                              </span>
                              <span
                                className={`text-[11px] font-black ${isSun ? "text-red-300" : isW ? "text-indigo-300" : "text-slate-200"}`}
                              >
                                {d}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* One row per configured TURNO — mapped by index to role */}
                    {turnosConfig.map((tConf, tIdx) => {
                      const turnoColors = [
                        "#4318FF",
                        "#0ea5e9",
                        "#10b981",
                        "#f59e0b",
                        "#8b5cf6",
                        "#ef4444",
                      ];
                      const col = turnoColors[tIdx % turnoColors.length];
                      // The role assigned to this turno slot (store key)
                      const rol = getRolForTurno(tConf, tIdx);
                      const titular = prog.personal.find((p) => p.rol === rol);
                      const titularNombre = titular?.vigilanteId
                        ? vigilantes.find((v) => v.id === titular.vigilanteId)
                            ?.nombre
                        : null;

                      return (
                        <tr
                          key={tConf.id}
                          className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors"
                        >
                          {/* Row label */}
                          <td
                            className="sticky left-0 z-20 bg-white px-4 py-2.5 border-r border-slate-100 shadow-[4px_0_12px_rgba(0,0,0,0.06)]"
                            style={{ borderLeft: `4px solid ${col}` }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span
                                className="text-[12px] font-black uppercase leading-none"
                                style={{ color: col }}
                              >
                                {tConf.nombre}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 leading-none">
                                {tConf.inicio} – {tConf.fin}
                              </span>
                              {titularNombre && (
                                <span className="text-[8px] font-bold text-slate-400 truncate mt-0.5 max-w-[150px]">
                                  👤 {titularNombre}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Day cells — always find by (dia, rol) */}
                          {dayNumbers.map((d) => {
                            const dateObj = new Date(anio, mes, d);
                            const dow = dateObj.getDay();
                            const isW = dow === 0 || dow === 6;
                            // ✅ KEY FIX: always search by (dia, rol) — same key the store uses
                            const rol = getRolForTurno(tConf, tIdx);
                            const asig = prog.asignaciones.find(
                              (a) => a.dia === d && a.rol === rol,
                            );
                            const cellVigName = asig
                              ? getVigilanteName(asig.vigilanteId)
                              : undefined;
                            return (
                              <td
                                key={d}
                                className={`p-1 border-r border-slate-50 ${isW ? "bg-slate-50/80" : ""}`}
                                style={{ minWidth: "72px" }}
                              >
                                {asig ? (
                                  <CeldaCalendario
                                    asig={asig}
                                    vigilanteNombre={cellVigName}
                                    onEdit={() => setEditCell(asig)}
                                    jornadasCustom={jornadasCustom}
                                    turnosConfig={turnosConfig}
                                  />
                                ) : (
                                  <CeldaVacia
                                    isWeekend={isW}
                                    onAdd={() => {
                                      // Find or create virtual target for new roles
                                      const rol = getRolForTurno(tConf, tIdx);
                                      const target = prog.asignaciones.find(
                                        (a) => a.dia === d && a.rol === rol,
                                      );
                                      if (target) {
                                        setEditCell(target);
                                      } else {
                                        // VIRTUAL TARGET for new roles!
                                        setEditCell({
                                          dia: d,
                                          rol: rol,
                                          vigilanteId: null,
                                          turno: tConf.id as TurnoHora,
                                          jornada: "sin_asignar" as TipoJornada,
                                        });
                                      }
                                    }}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grid footer */}
              <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-4 bg-slate-50/50">
                <span className="text-[10px] font-bold text-slate-400">
                  {
                    prog.asignaciones.filter(
                      (a) => a.vigilanteId && a.jornada === "normal",
                    ).length
                  }{" "}
                  turnos asignados
                </span>
                <span className="text-[10px] font-bold text-red-400">
                  {
                    prog.asignaciones.filter(
                      (a) => !a.vigilanteId || a.jornada === "sin_asignar",
                    ).length
                  }{" "}
                  sin asignar
                </span>
                <span className="ml-auto text-[10px] font-bold text-slate-400">
                  Click en cualquier celda para editar · Rojo = sin asignar
                </span>
              </div>
            </div>
          </div>
        )}

        {/* — PLANTILLAS —————————————————————————————————————————————————— */}
        {activeTab === "plantillas" && (
          <div className="max-w-2xl space-y-4">
            <div className="flex items-start gap-4 p-4 bg-violet-50 border border-violet-200 rounded-2xl">
              <span className="material-symbols-outlined text-violet-600 text-[22px] mt-0.5">
                info
              </span>
              <div>
                <p className="text-[12px] font-black text-violet-900">
                  Sistema de Plantillas Reutilizables
                </p>
                <p className="text-[11px] text-violet-700 font-bold mt-1">
                  Guarda la programación actual como plantilla y aplícala en
                  cualquier mes futuro. Los horarios y jornadas se copian
                  exactamente; puedes modificar lo que necesites después.
                </p>
              </div>
            </div>

            {/* Save current as template shortcut */}
            <button
              onClick={() => {
                setTplNombre("");
                setShowSaveTplModal(true);
              }}
              className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-violet-300 rounded-2xl text-violet-700 hover:bg-violet-50 transition-all group"
            >
              <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">
                bookmark_add
              </span>
              <div className="text-left">
                <p className="text-[12px] font-black uppercase tracking-widest">
                  Guardar Programación Actual como Plantilla
                </p>
                <p className="text-[10px] font-bold opacity-70">
                  Captura el estado actual del tablero de {MONTH_NAMES[mes]}{" "}
                  {anio}
                </p>
              </div>
            </button>

            {templates.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <span className="material-symbols-outlined text-[64px] text-slate-200 mb-4">
                  bookmarks
                </span>
                <p className="text-[13px] font-black text-slate-400 uppercase tracking-widest">
                  Sin plantillas guardadas
                </p>
                <p className="text-[11px] text-slate-400 mt-2 font-bold">
                  Guarda la programación de este mes para reutilizarla luego
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Plantillas de {puestoNombre} — {templates.length} guardada
                  {templates.length !== 1 && "s"}
                </p>
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 group hover:border-violet-200 transition-all"
                  >
                    <div className="size-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-violet-600 text-[22px]">
                        bookmark
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-slate-900 truncate">
                        {tpl.nombre}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        Creada por {tpl.creadoPor} ·{" "}
                        {new Date(tpl.creadoEn).toLocaleDateString("es-CO")}·{" "}
                        {tpl.patron.length} asignaciones
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAplicarPlantilla(tpl)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          upload
                        </span>
                        Aplicar
                      </button>
                      <button
                        onClick={() => {
                          eliminarPlantilla(tpl.id);
                          showTacticalToast({
                            title: "Plantilla Eliminada",
                            message: `"${tpl.nombre}" ha sido borrada.`,
                            type: "info",
                          });
                        }}
                        className="size-9 flex items-center justify-center rounded-xl text-slate-300 hover:text-danger hover:bg-danger/5 transition-all"
                        title="Eliminar plantilla"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete_outline
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* — PERSONAL ————————————————————————————————————————————————————— */}
        {activeTab === "personal" && (
          <div className="max-w-xl space-y-4">
            <p className="text-[11px] text-slate-500 font-bold">
              Asigna los 3 vigilantes responsables de este puesto este mes.
            </p>
            {prog.personal.map((per) => (
              <div
                key={per.rol}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4"
              >
                <div
                  className={`size-10 rounded-xl flex items-center justify-center font-black text-[11px] text-white ${per.rol === "titular_a" ? "bg-primary" : per.rol === "titular_b" ? "bg-blue-500" : "bg-green-500"}`}
                >
                  {ROL_LABELS[per.rol][0]}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {ROL_LABELS[per.rol]}
                  </p>
                  <select
                    value={per.vigilanteId || ""}
                    onChange={(e) => {
                      const newVigilanteId = e.target.value || null;

                      const processChange = () => {
                        const updated = prog.personal.map((p) =>
                          p.rol === per.rol
                            ? { ...p, vigilanteId: newVigilanteId }
                            : p,
                        );
                        asignarPersonal(
                          prog.id,
                          updated,
                          username || "Sistema",
                        );

                        if (newVigilanteId) {
                          const v = vigilantes.find(
                            (gv) =>
                              gv.id === newVigilanteId ||
                              gv.dbId === newVigilanteId,
                          );
                          if (v && v.estado === "disponible") {
                            updateGuardStatus(
                              newVigilanteId,
                              "activo",
                              puestoId,
                              `Asignado como TITULAR en ${puestoNombre}: ${justificacionText}`,
                            );
                          }
                        }
                        logAction(
                          "PROGRAMACION",
                          "Personal actualizado",
                          `Rol ${ROL_LABELS[per.rol]}: ${newVigilanteId}`,
                          "info",
                        );
                        showTacticalToast({
                          title: "Personal Asignado",
                          message: `Se ha vinculado al titular para el rol de ${ROL_LABELS[per.rol]}.`,
                          type: "success",
                        });
                      };

                      if (newVigilanteId) {
                        const v = vigilantes.find(
                          (gv) =>
                            gv.id === newVigilanteId ||
                            gv.dbId === newVigilanteId,
                        );
                        if (v && v.estado === "disponible") {
                          // Instead of prompt, show modal
                          setShowJustificacion({
                            vigilante: v,
                            per,
                            newVigilanteId,
                          });
                          setJustificacionText("");
                        } else {
                          processChange();
                        }
                      } else {
                        // Removal
                        const updated = prog.personal.map((p) =>
                          p.rol === per.rol ? { ...p, vigilanteId: null } : p,
                        );
                        asignarPersonal(
                          prog.id,
                          updated,
                          username || "Sistema",
                        );
                        showTacticalToast({
                          title: "Puesto Despejado",
                          message: `Rol ${ROL_LABELS[per.rol]} ahora se encuentra vacante.`,
                          type: "info",
                        });
                      }
                    }}
                    className="mt-1 w-full h-10 bg-white border-2 border-slate-100 rounded-xl px-3 text-sm font-bold outline-none focus:border-primary/50 focus:bg-white transition-all shadow-sm"
                  >
                    <option value="">— Seleccionar del personal —</option>
                    <optgroup label="DIPONIBLES">
                      {vigilantes
                        .filter((v) => v.estado === "disponible")
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            ✅ {v.nombre}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="ACTIVOS">
                      {vigilantes
                        .filter((v) => v.estado === "activo")
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            👤 {v.nombre}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="OTROS">
                      {vigilantes
                        .filter(
                          (v) =>
                            v.estado !== "disponible" && v.estado !== "activo",
                        )
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            ⚠ {v.nombre} ({v.estado})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* — HISTORIAL ———————————————————————————————————————————————————— */}
        {activeTab === "historial" && (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {prog.historialCambios
              .slice()
              .reverse()
              .map((h) => (
                <div
                  key={h.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${h.tipo === "rechazo_ia" ? "bg-danger/5 border-danger/20" : h.tipo === "publicacion" ? "bg-success/5 border-success/20" : "bg-white border-slate-100"}`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] mt-0.5 ${h.tipo === "rechazo_ia" ? "text-danger" : h.tipo === "publicacion" ? "text-success" : "text-primary"}`}
                  >
                    {h.tipo === "rechazo_ia"
                      ? "block"
                      : h.tipo === "publicacion"
                        ? "verified"
                        : h.tipo === "borrador"
                          ? "save"
                          : "edit"}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      {h.descripcion}
                    </p>
                    {h.reglaViolada && (
                      <p className="text-[11px] text-danger font-bold mt-0.5">
                        Regla: {h.reglaViolada}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(h.timestamp).toLocaleString("es-CO", {
                        hour12: false,
                      })}{" "}
                      · {h.usuario}
                    </p>
                  </div>
                </div>
              ))}
            {prog.historialCambios.length === 0 && (
              <p className="text-center text-slate-400 font-bold py-10">
                Sin cambios registrados aún
              </p>
            )}
          </div>
        )}

        {/* â”€â”€ ALERTAS IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "alertas" && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
              <h3 className="font-black text-primary flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined">smart_toy</span>
                Validaciones IA Activas
              </h3>
              <ul className="space-y-2 text-[12px] text-slate-700 font-medium">
                {[
                  "X Un vigilante no puede estar en dos puestos al mismo tiempo en el mismo turno",
                  "! Máximo 3 días de descanso por quincena por vigilante",
                  "! Los 3 descansos deben ser: 2 remunerados + 1 no remunerado exactamente",
                  "! No se aprueban vacaciones en diciembre, enero ni Semana Santa",
                  "! Si el vigilante tiene descanso, no puede ser asignado a otro puesto ese día",
                  "! El relevante con días vacíos recibirá sugerencia de asignación alterna",
                  "! Días sin cobertura generan alerta de puesto desprotegido",
                ].map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-primary">●</span> {r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h3 className="font-black text-slate-900 mb-3 text-[13px]">
                Rechazos de IA registrados
              </h3>
              {prog.historialCambios.filter((h) => h.tipo === "rechazo_ia")
                .length === 0 ? (
                <p className="text-[12px] text-success font-bold">
                  ✅ Sin rechazos en este período. Todo en orden.
                </p>
              ) : (
                prog.historialCambios
                  .filter((h) => h.tipo === "rechazo_ia")
                  .map((h) => (
                    <div
                      key={h.id}
                      className="flex gap-2 p-3 bg-danger/5 border border-danger/20 rounded-xl mb-2"
                    >
                      <span className="material-symbols-outlined text-danger text-[18px]">
                        block
                      </span>
                      <div>
                        <p className="text-[12px] font-bold text-danger">
                          {h.reglaViolada}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(h.timestamp).toLocaleString("es-CO", {
                            hour12: false,
                          })}
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ CONFIG TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "config" && (
          <div className="space-y-8 max-w-2xl">
            {/* Turnos Config */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  schedule
                </span>
                Configurar Turnos del Puesto
              </h3>
              <div className="space-y-3">
                {turnosConfig.map((tc, idx) => (
                  <div
                    key={tc.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <input
                      className="flex-1 h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm font-bold outline-none"
                      value={tc.nombre}
                      onChange={(e) => {
                        const t = [...turnosConfig];
                        t[idx] = { ...t[idx], nombre: e.target.value };
                        updatePuesto(puestoId, { turnosConfig: t });
                      }}
                    />
                    <MilitaryTimeInput
                      value={tc.inicio}
                      onChange={(val) => {
                        const t = [...turnosConfig];
                        t[idx] = { ...t[idx], inicio: val };
                        updatePuesto(puestoId, { turnosConfig: t });
                      }}
                    />
                    <span className="text-slate-400">→</span>
                    <MilitaryTimeInput
                      value={tc.fin}
                      onChange={(val) => {
                        const t = [...turnosConfig];
                        t[idx] = { ...t[idx], fin: val };
                        updatePuesto(puestoId, { turnosConfig: t });
                      }}
                    />
                    <button
                      onClick={() => {
                        const t = turnosConfig.filter((_, i) => i !== idx);
                        updatePuesto(puestoId, { turnosConfig: t });
                      }}
                      className="size-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const t = [
                      ...turnosConfig,
                      {
                        id: `T${Date.now()}`,
                        nombre: `Turno ${turnosConfig.length + 1}`,
                        inicio: "06:00",
                        fin: "18:00",
                      },
                    ];
                    updatePuesto(puestoId, { turnosConfig: t });
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl font-black text-[11px] uppercase hover:bg-primary/20 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    add
                  </span>
                  Agregar Turno
                </button>
              </div>
            </div>
            {/* Leyenda Config */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  palette
                </span>
                Personalizar Leyenda de Jornadas
              </h3>
              <div className="space-y-3">
                {(jornadasCustom.length
                  ? jornadasCustom
                  : DEFAULT_JORNADAS
                ).map((j, idx) => (
                  <div
                    key={j.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100"
                    style={{ background: j.color + "22" }}
                  >
                    <input
                      type="color"
                      className="size-9 rounded-lg border-0 cursor-pointer"
                      value={j.color}
                      onChange={(e) => {
                        const list = jornadasCustom.length
                          ? [...jornadasCustom]
                          : [...DEFAULT_JORNADAS];
                        list[idx] = { ...list[idx], color: e.target.value };
                        updatePuesto(puestoId, { jornadasCustom: list });
                      }}
                    />
                    <input
                      className="flex-1 h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm font-bold outline-none"
                      value={j.nombre}
                      onChange={(e) => {
                        const list = jornadasCustom.length
                          ? [...jornadasCustom]
                          : [...DEFAULT_JORNADAS];
                        list[idx] = { ...list[idx], nombre: e.target.value };
                        updatePuesto(puestoId, { jornadasCustom: list });
                      }}
                    />
                    <input
                      className="w-16 h-9 bg-white border border-slate-200 rounded-lg px-2 text-sm font-black outline-none text-center"
                      value={j.short}
                      onChange={(e) => {
                        const list = jornadasCustom.length
                          ? [...jornadasCustom]
                          : [...DEFAULT_JORNADAS];
                        list[idx] = { ...list[idx], short: e.target.value };
                        updatePuesto(puestoId, { jornadasCustom: list });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Programación Recurrente */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <h3 className="font-black text-slate-900 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  repeat
                </span>
                Programación Recurrente
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">
                Guarda el mes actual como plantilla para replicar
                automáticamente en meses futuros.
              </p>
              <button
                onClick={() => {
                  if (!prog) return;
                  updatePuesto(puestoId, {
                    plantillaRecurrente: {
                      activa: true,
                      asignaciones: prog.asignaciones,
                      personal: prog.personal,
                      desdeAnio: anio,
                      desMes: mes,
                    },
                  });
                  showTacticalToast({
                    title: "Plantilla Guardada",
                    message:
                      "Configuración guardada para recursividad mensual.",
                    type: "success",
                  });
                  logAction(
                    "PROGRAMACION",
                    "Plantilla recurrente guardada",
                    `Puesto: ${puestoNombre} desde ${MONTH_NAMES[mes]} ${anio}`,
                    "info",
                  );
                }}
                className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-black text-[11px] uppercase hover:brightness-110 transition-all shadow-md shadow-primary/30"
              >
                <span className="material-symbols-outlined text-[16px]">
                  save
                </span>
                Guardar como Plantilla Base
              </button>
              {puesto?.plantillaRecurrente?.activa && (
                <p className="mt-3 text-[11px] text-success font-bold">
                  âœ“ Plantilla activa desde{" "}
                  {MONTH_NAMES[puesto?.plantillaRecurrente?.desMes || 0]}{" "}
                  {puesto?.plantillaRecurrente?.desdeAnio}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tactical Justification Modal */}
      {showJustificacion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 sm:p-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white max-w-sm w-full rounded-[32px] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.5)] border border-slate-100 animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-primary p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 -mr-16 -mt-16 bg-white/10 rounded-full blur-3xl opacity-20" />
              <div className="relative flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
                  <span className="material-symbols-outlined text-2xl">
                    swap_horiz
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">
                    Justificación
                  </h3>
                  <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
                    Protocolo de Seguridad
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-center">
                  Justifique el traslado de{" "}
                  <span className="text-primary font-black">
                    {showJustificacion.vigilante.nombre}
                  </span>{" "}
                  a un puesto fijo.
                </p>
              </div>

              <div>
                <textarea
                  autoFocus
                  value={justificacionText}
                  onChange={(e) => setJustificacionText(e.target.value)}
                  placeholder="Escriba el motivo aquí..."
                  className="w-full h-24 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:border-primary/30 focus:bg-white transition-all resize-none shadow-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowJustificacion(null);
                    showTacticalToast({
                      title: "Operación Abortada",
                      message:
                        "Se requiere justificación para asignar personal disponible.",
                      type: "info",
                    });
                  }}
                  className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={!justificacionText.trim()}
                  onClick={() => {
                    const { per, newVigilanteId } = showJustificacion;
                    const updated = prog!.personal.map((p) =>
                      p.rol === per.rol
                        ? { ...p, vigilanteId: newVigilanteId }
                        : p,
                    );
                    asignarPersonal(prog!.id, updated, username || "Sistema");

                    updateGuardStatus(
                      newVigilanteId,
                      "activo",
                      puestoId,
                      `Asignado como TITULAR en ${puestoNombre}: ${justificacionText}`,
                    );

                    logAction(
                      "PROGRAMACION",
                      "Personal actualizado",
                      `Rol ${ROL_LABELS[per.rol as RolPuesto]}: ${newVigilanteId}`,
                      "info",
                    );

                    showTacticalToast({
                      title: "Traslado Registrado",
                      message: `${showJustificacion.vigilante.nombre} activado exitosamente.`,
                      type: "success",
                    });

                    setShowJustificacion(null);
                  }}
                  className="flex-[1.5] h-12 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-30 disabled:hover:scale-100 active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit cell modal */}
      {editCell &&
        createPortal(
          <EditCeldaModal
            asig={editCell}
            vigilantes={vigilantes}
            titularesId={prog.personal
              .filter((p) => p.vigilanteId)
              .map((p) => p.vigilanteId!)}
            ocupados={ocupados}
            turnosConfig={turnosConfig}
            jornadasCustom={jornadasCustom}
            onSave={handleSaveCell}
            onClose={() => setEditCell(null)}
          />,
          document.body,
        )}

      {/* ====================================================================
          COMPARE PANEL — Premium Glassmorphism Design
          ==================================================================== */}
      {activeTab === "calendario" && (
        <div
          className="z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.4)] flex-shrink-0"
          style={{
            background: "linear-gradient(180deg, rgba(30,27,75,0.98) 0%, rgba(15,23,42,0.99) 100%)",
            backdropFilter: "blur(24px)",
            borderTop: "1.5px solid rgba(99,102,241,0.3)",
            maxHeight: compareExpanded ? "300px" : "46px",
            transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
            overflow: "hidden",
          }}
        >
          {/* ─── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 h-[46px] border-b border-white/8">
            {/* Icon */}
            <div className="size-6 rounded-lg bg-indigo-600/40 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-indigo-300" style={{ fontSize: "13px" }}>compare_arrows</span>
            </div>
            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest shrink-0">
              Coord. Relevantes
            </span>

            {/* Current puesto */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-violet-500/15 border border-violet-500/20 rounded-full shrink-0">
              <span className="size-1.5 rounded-full bg-violet-400" />
              <span className="text-[8px] font-black text-violet-300 max-w-[90px] truncate">{puestoNombre}</span>
            </div>

            <span className="material-symbols-outlined text-slate-700 hidden sm:block text-[13px]">east</span>

            {/* Selector */}
            <select
              value={comparePuestoId || ""}
              onChange={(e) => setComparePuestoId(e.target.value || null)}
              className="h-8 text-[10px] font-bold rounded-xl px-3 outline-none transition-all"
              style={{
                minWidth: "160px",
                maxWidth: "220px",
                background: comparePuestoId ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                border: comparePuestoId ? "1.5px solid rgba(99,102,241,0.45)" : "1.5px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0",
              }}
            >
              <option value="" style={{ background: "#0f172a" }}>— Elegir puesto —</option>
              {allPuestos.filter((p) => p.id !== puestoId && p.dbId !== puestoId).map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#0f172a" }}>{p.nombre}</option>
              ))}
            </select>

            {comparePuestoId && (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-emerald-500/12 border border-emerald-500/25 rounded-full">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[7px] font-black text-emerald-300 uppercase tracking-wide">En vivo</span>
              </div>
            )}

            {/* Right */}
            <div className="ml-auto flex items-center gap-2">
              {comparePuestoId && (
                <button
                  onClick={() => setComparePuestoId(null)}
                  className="h-6 px-2 rounded-lg text-[8px] font-black uppercase text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setCompareExpanded(!compareExpanded)}
                className="size-7 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: "16px" }}>
                  {compareExpanded ? "keyboard_arrow_down" : "keyboard_arrow_up"}
                </span>
              </button>
            </div>
          </div>

          {/* ─── Grid Content ──────────────────────────────────────────── */}
          {comparePuestoId && (() => {
            const cPuesto = allPuestos.find((p) => p.id === comparePuestoId || p.dbId === comparePuestoId);
            const cProg = allProgramaciones.find(
              (p) =>
                (p.puestoId === comparePuestoId || p.puestoId === cPuesto?.dbId || p.puestoId === cPuesto?.id) &&
                p.anio === anio && p.mes === mes,
            );

            // cProg is available for future use or extended logic

            const daysArr = Array.from({ length: new Date(anio, mes + 1, 0).getDate() }, (_, i) => i + 1);
            const WD = ["D","L","M","X","J","V","S"];
            const ROL_GRAD: Record<string, string> = {
              titular_a: "linear-gradient(135deg,#6366f1,#4338ca)",
              titular_b: "linear-gradient(135deg,#0ea5e9,#0284c7)",
              relevante: "linear-gradient(135deg,#10b981,#059669)",
            };

            return (
              <div className="px-5 pt-3 pb-4 overflow-auto" style={{ maxHeight: "254px" }}>
                {/* Sub-header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: "13px" }}>location_on</span>
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">{cPuesto?.nombre}</span>
                  <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                    {MONTH_NAMES[mes]} {anio}
                  </span>
                  {/* Instruction label */}
                  <span className="text-[7px] font-bold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/30">
                    Disponibilidad según: <span className="text-indigo-300">{puestoNombre}</span>
                  </span>
                  {/* Legend */}
                  <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-4 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}>
                        <span className="material-symbols-outlined text-white" style={{ fontSize: "9px" }}>check_circle</span>
                      </div>
                      <span className="text-[8px] font-bold text-emerald-400">Puede programarse</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-4 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#991b1b,#7f1d1d)" }}>
                        <span className="material-symbols-outlined text-white" style={{ fontSize: "9px" }}>block</span>
                      </div>
                      <span className="text-[8px] font-bold text-red-400">Ya programado (OCUPADO)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-4 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#713f12,#854d0e)" }}>
                        <span className="material-symbols-outlined text-white" style={{ fontSize: "9px" }}>bedtime</span>
                      </div>
                      <span className="text-[8px] font-bold text-orange-300">Descanso/Vacación</span>
                    </div>
                  </div>
                </div>

                {/* Day header */}
                <div className="flex gap-1 items-end mb-1">
                  <div style={{ minWidth: "164px" }} className="pl-2 text-[8px] font-black text-slate-600 uppercase tracking-widest">Efectivo</div>
                  {daysArr.map((d) => {
                    const dow = new Date(anio, mes, d).getDay();
                    const isW = dow === 0 || dow === 6;
                    const isSun = dow === 0;
                    return (
                      <div key={d} className="flex flex-col items-center" style={{ minWidth: "28px" }}>
                        <span className={`text-[7px] font-bold leading-none ${isSun ? "text-red-400" : isW ? "text-indigo-400" : "text-slate-600"}`}>{WD[dow]}</span>
                        <span className={`text-[10px] font-black leading-tight ${isSun ? "text-red-300" : isW ? "text-indigo-300" : "text-slate-300"}`}>{d}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Guard rows */}
                <div className="space-y-2">
                  {(prog?.personal || []).filter(p => p.vigilanteId).map((per) => {
                    const vig = vigilantes.find((v) => v.id === per.vigilanteId || v.dbId === per.vigilanteId);
                    const vid = per.vigilanteId!;
                    const initials = vig?.nombre.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

                    return (
                      <div key={per.rol} className="flex gap-1 items-center group/row">
                        {/* Avatar + name */}
                        <div
                          className="shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all group-hover/row:bg-white/5"
                          style={{ minWidth: "164px" }}
                        >
                          <div
                            className="size-8 rounded-xl flex items-center justify-center font-black text-white text-[10px] shrink-0 shadow-lg"
                            style={{ background: ROL_GRAD[per.rol] || ROL_GRAD.titular_a }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-white truncate leading-tight">
                              {vig?.nombre.split(" ").slice(0, 2).join(" ") || vid}
                            </p>
                            <p className="text-[7px] font-bold uppercase tracking-widest leading-tight text-indigo-400">
                              {ROL_LABELS[per.rol as RolPuesto] || per.rol}
                            </p>
                          </div>
                        </div>

                        {/* Day cells — Lógica de disponibilidad */}
                        {daysArr.map((d) => {
                          // Buscar si el vigilante YA ESTÁ PROGRAMADO en el puesto SUPERIOR (barra superior) ese día
                          const myAsig = prog?.asignaciones.find(
                            (a) => a.dia === d && (a.vigilanteId === vid || a.vigilanteId === vig?.dbId)
                          );
                          // Está "ocupado" si tiene jornada normal (trabajando) en el puesto actual de la barra superior
                          const isOcupado = !!(myAsig && myAsig.jornada === "normal" && myAsig.vigilanteId);
                          // Tiene descanso/vacación ese día en el puesto superior
                          const isDescanso = !!(myAsig && (
                            myAsig.jornada === "descanso_remunerado" ||
                            myAsig.jornada === "descanso_no_remunerado" ||
                            myAsig.jornada === "vacacion"
                          ));
                          // Verif post-PM: si trabajó turno PM el día anterior, necesita descanso hoy
                          const prevAsig = prog?.asignaciones.find(
                            (a) => a.dia === d - 1 && (a.vigilanteId === vid || a.vigilanteId === vig?.dbId)
                          );
                          const isDescansoPM = !!(prevAsig && prevAsig.jornada === "normal" && prevAsig.turno === "PM");
                          // Turno del día en el puesto superior (para chip)
                          const myTurno = myAsig?.turno || null;
                          const dow = new Date(anio, mes, d).getDay();
                          const isW = dow === 0 || dow === 6;

                          let bg: string;
                          let icon: string;
                          let iconColor: string;
                          let borderColor: string;
                          let glow: string;
                          let tooltipText: string;

                          if (isOcupado) {
                            // 🔴 ROJO — Ya tiene turno normal en el puesto superior ese día
                            bg = "linear-gradient(135deg,#991b1b 0%,#7f1d1d 100%)";
                            icon = "block";
                            iconColor = "#fca5a5";
                            borderColor = "#ef444466";
                            glow = "0 0 6px rgba(239,68,68,0.4)";
                            tooltipText = `DÍA ${d} | ${vig?.nombre || vid}: YA PROGRAMADO en "${puestoNombre}" (${myTurno || ""}) — NO disponible para ${cPuesto?.nombre}`;
                          } else if (isDescanso) {
                            // 🟠 NARANJA — Tiene descanso o vacación en el puesto superior
                            bg = "linear-gradient(135deg,#7c2d12 0%,#431407 100%)";
                            icon = "bedtime";
                            iconColor = "#fdba74";
                            borderColor = "#f9731666";
                            glow = "none";
                            tooltipText = `DÍA ${d} | ${vig?.nombre || vid}: ${myAsig?.jornada === "vacacion" ? "Vacación" : "Descanso"} en "${puestoNombre}" — Verificar disponibilidad`;
                          } else if (isDescansoPM) {
                            // 🟡 AMARILLO — Descanso post-turno PM del día anterior
                            bg = "linear-gradient(135deg,#713f12 0%,#854d0e 100%)";
                            icon = "schedule";
                            iconColor = "#fde68a";
                            borderColor = "#fbbf2466";
                            glow = "none";
                            tooltipText = `DÍA ${d} | ${vig?.nombre || vid}: Descanso post-PM (vino de turno PM el día ${d-1})`;
                          } else {
                            // 🟢 VERDE — Libre, puede programarse en el otro puesto
                            bg = isW
                              ? "linear-gradient(135deg,#14532d 0%,#15803d 100%)"
                              : "linear-gradient(135deg,#166534 0%,#15803d90 100%)";
                            icon = "check_circle";
                            iconColor = "#86efac";
                            borderColor = "#22c55e55";
                            glow = "0 0 5px rgba(34,197,94,0.3)";
                            tooltipText = `DÍA ${d} | ${vig?.nombre || vid}: LIBRE — Puede programarse en "${cPuesto?.nombre}"`;
                          }

                          return (
                            <div
                              key={d}
                              title={tooltipText}
                              className="relative flex items-center justify-center rounded-md cursor-default transition-all hover:scale-125 hover:z-20"
                              style={{
                                minWidth: "28px",
                                height: "28px",
                                background: bg,
                                border: `1.5px solid ${borderColor}`,
                                boxShadow: glow,
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "12px", color: iconColor }}>{icon}</span>
                              {/* Chip del turno cuando está ocupado */}
                              {isOcupado && myTurno && (
                                <span
                                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[5px] font-black px-1 rounded leading-[1.5]"
                                  style={{ background: "#dc2626", color: "#fff", whiteSpace: "nowrap" }}
                                >
                                  {myTurno}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Empty state */}
          {!comparePuestoId && compareExpanded && (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl border border-indigo-800/50 bg-indigo-950/50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-indigo-700 text-[22px]">apartment</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="size-1.5 rounded-full bg-indigo-800 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <div className="size-12 rounded-2xl border border-dashed border-indigo-700/40 bg-indigo-950/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-indigo-800 text-[22px]">add_circle</span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-indigo-700/80 text-center max-w-xs">
                Elige un puesto para ver conflictos de relevantes dia a dia
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// â”€â”€ MAIN PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const GestionPuestos = () => {
  const puestos = usePuestoStore((s) => s.puestos);
  const programaciones = useProgramacionStore((s) => s.programaciones);
  const getCoberturaPorcentaje = useProgramacionStore(
    (s) => s.getCoberturaPorcentaje,
  );
  const getAlertas = useProgramacionStore((s) => s.getAlertas);
  const crearOObtenerProgramacion = useProgramacionStore(
    (s) => s.crearOObtenerProgramacion,
  );
  const { username } = useAuthStore();

  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth());
  const [filtroZona, setFiltroZona] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroCobertura, setFiltroCobertura] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [puestoSeleccionado, setPuestoSeleccionado] = useState<{
    id: string;
    nombre: string;
  } | null>(null);

  const puestosConProg = useMemo(() => {
    return puestos.map((p) => {
      // CRITICAL: Look up using UUID then fallback to Shorthand to ensure accuracy
      const prog = programaciones.find(
        (pr) =>
          (pr.puestoId === p.dbId || pr.puestoId === p.id) &&
          pr.anio === anio &&
          pr.mes === mes,
      );
      const cobertura = prog ? getCoberturaPorcentaje(prog.id) : 0;
      const alertas = prog ? getAlertas(prog.id) : [];
      return {
        ...p,
        cobertura,
        alertas,
        progEstado: prog?.estado ?? "sin_programacion",
      };
    });
  }, [puestos, programaciones, anio, mes, getCoberturaPorcentaje, getAlertas]);

  const puestosFiltrados = useMemo(() => {
    return puestosConProg.filter((p) => {
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
      if (filtroCobertura === "completo" && p.cobertura < 80) return false;
      if (filtroCobertura === "incompleto" && p.cobertura >= 80) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (
          !p.nombre.toLowerCase().includes(q) &&
          !p.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [puestosConProg, filtroEstado, filtroCobertura, busqueda]);

  const statsGlobales = useMemo(
    () => ({
      total: puestos.length,
      publicados: puestosConProg.filter((p) => p.progEstado === "publicado")
        .length,
      borradores: puestosConProg.filter((p) => p.progEstado === "borrador")
        .length,
      sinProg: puestosConProg.filter((p) => p.progEstado === "sin_programacion")
        .length,
      coberturaPromedio:
        puestosConProg.length > 0
          ? Math.round(
              puestosConProg.reduce((a, p) => a + p.cobertura, 0) /
                puestosConProg.length,
            )
          : 0,
    }),
    [puestos, puestosConProg],
  );

  if (puestoSeleccionado) {
    return (
      <PanelMensualPuesto
        puestoId={puestoSeleccionado.id}
        puestoNombre={puestoSeleccionado.nombre}
        anio={anio}
        mes={mes}
        onClose={() => setPuestoSeleccionado(null)}
      />
    );
  }

  return (
    <div className="page-container space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 px-2">
        <div>
          <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            <span>Sistema</span>
            <span className="material-symbols-outlined text-[14px] notranslate">
              chevron_right
            </span>
            <span className="text-primary font-black">Puestos Activos</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            Programación <span className="text-primary">Puestos Activos</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            Panel de control mensual · Gestión de personal élite
          </p>
        </div>

        {/* Month/Year selector */}
        <div className="flex items-center gap-3 bg-white border border-slate-100 p-2 rounded-2xl shadow-sm">
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-2">
            Mes a programar:
          </span>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none hover:border-primary/50 transition-all cursor-pointer"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="h-10 w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none hover:border-primary/50 transition-all cursor-text"
          />
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Total Puestos",
            value: statsGlobales.total,
            icon: "location_on",
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Publicados",
            value: statsGlobales.publicados,
            icon: "verified",
            color: "text-success",
            bg: "bg-success/10",
          },
          {
            label: "Borradores",
            value: statsGlobales.borradores,
            icon: "edit_note",
            color: "text-warning",
            bg: "bg-warning/10",
          },
          {
            label: "Sin Programar",
            value: statsGlobales.sinProg,
            icon: "schedule",
            color: "text-danger",
            bg: "bg-danger/10",
          },
          {
            label: "Cobertura Prom.",
            value: `${statsGlobales.coberturaPromedio}%`,
            icon: "donut_large",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm"
          >
            <div
              className={`${s.bg} size-10 rounded-2xl flex items-center justify-center mb-3`}
            >
              <span
                className={`material-symbols-outlined ${s.color} notranslate`}
              >
                {s.icon}
              </span>
            </div>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] notranslate">
            search
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar puesto..."
            className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-primary/50"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none"
        >
          <option value="todos">Todos los estados</option>
          <option value="cubierto">Cubierto</option>
          <option value="alerta">En Alerta</option>
          <option value="desprotegido">Desprotegido</option>
        </select>
        <select
          value={filtroCobertura}
          onChange={(e) => setFiltroCobertura(e.target.value)}
          className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none"
        >
          <option value="todos">Toda la cobertura</option>
          <option value="completo">â‰¥80% Completo</option>
          <option value="incompleto">&lt;80% Incompleto</option>
        </select>
        <span className="text-[10px] font-bold text-slate-400">
          {puestosFiltrados.length} puestos
        </span>
      </div>

      {/* Puestos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {puestosFiltrados.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
            onClick={() =>
              setPuestoSeleccionado({ id: p.dbId || p.id, nombre: p.nombre })
            }
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {p.id}
                </p>
                <h3 className="text-base font-black text-slate-900 mt-0.5 group-hover:text-primary transition-colors">
                  {p.nombre}
                </h3>
              </div>
              <span
                className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${p.estado === "cubierto" ? "bg-success/10 text-success" : p.estado === "alerta" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}
              >
                {p.estado}
              </span>
            </div>

            {/* Coverage bar */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Programación {MONTH_NAMES[mes]}
                </span>
                <span
                  className={`text-[11px] font-black ${p.cobertura >= 80 ? "text-success" : p.cobertura >= 50 ? "text-warning" : "text-danger"}`}
                >
                  {p.cobertura}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p.cobertura >= 80 ? "bg-success" : p.cobertura >= 50 ? "bg-warning" : "bg-danger"}`}
                  style={{ width: `${p.cobertura}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black px-2.5 py-1 rounded-full ${p.progEstado === "publicado" ? "bg-success/10 text-success" : p.progEstado === "borrador" ? "bg-warning/10 text-warning" : "bg-slate-100 text-slate-400"}`}
              >
                {p.progEstado === "publicado"
                  ? "âœ“ Publicado"
                  : p.progEstado === "borrador"
                    ? "âœï¸ Borrador"
                    : "Sin programar"}
              </span>
              {p.alertas.length > 0 && (
                <span className="text-[10px] font-black text-danger flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    warning
                  </span>
                  {p.alertas.length} alerta{p.alertas.length > 1 ? "s" : ""}
                </span>
              )}
              <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-[20px]">
                arrow_forward
              </span>
            </div>
          </div>
        ))}

        {puestosFiltrados.length === 0 && (
          <div className="col-span-3 text-center py-20">
            <span className="material-symbols-outlined text-6xl text-slate-200">
              location_off
            </span>
            <p className="mt-4 text-[12px] font-black text-slate-400 uppercase tracking-widest">
              Sin puestos que coincidan con los filtros
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionPuestos;

