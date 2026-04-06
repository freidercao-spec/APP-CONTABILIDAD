import React, { useState, useMemo, useEffect, useCallback } from "react";
import { usePuestoStore } from "../store/puestoStore";
import { useVigilanteStore } from "../store/vigilanteStore";
import {
  useProgramacionStore,
  type AsignacionDia,
  type TurnoHora,
  type ProgramacionMensual,
  type PersonalPuesto,
  type RolPuesto,
} from "../store/programacionStore";
import { useAuthStore } from "../store/authStore";
import { useAuditStore } from "../store/auditStore";
import { showTacticalToast } from "../utils/tacticalToast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Sub-components
import { CeldaCalendario } from "../components/puestos/CeldaCalendario";
import { EditCeldaModal } from "../components/puestos/EditCeldaModal";
import { PuestoCard } from "../components/puestos/PuestoCard";
import { CoordinationPanel } from "../components/puestos/CoordinationPanel";

// Constants
import {
  DEFAULT_TURNOS,
  DEFAULT_JORNADAS,
  ROL_LABELS,
  MONTH_NAMES,
} from "../utils/puestosConstants";

// ─── Jornada shorthand para PDF ───────────────────────────────────────────────
const JORNADA_PDF: Record<string, string> = {
  normal: "N",
  descanso_remunerado: "DR",
  descanso_no_remunerado: "DNR",
  vacacion: "VAC",
  sin_asignar: "-",
  AM: "D",
  PM: "N",
  "24H": "24",
};

// ─── Celda vacía ──────────────────────────────────────────────────────────────
const CeldaVacia = React.memo(
  ({
    onAdd,
    isWeekend,
    isCompatible,
  }: {
    onAdd: () => void;
    isWeekend?: boolean;
    isCompatible?: boolean;
  }) => (
    <button
      onClick={onAdd}
      className={`w-full h-full rounded-lg flex items-center justify-center border transition-all group relative ${
        isCompatible
          ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_10px_rgba(250,204,21,0.2)]"
          : isWeekend
          ? "border-slate-200 border-dashed bg-slate-50/80"
          : "border-slate-100 border-dashed bg-slate-50/40"
      } hover:border-primary/40 hover:bg-primary/5`}
      style={{ minHeight: "72px" }}
    >
      <div className="flex flex-col items-center gap-1">
        <span
          className={`material-symbols-outlined text-[16px] ${
            isCompatible
              ? "text-yellow-500 animate-pulse"
              : "text-slate-300 group-hover:text-primary/60"
          }`}
        >
          {isCompatible ? "stars" : "add_circle"}
        </span>
      </div>
    </button>
  )
);

// ─── Helper nombre puesto ─────────────────────────────────────────────────────
const getPuestoNombre = (
  prog: ProgramacionMensual | null | undefined,
  allPuestos: any[]
): string => {
  if (!prog) return "";
  const progAny = prog as any;
  if (progAny.puestoNombre) return progAny.puestoNombre;
  const found = allPuestos.find(
    (p) => p.id === prog.puestoId || p.dbId === prog.puestoId
  );
  return found?.nombre || prog.puestoId || "Puesto";
};

