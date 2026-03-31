import { type TurnoConfig, type JornadaCustom } from '../store/puestoStore';
import { type RolPuesto } from '../store/programacionStore';

export const DEFAULT_TURNOS: TurnoConfig[] = [
  { id: "AM", nombre: "Turno AM", inicio: "06:00", fin: "18:00" },
  { id: "PM", nombre: "Turno PM", inicio: "18:00", fin: "06:00" },
];

export const DEFAULT_JORNADAS: JornadaCustom[] = [
  { id: "normal", nombre: "Normal", short: "N", color: "#4318FF", textColor: "#fff" },
  { id: "descanso_remunerado", nombre: "Desc. Rem.", short: "DR", color: "#00b377", textColor: "#fff" },
  { id: "descanso_no_remunerado", nombre: "Desc. N/Rem.", short: "DNR", color: "#ff9500", textColor: "#fff" },
  { id: "vacacion", nombre: "Vacación", short: "VAC", color: "#8b5cf6", textColor: "#fff" },
  { id: "sin_asignar", nombre: "Sin asignar", short: "-", color: "#ef4444", textColor: "#fff" },
];

export const ROL_LABELS: Record<RolPuesto, string> = {
  titular_a: "Titular A",
  titular_b: "Titular B",
  relevante: "Relevante",
};

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