// ─── Modal: Gestión de Personal del Puesto ───────────────────────────────────
const GestionPersonalModal = ({
  prog,
  puestoNombre,
  onClose,
  onSave,
}: {
  prog: ProgramacionMensual;
  puestoNombre: string;
  onClose: () => void;
  onSave: (personal: PersonalPuesto[]) => void;
}) => {
  const vigilantes = useVigilanteStore((s) => s.vigilantes);
  const [personal, setPersonal] = useState<PersonalPuesto[]>(
    prog.personal.length > 0
      ? [...prog.personal]
      : [
          { rol: "titular_a", vigilanteId: null },
          { rol: "titular_b", vigilanteId: null },
          { rol: "relevante", vigilanteId: null },
        ]
  );
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  const ROLES: { rol: RolPuesto; label: string; color: string; icon: string }[] = [
    { rol: "titular_a", label: "Titular A", color: "bg-primary", icon: "shield" },
    { rol: "titular_b", label: "Titular B", color: "bg-indigo-600", icon: "shield_person" },
    { rol: "relevante", label: "Relevante / Backup", color: "bg-slate-600", icon: "groups" },
  ];

  const getFilteredVigilantes = (rol: string) => {
    const q = (searchTerms[rol] || "").toLowerCase().trim();
    const usedIds = personal
      .filter((p) => p.rol !== rol && p.vigilanteId)
      .map((p) => p.vigilanteId);
    if (!q)
      return vigilantes
        .filter((v) => !usedIds.includes(v.id) && !usedIds.includes(v.dbId))
        .slice(0, 30);
    return vigilantes
      .filter(
        (v) =>
          (v.nombre?.toLowerCase().includes(q) || v.cedula?.includes(q) || v.id?.toLowerCase().includes(q)) &&
          !usedIds.includes(v.id) &&
          !usedIds.includes(v.dbId)
      )
      .slice(0, 40);
  };

  const setPersonalVigilante = (rol: string, vigilanteId: string | null) => {
    setPersonal((prev) => {
      const exists = prev.find((p) => p.rol === rol);
      if (exists) return prev.map((p) => (p.rol === rol ? { ...p, vigilanteId } : p));
      return [...prev, { rol, vigilanteId }];
    });
    setSearchTerms((prev) => ({ ...prev, [rol]: "" }));
  };

  const getNombreAsignado = (rol: string) => {
    const p = personal.find((p) => p.rol === rol);
    if (!p?.vigilanteId) return null;
    const v = vigilantes.find((v) => v.id === p.vigilanteId || v.dbId === p.vigilanteId);
    return v?.nombre || p.vigilanteId;
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
              Personal del Puesto
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              {puestoNombre} — Asigna el equipo titular
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-white text-[20px]">close</span>
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {ROLES.map(({ rol, label, color, icon }) => {
            const nombreAsignado = getNombreAsignado(rol);
            const q = searchTerms[rol] || "";
            const filtered = getFilteredVigilantes(rol);

            return (
              <div key={rol} className="bg-white/[0.04] rounded-3xl p-5 border border-white/5">
                {/* Rol header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`size-9 rounded-xl ${color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-white text-[18px]">{icon}</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-white uppercase">{label}</p>
                    {nombreAsignado ? (
                      <p className="text-[10px] text-emerald-400 font-bold">✓ {nombreAsignado}</p>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-bold">Sin asignar</p>
                    )}
                  </div>
                  {nombreAsignado && (
                    <button
                      onClick={() => setPersonalVigilante(rol, null)}
                      className="ml-auto px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[9px] font-black uppercase transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                {/* Search */}
                <div className="relative mb-2">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, cédula o código..."
                    value={q}
                    onChange={(e) =>
                      setSearchTerms((prev) => ({ ...prev, [rol]: e.target.value }))
                    }
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[11px] font-bold text-white outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>

                {/* Results */}
                <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                  {filtered.length === 0 && q && (
                    <p className="text-center text-[10px] text-slate-500 py-3">
                      No se encontraron vigilantes
                    </p>
                  )}
                  {!q && !nombreAsignado && (
                    <p className="text-center text-[10px] text-slate-600 py-2">
                      Escribe para buscar vigilantes disponibles
                    </p>
                  )}
                  {filtered.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setPersonalVigilante(rol, v.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                        personal.find((p) => p.rol === rol)?.vigilanteId === v.id
                          ? "bg-emerald-500/20 border border-emerald-500/30"
                          : "bg-white/5 hover:bg-white/10 border border-transparent"
                      }`}
                    >
                      <div className="size-7 rounded-lg bg-black/30 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                        {v.nombre?.[0] || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white truncate">{v.nombre}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">
                          {v.cedula || v.id} · {v.estado || "activo"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(personal)}
            className="flex-1 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] mr-2 align-middle">save</span>
            Guardar Personal del Puesto
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Panel Mensual Principal ──────────────────────────────────────────────────
const PanelMensualPuesto = ({
  puestoId,
  puestoNombre,
  anio,
  mes,
  onClose,
}: {
  puestoId: string;
  puestoNombre: string;
  anio: number;
  mes: number;
  onClose: () => void;
}) => {
  const { username } = useAuthStore();
  const vigilantes = useVigilanteStore((s) => s.vigilantes);
  const allPuestos = usePuestoStore((s) => s.puestos);
  const allProgramaciones = useProgramacionStore((s) => s.programaciones);
  const logAction = useAuditStore((s) => s.logAction);

  const {
    crearOObtenerProgramacion,
    actualizarAsignacion,
    publicarProgramacion,
    guardarBorrador,
    getProgramacion,
    isSyncing,
    fetchProgramacionDetalles,
    guardarComoPlantilla,
    aplicarPlantilla,
    templates,
    set: storeSet,
  } = useProgramacionStore() as any;

  const [editCell, setEditCell] = useState<{
    asig: AsignacionDia;
    progId: string;
    preSelectVigilanteId?: string;
  } | null>(null);
  const [showEntireStaff, setShowEntireStaff] = useState(false);
  const [hideBusyGuards, setHideBusyGuards] = useState(true);
  const [compareProgId, setCompareProgId] = useState<string | null>(null);
  const [compareVigilanteId, setCompareVigilanteId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const currentUser =
    username || useAuthStore.getState().username || "Operador";

  const prog = useMemo(
    () => getProgramacion(puestoId, anio, mes),
    [allProgramaciones, getProgramacion, puestoId, anio, mes]
  );
  const puesto = useMemo(
    () =>
      allPuestos.find((p) => p.id === puestoId || p.dbId === puestoId),
    [allPuestos, puestoId]
  );

  useEffect(() => {
    if (!prog) {
      crearOObtenerProgramacion(puestoId, anio, mes, currentUser);
    } else if (!prog.isDetailLoaded && !prog.isFetching) {
      fetchProgramacionDetalles(prog.id);
    }
  }, [prog?.id, puestoId, anio, mes]);

  const daysInMonth = new Date(anio, mes + 1, 0).getDate();
  const daysArr = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );

  const freshCProg = useMemo(
    () =>
      compareProgId
        ? allProgramaciones.find((p) => p.id === compareProgId)
        : null,
    [compareProgId, allProgramaciones]
  );

  const ocupadosMap = useMemo(() => {
    const map = new Map<string, any[]>();
    allProgramaciones.forEach((p) => {
      if (!p.asignaciones) return;
      p.asignaciones.forEach((a) => {
        if (a.vigilanteId && a.jornada !== "sin_asignar") {
          if (!map.has(a.vigilanteId)) map.set(a.vigilanteId, []);
          const pNombre = getPuestoNombre(p, allPuestos);
          map
            .get(a.vigilanteId)!
            .push({ slot: `${a.dia}-${a.turno}`, puesto: pNombre });
        }
      });
    });
    return map;
  }, [allProgramaciones, allPuestos]);

  const vigilanteMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!Array.isArray(vigilantes)) return m;
    vigilantes.forEach((v) => {
      if (v?.id) m.set(v.id, v.nombre || "Sin nombre");
      if (v?.dbId) m.set(v.dbId, v.nombre || "Sin nombre");
    });
    return m;
  }, [vigilantes]);

  // ── Guardar personal desde modal ─────────────────────────────────────────
  const handleSavePersonal = useCallback(
    (personal: PersonalPuesto[]) => {
      if (!prog) return;
      // Actualizar el store directamente
      useProgramacionStore.setState((s: any) => ({
        programaciones: s.programaciones.map((p: any) =>
          p.id === prog.id
            ? { ...p, personal, syncStatus: "pending" }
            : p
        ),
      }));
      setShowPersonalModal(false);
      showTacticalToast({
        title: "✅ Personal Actualizado",
        message: `${personal.filter((p) => p.vigilanteId).length} efectivos asignados al puesto.`,
        type: "success",
      });
      // Forzar sync
      const queueSync = (useProgramacionStore as any).__syncQueue;
      if (queueSync) queueSync(prog.id);
      logAction("PROGRAMACION", "Personal Actualizado", `Puesto: ${puestoNombre}`, "success");
    },
    [prog, puestoNombre, logAction]
  );

  // ── Generación de PDF del puesto ─────────────────────────────────────────
  const handleGeneratePDF = useCallback(async () => {
    if (!prog) return;
    setIsGeneratingPDF(true);
    logAction("PROGRAMACION", "Exportar PDF", `${puestoNombre} ${MONTH_NAMES[mes]} ${anio}`, "info");

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const fechaActual = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });

      // ── Header ──────────────────────────────────────────────────────────
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.5);
      doc.rect(8, 8, pageW - 16, 25);

      // Logo CORAZA
      doc.setFillColor(67, 24, 255);
      doc.rect(10, 10, 21, 21, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      doc.text("CORAZA", 20.5, 18, { align: "center" });
      doc.text("SEGURIDAD", 20.5, 22, { align: "center" });
      doc.text("CTA", 20.5, 26, { align: "center" });

      // Título central
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("CUADRO OPERATIVO DE PROGRAMACION", pageW / 2, 17, { align: "center" });
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("CORAZA SEGURIDAD PRIVADA CTA - NIT 901509121", pageW / 2, 22, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(`${MONTH_NAMES[mes].toUpperCase()} ${anio}`, pageW / 2, 28, { align: "center" });

      // Panel derecho
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text("PUESTO:", pageW - 72, 14);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(puestoNombre.slice(0, 35).toUpperCase(), pageW - 53, 14);

      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "normal");
      doc.text("REVISIÓN:", pageW - 72, 20);
      doc.setTextColor(15, 23, 42);
      doc.text(fechaActual, pageW - 53, 20);

      doc.setTextColor(71, 85, 105);
      doc.text("DIRECCIÓN:", pageW - 72, 26);
      doc.setTextColor(15, 23, 42);
      doc.text((puesto?.direccion || "—").slice(0, 30), pageW - 53, 26);

      // ── Tabla ────────────────────────────────────────────────────────────
      const ROL_ORDER: Record<string, number> = { titular_a: 0, titular_b: 1, relevante: 2 };
      const ROL_PDF: Record<string, string> = { titular_a: "TIT-A", titular_b: "TIT-B", relevante: "REL" };

      const sortedPersonal = [...(prog.personal || [])].sort(
        (a, b) => (ROL_ORDER[a.rol] ?? 99) - (ROL_ORDER[b.rol] ?? 99)
      );

      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const headRow = [
        "ROL",
        "CÉDULA",
        "VIGILANTE",
        ...days.map((d) => String(d).padStart(2, "0")),
      ];

      const bodyRows = sortedPersonal
        .filter((per) => per.vigilanteId)
        .map((per) => {
          const vig = vigilantes.find(
            (v) => v.id === per.vigilanteId || v.dbId === per.vigilanteId
          );
          const nombre = (vig?.nombre || "Sin nombre").toUpperCase();
          const cedula = vig?.cedula || "-";
          const rowData: string[] = [ROL_PDF[per.rol] || per.rol, cedula, nombre];

          days.forEach((d) => {
            const asig = prog.asignaciones.find(
              (a) =>
                a.dia === d &&
                (a.vigilanteId === per.vigilanteId || a.vigilanteId === vig?.dbId)
            );
            const label =
              (asig?.jornada && JORNADA_PDF[asig.jornada]) ||
              (asig?.turno && JORNADA_PDF[asig.turno]) ||
              "-";
            rowData.push(label === "sin_asignar" ? "-" : label);
          });

          return rowData;
        });

      // Si no hay personal asignado, mostrar mensaje
      if (bodyRows.length === 0) {
        bodyRows.push(["—", "—", "SIN PERSONAL ASIGNADO", ...days.map(() => "")]);
      }

      autoTable(doc, {
        startY: 38,
        head: [headRow],
        body: bodyRows,
        theme: "grid",
        styles: {
          fontSize: 5.2,
          cellPadding: 0.9,
          halign: "center",
          valign: "middle",
          lineWidth: 0.1,
          textColor: [30, 41, 59],
          font: "helvetica",
        },
        headStyles: {
          fillColor: [67, 24, 255],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 5.5,
        },
        columnStyles: {
          0: { fontStyle: "bold", minCellWidth: 10, halign: "center", textColor: [67, 24, 255] },
          1: { minCellWidth: 16 },
          2: { minCellWidth: 38, halign: "left", fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.row.type === "body" && data.column.index >= 3) {
            const val = data.cell.text[0];
            if (val === "D") data.cell.styles.fillColor = [240, 246, 255];
            else if (val === "N") data.cell.styles.fillColor = [235, 233, 255];
            else if (val === "DR") data.cell.styles.fillColor = [236, 253, 245];
            else if (val === "DNR") data.cell.styles.fillColor = [255, 251, 235];
            else if (val === "VAC") data.cell.styles.fillColor = [245, 243, 255];
            else if (val === "24") data.cell.styles.fillColor = [254, 242, 242];
            else if (val === "-") data.cell.styles.textColor = [200, 200, 200];
          }
        },
        margin: { left: 8, right: 8 },
      });

      // ── Leyenda ──────────────────────────────────────────────────────────
      const finalY = (doc as any).lastAutoTable?.finalY || 80;
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "D=Diurno  N=Nocturno  DR=Desc. Remunerado  DNR=Desc. No Rem.  VAC=Vacación  24=Turno 24H  -=Sin Asignar",
        pageW / 2,
        Math.min(finalY + 7, pageH - 14),
        { align: "center" }
      );

      // ── Footer ───────────────────────────────────────────────────────────
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        "Coraza Seguridad Privada CTA  |  Carrera 81 #49-24 Medellín  |  Tel: 311 383 6939  |  www.corazaseguridadcta.com",
        pageW / 2,
        pageH - 7,
        { align: "center" }
      );

      const fileName = `PROG_${puestoNombre.replace(/\s+/g, "_").toUpperCase()}_${MONTH_NAMES[mes].toUpperCase()}_${anio}.pdf`;
      doc.save(fileName);
      showTacticalToast({
        title: "📄 PDF Generado",
        message: `${fileName} descargado correctamente.`,
        type: "success",
      });
    } catch (err: any) {
      console.error("[PDF] Error:", err);
      showTacticalToast({
        title: "❌ Error de PDF",
        message: err.message || "No se pudo generar el documento.",
        type: "error",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [prog, puestoNombre, mes, anio, daysInMonth, vigilantes, puesto, logAction]);

  if (!prog || prog.isFetching) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
          Sincronizando Tablero Táctico...
        </p>
      </div>
    );
  }

  const nombrePuesto = puestoNombre || getPuestoNombre(prog, allPuestos);
  const titularesId = (prog.personal || [])
    .map((p) => p.vigilanteId)
    .filter(Boolean) as string[];
  const turnosConfig = puesto?.turnosConfig?.length
    ? puesto.turnosConfig
    : DEFAULT_TURNOS;
  const jornadasCustom = puesto?.jornadasCustom?.length
    ? puesto.jornadasCustom
    : DEFAULT_JORNADAS;

  const staffAsignado = (prog.personal || []).filter((p) => p.vigilanteId);

  return (
    <div className="page-container animate-fade-in bg-slate-50 min-h-screen pb-32">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
            <button onClick={onClose} className="hover:underline">
              Puestos
            </button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Tablero {nombrePuesto}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase">{nombrePuesto}</h1>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {MONTH_NAMES[mes]} {anio} ·{" "}
            <span
              className={`${
                staffAsignado.length > 0 ? "text-emerald-600" : "text-amber-500"
              }`}
            >
              {staffAsignado.length} efectivos asignados
            </span>
            {isSyncing && (
              <span className="ml-3 text-primary animate-pulse">⟳ Sincronizando...</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* CONFIGURAR PERSONAL */}
          <button
            onClick={() => setShowPersonalModal(true)}
            className="px-5 py-2.5 bg-slate-800 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            Personal
            {staffAsignado.length > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-500 text-white rounded-full text-[8px] font-black">
                {staffAsignado.length}
              </span>
            )}
          </button>

          {/* PDF */}
          <button
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
            className="px-5 py-2.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-60"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                isGeneratingPDF ? "animate-spin" : ""
              }`}
            >
              {isGeneratingPDF ? "sync" : "picture_as_pdf"}
            </span>
            {isGeneratingPDF ? "Generando..." : "Exportar PDF"}
          </button>

          {/* BORRADOR */}
          <button
            onClick={() => guardarBorrador(prog.id, currentUser)}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>{" "}
            Borrador
          </button>

          {/* PUBLICAR */}
          <button
            onClick={() => publicarProgramacion(prog.id, currentUser)}
            className="px-6 py-2.5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>{" "}
            Publicar
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ── ESTADO VISUAL DEL PERSONAL ──────────────────────────────────── */}
      {staffAsignado.length === 0 && (
        <div
          onClick={() => setShowPersonalModal(true)}
          className="mb-6 px-6 py-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center gap-4 cursor-pointer hover:bg-amber-100 transition-colors group"
        >
          <span className="material-symbols-outlined text-amber-500 text-[28px]">
            warning
          </span>
          <div>
            <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">
              Sin Personal Asignado
            </p>
            <p className="text-[10px] font-bold text-amber-600 mt-0.5">
              Haz clic aquí para configurar el personal titular del puesto (Titular A, Titular B, Relevante)
            </p>
          </div>
          <span className="material-symbols-outlined text-amber-400 text-[20px] ml-auto group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </div>
      )}

      {staffAsignado.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {(prog.personal || [])
            .filter((p) => p.vigilanteId)
            .map((per) => {
              const v = vigilantes.find(
                (v) => v.id === per.vigilanteId || v.dbId === per.vigilanteId
              );
              const colors: Record<string, string> = {
                titular_a: "bg-primary/10 text-primary border-primary/20",
                titular_b: "bg-indigo-500/10 text-indigo-600 border-indigo-300/30",
                relevante: "bg-slate-100 text-slate-600 border-slate-200",
              };
              return (
                <div
                  key={per.rol}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${
                    colors[per.rol] || "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {per.rol === "relevante" ? "groups" : "shield_person"}
                  </span>
                  <div>
                    <p className="text-[8px] font-black uppercase opacity-60">
                      {ROL_LABELS[per.rol as keyof typeof ROL_LABELS] || per.rol}
                    </p>
                    <p className="text-[11px] font-black leading-tight">
                      {v?.nombre || per.vigilanteId}
                    </p>
                  </div>
                </div>
              );
            })}
          <button
            onClick={() => setShowPersonalModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-dashed border-slate-300 text-slate-400 hover:border-primary/40 hover:text-primary transition-colors text-[10px] font-black uppercase"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Editar Personal
          </button>
        </div>
      )}

      {/* ── BARRA DE PERSONALIZACIÓN ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 rounded-[30px] border border-white/5 shadow-2xl mb-8 animate-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-2 px-4 border-r border-white/10 shrink-0">
          <span className="material-symbols-outlined text-indigo-400 text-[20px]">magic_button</span>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            Personalizar Tablero
          </span>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => {
              const nombre = prompt("Nombre de la plantilla:");
              if (nombre)
                guardarComoPlantilla(prog.id, nombre, nombrePuesto, currentUser);
            }}
            className="px-4 py-2 bg-white/5 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border border-white/5"
          >
            <span className="material-symbols-outlined text-[16px]">save</span> Guardar Patrón
          </button>

          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-4 py-2 ${
                showTemplates ? "bg-indigo-600" : "bg-white/5 hover:bg-white/10"
              } text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border border-white/10`}
            >
              <span className="material-symbols-outlined text-[16px]">
                auto_awesome_motion
              </span>{" "}
              Cargar Plantilla
              {templates.length > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-400 rounded-full text-[7px]">
                  {templates.length}
                </span>
              )}
            </button>

            {showTemplates && (
              <div className="absolute top-full left-0 mt-3 w-64 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[100] p-4 animate-in zoom-in-95 duration-200">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">
                  Plantillas Disponibles
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {templates.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic px-2 py-4 text-center">
                      No hay plantillas guardadas
                    </p>
                  ) : (
                    templates.map((tpl: any) => (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          if (
                            confirm(
                              `¿Aplicar plantilla "${tpl.nombre}"? Se sobreescribirán las asignaciones.`
                            )
                          ) {
                            aplicarPlantilla(tpl.id, puestoId, anio, mes, currentUser);
                            setShowTemplates(false);
                            showTacticalToast({
                              title: "✅ Plantilla Aplicada",
                              message: tpl.nombre,
                              type: "success",
                            });
                          }
                        }}
                        className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-indigo-500 transition-all flex items-center justify-between group"
                      >
                        <span className="text-[11px] font-bold text-white uppercase">
                          {tpl.nombre}
                        </span>
                        <span className="material-symbols-outlined text-[14px] text-white/30 group-hover:text-white">
                          file_download
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Estado de sync */}
        <div className="ml-auto hidden lg:flex items-center gap-3 pr-4">
          {prog.syncStatus === "synced" && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Sincronizado
              </span>
            </div>
          )}
          {prog.syncStatus === "pending" && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black text-amber-400/60 uppercase tracking-widest">
                Pendiente de Sync
              </span>
            </div>
          )}
          {prog.syncStatus === "error" && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-red-500" />
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                Error de Sync
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── GRILLA PRINCIPAL ────────────────────────────────────────────── */}
      <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto p-8 custom-scrollbar">
          <table className="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-white min-w-[200px] text-left p-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">
                    Personal / Días
                  </span>
                </th>
                {daysArr.map((d) => {
                  const date = new Date(anio, mes, d);
                  const dow = date.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th
                      key={d}
                      className={`min-w-[72px] text-center p-2 ${
                        isWeekend ? "bg-slate-50/80" : ""
                      }`}
                    >
                      <span
                        className={`text-[10px] font-black ${
                          isWeekend ? "text-primary/60" : "text-slate-400"
                        }`}
                      >
                        {d}
                      </span>
                      {isWeekend && (
                        <div className="text-[7px] text-primary/40 font-black uppercase">
                          {dow === 0 ? "DOM" : "SAB"}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {turnosConfig.map((tConf, tIdx) => {
                const rol = (
                  tIdx === 0 ? "titular_a" : tIdx === 1 ? "titular_b" : "relevante"
                ) as any;
                return (
                  <tr key={tConf.id}>
                    <td className="sticky left-0 z-10 bg-white/95 backdrop-blur px-4 py-3 border-r border-slate-50">
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-8 rounded-xl flex items-center justify-center text-white ${
                            tIdx === 0
                              ? "bg-primary"
                              : tIdx === 1
                              ? "bg-indigo-600"
                              : "bg-slate-600"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {tIdx < 2 ? "person" : "groups"}
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 leading-tight uppercase">
                            {tIdx >= 2 ? "DISPONIBLE" : tConf.nombre}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400">
                            {ROL_LABELS[rol as keyof typeof ROL_LABELS] || rol}
                          </p>
                        </div>
                      </div>
                    </td>
                    {daysArr.map((d) => {
                      const asig = prog.asignaciones.find(
                        (a) => a.dia === d && a.turno === tConf.id
                      );
                      const date = new Date(anio, mes, d);
                      const isWeekend =
                        date.getDay() === 0 || date.getDay() === 6;

                      if (asig && asig.vigilanteId && asig.jornada !== "sin_asignar") {
                        const vigNombre = vigilanteMap.get(asig.vigilanteId);
                        return (
                          <td key={d} className="p-0.5">
                            <CeldaCalendario
                              asig={asig}
                              vigilanteNombre={vigNombre}
                              onEdit={() =>
                                setEditCell({ asig, progId: prog.id })
                              }
                              jornadasCustom={jornadasCustom}
                              turnosConfig={turnosConfig}
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={d} className="p-0.5">
                          <CeldaVacia
                            isWeekend={isWeekend}
                            onAdd={() =>
                              setEditCell({
                                asig: {
                                  dia: d,
                                  turno: tConf.id as TurnoHora,
                                  rol,
                                  jornada: "sin_asignar",
                                  vigilanteId: null,
                                } as AsignacionDia,
                                progId: prog.id,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PANEL DE COORDINACIÓN ───────────────────────────────────────── */}
      <CoordinationPanel
        currentProg={prog}
        freshCProg={freshCProg || null}
        compareVigilanteId={compareVigilanteId}
        setCompareVigilanteId={setCompareVigilanteId}
        showEntireStaff={showEntireStaff}
        setShowEntireStaff={setShowEntireStaff}
        daysArr={daysArr}
        onOpenEdit={(data) => setEditCell(data)}
        hideBusyGuards={hideBusyGuards}
        setHideBusyGuards={setHideBusyGuards}
        compareProgId={compareProgId}
        setCompareProgId={setCompareProgId}
      />

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {showPersonalModal && (
        <GestionPersonalModal
          prog={prog}
          puestoNombre={nombrePuesto}
          onClose={() => setShowPersonalModal(false)}
          onSave={handleSavePersonal}
        />
      )}

      {editCell && (
        <EditCeldaModal
          asig={editCell.asig}
          vigilantes={vigilantes}
          titularesId={titularesId}
          ocupados={ocupadosMap}
          turnosConfig={turnosConfig}
          jornadasCustom={jornadasCustom}
          initialVigilanteId={editCell.preSelectVigilanteId}
          onClose={() => setEditCell(null)}
          onSave={(data) => {
            const user = useAuthStore.getState().username || "Operador";
            const result = actualizarAsignacion(
              editCell.progId,
              editCell.asig.dia,
              data,
              user
            );
            if (result?.tipo === "bloqueo") {
              showTacticalToast({
                title: "⚠️ Conflicto",
                message: result.mensaje,
                type: "warning",
                duration: 5000,
              });
            } else {
              showTacticalToast({
                title: "✅ Guardado",
                message: "Asignación registrada correctamente.",
                type: "success",
              });
            }
            setEditCell(null);
          }}
        />
      )}
    </div>
  );
};

// ─── Vista Principal ──────────────────────────────────────────────────────────
const GestionPuestos = () => {
  const puestos = usePuestoStore((s) => s.puestos || []);
  const loaded = useProgramacionStore((s) => s.loaded);
  const isSyncing = useProgramacionStore((s) => s.isSyncing);
  const fetchProgramacionesByMonth = useProgramacionStore(
    (s) => s.fetchProgramacionesByMonth
  );
  const _fetchBatchDetails = useProgramacionStore((s) => s._fetchDetails);

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [busqueda, setBusqueda] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [puestoSeleccionado, setPuestoSeleccionado] = useState<{
    id: string;
    nombre: string;
  } | null>(null);

  useEffect(() => {
    fetchProgramacionesByMonth(anio, mes);
  }, [anio, mes, fetchProgramacionesByMonth]);

  const filteredPuestos = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return puestos;
    return puestos.filter(
      (p) =>
        p?.nombre?.toLowerCase().includes(q) ||
        p?.id?.toLowerCase().includes(q)
    );
  }, [puestos, busqueda]);

  const pagedPuestos = useMemo(() => {
    try {
      return filteredPuestos.slice(0, visibleCount);
    } catch {
      return [];
    }
  }, [filteredPuestos, visibleCount]);

  // Hydration Observer
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      try {
        const programaciones = useProgramacionStore.getState().programaciones;
        const needs = pagedPuestos
          .filter((p) => {
            if (!p) return false;
            const targetId = p.dbId || p.id;
            const found = programaciones.find(
              (pr) =>
                pr.puestoId === targetId &&
                pr.anio === anio &&
                pr.mes === mes
            );
            return found && !found.isDetailLoaded && !found.isFetching;
          })
          .map((p) => {
            const targetId = p.dbId || p.id;
            return programaciones.find(
              (pr) =>
                pr.puestoId === targetId &&
                pr.anio === anio &&
                pr.mes === mes
            )!;
          })
          .filter(Boolean);

        if (needs.length > 0) {
          _fetchBatchDetails(needs, needs.map((n) => n.id));
        }
      } catch (err) {
        console.error("[Coraza] ❌ Error en Hydration Observer:", err);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [pagedPuestos, anio, mes, loaded, _fetchBatchDetails]);

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
    <div className="pb-24 space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            Gestión <span className="text-primary">Puestos Activos</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.25em]">
            {filteredPuestos.length === 0
              ? "Sin objetivos"
              : `${filteredPuestos.length} objetivos tácticos`}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="h-10 px-4 bg-slate-50 border-none rounded-xl text-[11px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 transition-colors"
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
            className="h-10 w-24 px-4 bg-slate-50 border-none rounded-xl text-[11px] font-black outline-none"
          />
        </div>
      </header>

      <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm flex gap-4 items-center">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por nombre, código o ID de puesto..."
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-primary/20 transition-all"
          />
        </div>
        {isSyncing && (
          <div className="hidden sm:flex px-4 py-2 bg-primary/10 rounded-full animate-pulse border border-primary/20">
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">
              Sincronizando...
            </span>
          </div>
        )}
      </div>

      {filteredPuestos.length === 0 && !isSyncing ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-dashed border-slate-200">
          <span className="material-symbols-outlined text-[48px] text-slate-200 mb-4">
            inventory_2
          </span>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
            No se encontraron puestos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pagedPuestos.map((p, idx) => {
            if (!p) return null;
            return (
              <PuestoCard
                key={p.id || `puesto-${idx}`}
                puesto={p}
                anio={anio}
                mes={mes}
                onClick={() =>
                  setPuestoSeleccionado({ id: p.dbId || p.id, nombre: p.nombre })
                }
              />
            );
          })}
        </div>
      )}

      {visibleCount < filteredPuestos.length && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => setVisibleCount((v) => v + 60)}
            className="px-12 py-4 bg-slate-900 text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/10"
          >
            Expandir Cuadro Operativo (+60)
          </button>
        </div>
      )}
    </div>
  );
};

export default GestionPuestos;