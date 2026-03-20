import { useState, useMemo } from 'react';
import { usePuestoStore } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import { useProgramacionStore, type ProgramacionMensual } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';
import { showTacticalToast } from '../utils/tacticalToast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Config ────────────────────────────────────────────────────────────────────

const PUESTO_COLORS: [number, number, number][] = [
    [67, 24, 255],   // Primary purple
    [0, 179, 119],   // Green
    [220, 38, 38],   // Red
    [245, 158, 11],  // Amber
    [14, 165, 233],  // Blue
    [139, 92, 246],  // Violet
    [249, 115, 22],  // Orange
    [20, 184, 166],  // Teal
    [219, 39, 119],  // Pink
    [132, 204, 22],  // Lime
];

const MONTH_NAMES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

// ── Jornada display labels ─────────────────────────────────────────────────────
const JORNADA_SHORT: Record<string, string> = {
    'normal':                'N',
    'descanso_remunerado':   'DR',
    'descanso_no_remunerado':'DNR',
    'vacacion':              'VAC',
    'sin_asignar':           '-',
    'AM':                    'D',
    'PM':                    'N',
    '24H':                   '24',
};

const JORNADA_COLORS_PDF: Record<string, [number, number, number]> = {
    'normal':                [67, 24, 255],
    'descanso_remunerado':   [0, 179, 119],
    'descanso_no_remunerado':[255, 149, 0],
    'vacacion':              [139, 92, 246],
    'sin_asignar':           [229, 229, 229],
    'AM':                    [67, 24, 255],
    'PM':                    [11, 20, 65],
    '24H':                   [0, 150, 136],
};

// ── Component ─────────────────────────────────────────────────────────────────

const Resumen = () => {
    const puestos = usePuestoStore(s => s.puestos);
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const programaciones = useProgramacionStore(s => s.programaciones);
    const getCobertura24Horas = usePuestoStore(s => s.getCobertura24Horas);
    const logAction = useAuditStore(s => s.logAction);

    const now = new Date();
    const [filterPuesto, setFilterPuesto] = useState('todos');
    const [filterEstado, setFilterEstado] = useState('todos');
    const [scheduleYear, setScheduleYear] = useState(now.getFullYear());
    const [scheduleMonth, setScheduleMonth] = useState(now.getMonth());
    const [isGenerating, setIsGenerating] = useState(false);
    const [generated, setGenerated] = useState(false);

    const daysInMonth = new Date(scheduleYear, scheduleMonth + 1, 0).getDate();
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // ── Build Summary data using programacionStore ────────────────────────────
    const resumenData = useMemo(() => {
        return puestos.map((p, idx) => {
            const cobertura = getCobertura24Horas(p.id);

            // Find the programacion for this puesto in the selected month
            const prog = programaciones.find(pr =>
                (pr.puestoId === p.id || pr.puestoId === p.dbId) &&
                pr.anio === scheduleYear &&
                pr.mes === scheduleMonth
            );

            // Build rows: one per vigilante assigned in the personal list
            const rows = (prog?.personal || [])
                .filter(per => per.vigilanteId)
                .map(per => {
                    const vig = vigilantes.find(v =>
                        v.id === per.vigilanteId || v.dbId === per.vigilanteId
                    );
                    // Get asignaciones for this vigilante, sorted by day
                    const asigs = (prog?.asignaciones || [])
                        .filter(a =>
                            a.vigilanteId === per.vigilanteId ||
                            a.vigilanteId === vig?.dbId
                        )
                        .sort((a, b) => a.dia - b.dia);
                    return {
                        rol: per.rol,
                        vigilanteId: per.vigilanteId,
                        nombre: vig?.nombre || 'Sin nombre',
                        cedula: vig?.cedula || '-',
                        rango: vig?.rango || '-',
                        asigs,
                    };
                });

            return {
                id: p.id,
                nombre: p.nombre,
                direccion: p.direccion,
                estado: p.estado,
                colorIdx: idx,
                coberturaCompleta: cobertura.completa,
                horasDescubiertas: cobertura.huecos,
                prog,
                rows,
                turnosLegacy: p.turnos || [],
            };
        });
    }, [puestos, vigilantes, programaciones, scheduleYear, scheduleMonth, getCobertura24Horas]);

    const filteredData = useMemo(() => {
        let data = resumenData;
        if (filterPuesto !== 'todos') data = data.filter(p => p.id === filterPuesto);
        if (filterEstado !== 'todos') data = data.filter(p => p.estado === filterEstado);
        return data;
    }, [resumenData, filterPuesto, filterEstado]);

    const stats = useMemo(() => ({
        total: puestos.length,
        cubiertos: resumenData.filter(p => p.coberturaCompleta).length,
        sinCobertura: resumenData.filter(p => !p.coberturaCompleta).length,
        totalVigilantesDesplegados: resumenData.reduce((acc, p) => acc + p.rows.length, 0),
    }), [puestos, resumenData]);

    // ── Load logo as base64 ───────────────────────────────────────────────────
    const getBase64Image = (url: string): Promise<string> =>
        new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }
                else reject();
            };
            img.onerror = reject;
            img.src = url;
        });

    // ── PDF Generation ────────────────────────────────────────────────────────
    const generateSchedulePDF = async () => {
        setIsGenerating(true);
        logAction('RESUMEN', 'Generacion de PDF', `CUADRO OPERATIVO ${MONTH_NAMES[scheduleMonth]} ${scheduleYear}`, 'info');

        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const fecha = now.toLocaleDateString('es-CO', { dateStyle: 'long' });
            const logoBase64 = await getBase64Image('/logo.png').catch(() => null);

            const addLogo = (x: number, y: number, w: number, h: number) => {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(x, y, w, h, 2, 2, 'F');
                if (logoBase64) {
                    try { doc.addImage(logoBase64, 'PNG', x + 1, y + 1, w - 2, h - 2); }
                    catch { /* silent */ }
                }
            };

            filteredData.forEach((puesto, puestoIdx) => {
                if (puestoIdx > 0) doc.addPage();
                const pColor = PUESTO_COLORS[puesto.colorIdx % PUESTO_COLORS.length];

                // ── Dark header bar ──────────────────────────────────────────
                doc.setFillColor(11, 20, 65);
                doc.rect(0, 0, pageW, 36, 'F');

                addLogo(8, 4, 28, 28);

                // Title
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('CUADRO OPERATIVO DE PROGRAMACION', pageW / 2, 11, { align: 'center' });

                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(180, 200, 255);
                doc.text('CORAZA SEGURIDAD PRIVADA CTA', pageW / 2, 16, { align: 'center' });

                // Month badge
                doc.setFillColor(...pColor);
                doc.roundedRect(pageW / 2 - 30, 18, 60, 8, 2, 2, 'F');
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(`${MONTH_NAMES[scheduleMonth].toUpperCase()} ${scheduleYear}`, pageW / 2, 23.5, { align: 'center' });

                // Right info
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(180, 200, 255);
                doc.text(`PUESTO:`, pageW - 70, 12);
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.text(puesto.nombre, pageW - 55, 12);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(180, 200, 255);
                doc.text(`DIRECCION:`, pageW - 70, 17);
                doc.setTextColor(255, 255, 255);
                doc.text((puesto.direccion || 'N/A').slice(0, 35), pageW - 52, 17);

                doc.setTextColor(180, 200, 255);
                doc.text(`FECHA:`, pageW - 70, 22);
                doc.setTextColor(255, 255, 255);
                doc.text(fecha, pageW - 57, 22);

                doc.setTextColor(180, 200, 255);
                doc.text(`PAG:`, pageW - 70, 30);
                doc.setTextColor(255, 255, 255);
                doc.text(`${puestoIdx + 1} / ${filteredData.length}`, pageW - 61, 30);

                // ── Column setup ─────────────────────────────────────────────
                const tableY = 39;
                const MARGIN = 8;
                const COL_ROL    = 16;
                const COL_CED    = 24;
                const COL_NOMBRE = 48;
                const fixedW = MARGIN + COL_ROL + COL_CED + COL_NOMBRE;
                const availW = pageW - fixedW - MARGIN;
                const COL_DAY = Math.max(3.5, availW / daysInMonth);

                // Header row
                const headerH = 7;
                doc.setFillColor(...pColor);
                doc.rect(MARGIN, tableY, pageW - MARGIN * 2, headerH, 'F');
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);

                doc.text('ROL', MARGIN + COL_ROL / 2, tableY + 4.8, { align: 'center' });
                doc.text('CEDULA', MARGIN + COL_ROL + COL_CED / 2, tableY + 4.8, { align: 'center' });
                doc.text('APELLIDOS Y NOMBRES', MARGIN + COL_ROL + COL_CED + COL_NOMBRE / 2, tableY + 4.8, { align: 'center' });

                let xDay = fixedW;
                dayNumbers.forEach(d => {
                    doc.text(String(d).padStart(2, '0'), xDay + COL_DAY / 2, tableY + 4.8, { align: 'center' });
                    xDay += COL_DAY;
                });

                // ── Data rows ─────────────────────────────────────────────────
                const ROW_H = 9;
                let yRow = tableY + headerH;

                if (puesto.rows.length === 0) {
                    // No programacion data - try legacy turnos as fallback
                    if (puesto.turnosLegacy.length > 0) {
                        puesto.turnosLegacy.forEach((t, ti) => {
                            const vig = vigilantes.find(v => v.id === t.vigilanteId);
                            const bgColor: [number,number,number] = ti % 2 === 0 ? [245, 247, 255] : [255, 255, 255];
                            doc.setFillColor(...bgColor);
                            doc.rect(MARGIN, yRow, pageW - MARGIN * 2, ROW_H, 'F');

                            doc.setFontSize(6);
                            doc.setFont('helvetica', 'normal');
                            doc.setTextColor(30, 30, 60);
                            doc.text('Titular', MARGIN + COL_ROL / 2, yRow + 6, { align: 'center' });
                            doc.text(vig?.cedula || '-', MARGIN + COL_ROL + COL_CED / 2, yRow + 6, { align: 'center' });
                            doc.text((vig?.nombre || 'Sin nombre').toUpperCase(), MARGIN + COL_ROL + COL_CED + 2, yRow + 6);

                            const turnoKey = t.horaInicio >= '06:00' && t.horaInicio < '18:00' ? 'AM' : 'PM';
                            const cellColor: [number,number,number] = turnoKey === 'AM' ? pColor : [11, 20, 65];
                            let xD = fixedW;
                            dayNumbers.forEach(() => {
                                doc.setFillColor(...cellColor);
                                doc.rect(xD + 0.3, yRow + 1.5, COL_DAY - 0.6, ROW_H - 3, 'F');
                                doc.setTextColor(255, 255, 255);
                                doc.setFontSize(5);
                                doc.text(turnoKey === 'AM' ? 'D12' : 'N12', xD + COL_DAY / 2, yRow + 6, { align: 'center' });
                                xD += COL_DAY;
                            });
                            doc.setTextColor(30, 30, 60);
                            yRow += ROW_H;
                        });
                    } else {
                        doc.setFillColor(255, 240, 240);
                        doc.rect(MARGIN, yRow, pageW - MARGIN * 2, ROW_H, 'F');
                        doc.setTextColor(200, 80, 80);
                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'italic');
                        doc.text('Sin personal asignado para este periodo operativo', MARGIN + 4, yRow + 6);
                        yRow += ROW_H;
                    }
                } else {
                    // ── Sort rows: titular_a first, then titular_b, then relevante ──
                    const ROL_ORDER: Record<string, number> = { 'titular_a': 0, 'titular_b': 1, 'relevante': 2 };
                    const sortedRows = [...puesto.rows].sort((a, b) =>
                        (ROL_ORDER[a.rol] ?? 99) - (ROL_ORDER[b.rol] ?? 99)
                    );

                    const ROL_LABELS: Record<string, string> = {
                        'titular_a': 'TIT-A',
                        'titular_b': 'TIT-B',
                        'relevante': 'REL',
                    };

                    sortedRows.forEach((row, ri) => {
                        // Check if new page needed
                        if (yRow + ROW_H > pageH - 22) {
                            doc.addPage();
                            // Re-draw minimal header on continuation page
                            doc.setFillColor(11, 20, 65);
                            doc.rect(0, 0, pageW, 10, 'F');
                            doc.setFontSize(7);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(255, 255, 255);
                            doc.text(`${puesto.nombre} — ${MONTH_NAMES[scheduleMonth]} ${scheduleYear} (CONTINUACION)`, MARGIN, 7);
                            yRow = 14;

                            // Re-draw column headers
                            doc.setFillColor(...pColor);
                            doc.rect(MARGIN, yRow, pageW - MARGIN * 2, headerH, 'F');
                            doc.setFontSize(5.5);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(255, 255, 255);
                            doc.text('ROL', MARGIN + COL_ROL / 2, yRow + 4.8, { align: 'center' });
                            doc.text('CEDULA', MARGIN + COL_ROL + COL_CED / 2, yRow + 4.8, { align: 'center' });
                            doc.text('APELLIDOS Y NOMBRES', MARGIN + COL_ROL + COL_CED + COL_NOMBRE / 2, yRow + 4.8, { align: 'center' });
                            let xDh = fixedW;
                            dayNumbers.forEach(d => {
                                doc.text(String(d).padStart(2, '0'), xDh + COL_DAY / 2, yRow + 4.8, { align: 'center' });
                                xDh += COL_DAY;
                            });
                            yRow += headerH;
                        }

                        const bgColor: [number,number,number] = ri % 2 === 0 ? [246, 248, 255] : [255, 255, 255];
                        doc.setFillColor(...bgColor);
                        doc.rect(MARGIN, yRow, pageW - MARGIN * 2, ROW_H, 'F');

                        doc.setFontSize(5.5);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(67, 24, 255);
                        doc.text(ROL_LABELS[row.rol] || row.rol, MARGIN + COL_ROL / 2, yRow + 6, { align: 'center' });

                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(30, 30, 60);
                        doc.text(row.cedula, MARGIN + COL_ROL + COL_CED / 2, yRow + 6, { align: 'center' });
                        doc.text(row.nombre.toUpperCase().slice(0, 28), MARGIN + COL_ROL + COL_CED + 2, yRow + 6);

                        // Day cells — use asignacion data per day
                        let xD = fixedW;
                        dayNumbers.forEach(d => {
                            const asig = row.asigs.find(a => a.dia === d);
                            const jornada = asig?.jornada || 'sin_asignar';
                            const turno = asig?.turno || '-';
                            const hasData = asig && asig.vigilanteId && jornada !== 'sin_asignar';

                            if (hasData) {
                                const cellRgb = JORNADA_COLORS_PDF[jornada] || JORNADA_COLORS_PDF[turno] || [200, 200, 200];
                                doc.setFillColor(...cellRgb);
                                doc.rect(xD + 0.3, yRow + 1.5, COL_DAY - 0.6, ROW_H - 3, 'F');
                                doc.setTextColor(255, 255, 255);
                                doc.setFontSize(4.5);
                                doc.setFont('helvetica', 'bold');
                                const label = JORNADA_SHORT[jornada] || JORNADA_SHORT[turno] || turno.slice(0, 3);
                                doc.text(label, xD + COL_DAY / 2, yRow + 6, { align: 'center' });
                            } else {
                                doc.setFillColor(245, 245, 245);
                                doc.rect(xD + 0.3, yRow + 1.5, COL_DAY - 0.6, ROW_H - 3, 'F');
                                doc.setTextColor(200, 200, 200);
                                doc.setFontSize(4);
                                doc.text('-', xD + COL_DAY / 2, yRow + 6, { align: 'center' });
                            }
                            xD += COL_DAY;
                        });

                        doc.setTextColor(30, 30, 60);
                        yRow += ROW_H;
                    });
                }

                // ── Separator line ───────────────────────────────────────────
                doc.setDrawColor(...pColor);
                doc.setLineWidth(0.4);
                doc.line(MARGIN, yRow + 2, pageW - MARGIN, yRow + 2);

                // ── Legend ───────────────────────────────────────────────────
                const legendY = pageH - 20;
                doc.setFontSize(6);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 80);
                doc.text('LEYENDA:', MARGIN, legendY - 1);

                const legendItems: [string, string, [number, number, number]][] = [
                    ['N',   'Normal',              [67, 24, 255]],
                    ['DR',  'Desc. Remunerado',    [0, 179, 119]],
                    ['DNR', 'Desc. No Rem.',        [255, 149, 0]],
                    ['VAC', 'Vacacion',             [139, 92, 246]],
                    ['-',   'Sin Asignar',          [229, 229, 229]],
                ];

                let xLeg = MARGIN + 20;
                legendItems.forEach(([code, label, color]) => {
                    doc.setFillColor(...color);
                    doc.rect(xLeg, legendY - 4, 8, 5.5, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(5);
                    doc.text(code, xLeg + 4, legendY - 0.5, { align: 'center' });
                    doc.setTextColor(60, 60, 80);
                    doc.setFontSize(5.5);
                    doc.text(label, xLeg + 10, legendY - 0.5);
                    xLeg += 44;
                });

                // ── Footer ───────────────────────────────────────────────────
                doc.setFontSize(6);
                doc.setTextColor(160, 160, 180);
                doc.text(
                    `CORAZA SEGURIDAD CTA — ${MONTH_NAMES[scheduleMonth]} ${scheduleYear} — Tel: 311 3836939 — Pagina ${puestoIdx + 1} de ${filteredData.length}`,
                    pageW / 2, pageH - 5, { align: 'center' }
                );
            });

            doc.save(`CORAZA_Programacion_${MONTH_NAMES[scheduleMonth]}_${scheduleYear}.pdf`);
            showTacticalToast({
                title: 'PDF Generado',
                message: `Cuadro Operativo de ${MONTH_NAMES[scheduleMonth]} ${scheduleYear} descargado correctamente.`,
                type: 'success'
            });
            setGenerated(true);
            setTimeout(() => setGenerated(false), 4000);
        } catch (error) {
            console.error('PDF Error:', error);
            showTacticalToast({ title: 'Error de Exportacion', message: 'No se pudo generar el PDF.', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <div className="page-container animate-in fade-in duration-500 pb-24">

            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 px-2">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="size-2 bg-primary animate-pulse rounded-full shadow-[0_0_10px_rgba(67,24,255,0.5)]" />
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Centro de Reportes</p>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                        Resumen <span className="text-primary">Programado</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Cuadro operativo de vigilantes por puesto — Exportable en PDF</p>
                </div>
                <button
                    id="btn-exportar-pdf"
                    onClick={generateSchedulePDF}
                    disabled={isGenerating || filteredData.length === 0}
                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all active:scale-95 shadow-xl ${
                        generated ? 'bg-success text-white shadow-success/30' :
                        'bg-primary text-white shadow-primary/30 hover:brightness-110'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isGenerating ? (
                        <><span className="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>Generando PDF...</>
                    ) : generated ? (
                        <><span className="material-symbols-outlined text-[22px]">check_circle</span>PDF Descargado</>
                    ) : (
                        <><span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>Descargar Cuadro Operativo</>
                    )}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Puestos', value: stats.total, icon: 'hub', color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Con Cobertura 24h', value: stats.cubiertos, icon: 'verified', color: 'text-success', bg: 'bg-success/10' },
                    { label: 'Sin Cobertura', value: stats.sinCobertura, icon: 'warning', color: 'text-warning', bg: 'bg-warning/10' },
                    { label: 'Total Desplegados', value: stats.totalVigilantesDesplegados, icon: 'local_police', color: 'text-slate-700', bg: 'bg-slate-50' },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                        <div className={`${s.bg} size-10 rounded-2xl flex items-center justify-center mb-3`}>
                            <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                        </div>
                        <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm mb-6 space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">tune</span>
                    Filtros de Exportacion
                </h3>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Puesto:</label>
                        <select value={filterPuesto} onChange={e => setFilterPuesto(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30">
                            <option value="todos">Todos</option>
                            {puestos.map(p => <option key={p.id} value={p.id}>{p.id} - {p.nombre}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado:</label>
                        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30">
                            <option value="todos">Todos</option>
                            <option value="cubierto">Cubierto</option>
                            <option value="alerta">En Alerta</option>
                            <option value="desprotegido">Desprotegido</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mes / Año:</label>
                        <select value={scheduleMonth} onChange={e => setScheduleMonth(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30">
                            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <input type="number" value={scheduleYear} onChange={e => setScheduleYear(Number(e.target.value))}
                            min={2024} max={2030}
                            className="w-24 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30" />
                    </div>
                </div>
            </div>

            {/* Preview Grid */}
            <div className="space-y-6">
                {filteredData.length === 0 ? (
                    <div className="text-center py-24 text-slate-300">
                        <span className="material-symbols-outlined text-5xl">plagiarism</span>
                        <p className="mt-4 text-[11px] font-black uppercase tracking-widest">Sin datos para mostrar</p>
                    </div>
                ) : filteredData.map((p, idx) => {
                    const pColor = PUESTO_COLORS[p.colorIdx % PUESTO_COLORS.length];
                    const pColorStr = `rgb(${pColor[0]},${pColor[1]},${pColor[2]})`;
                    const ROL_ORDER: Record<string, number> = { 'titular_a': 0, 'titular_b': 1, 'relevante': 2 };
                    const sortedRows = [...p.rows].sort((a, b) => (ROL_ORDER[a.rol] ?? 99) - (ROL_ORDER[b.rol] ?? 99));

                    return (
                        <div key={p.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                            {/* Puesto header */}
                            <div className="px-6 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${pColorStr}15 0%, transparent 100%)`, borderBottom: `2px solid ${pColorStr}30` }}>
                                <div className="flex items-center gap-4">
                                    <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: `${pColorStr}20` }}>
                                        <span className="material-symbols-outlined" style={{ color: pColorStr }}>hub</span>
                                    </div>
                                    <div>
                                        <span className="font-mono text-[10px] font-bold" style={{ color: pColorStr }}>{p.id}</span>
                                        <h4 className="text-base font-bold text-slate-900">{p.nombre}</h4>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {p.prog ? (
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                                            p.prog.estado === 'publicado'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                            {p.prog.estado === 'publicado' ? '✓ Publicado' : '⏳ Borrador'}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                                            Sin Programacion
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${p.coberturaCompleta ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                        {p.coberturaCompleta ? '24H OK' : 'Con huecos'}
                                    </span>
                                </div>
                            </div>

                            {/* Schedule Grid */}
                            <div className="overflow-x-auto p-4">
                                <table className="text-[10px] w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="text-left px-2 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 uppercase tracking-wider w-14">Rol</th>
                                            <th className="text-left px-2 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 uppercase tracking-wider w-24">Cedula</th>
                                            <th className="text-left px-2 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 uppercase tracking-wider w-44">Vigilante</th>
                                            {dayNumbers.map(d => (
                                                <th key={d} className="px-0.5 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 text-center" style={{ minWidth: '28px' }}>{d}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={3 + daysInMonth} className="px-4 py-6 text-center text-warning font-bold bg-orange-50 border border-slate-100">
                                                    Sin vigilantes asignados en este mes
                                                </td>
                                            </tr>
                                        ) : sortedRows.map((row, ri) => (
                                            <tr key={row.vigilanteId} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                <td className="px-2 py-2 border border-slate-100">
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: pColorStr + '20', color: pColorStr }}>
                                                        {row.rol === 'titular_a' ? 'TIT-A' : row.rol === 'titular_b' ? 'TIT-B' : 'REL'}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2 border border-slate-100 font-mono text-[10px] text-slate-500">{row.cedula}</td>
                                                <td className="px-2 py-2 border border-slate-100 font-bold text-slate-900">{row.nombre}</td>
                                                {dayNumbers.map(d => {
                                                    const asig = row.asigs.find(a => a.dia === d);
                                                    const jornada = asig?.jornada ?? 'sin_asignar';
                                                    const hasData = asig?.vigilanteId && jornada !== 'sin_asignar';
                                                    const bgColor = hasData
                                                        ? `rgb(${(JORNADA_COLORS_PDF[jornada] || pColor).join(',')})`
                                                        : '#f5f5f5';
                                                    const label = hasData ? (JORNADA_SHORT[jornada] || '-') : '';
                                                    return (
                                                        <td key={d} className="border border-slate-100 text-center p-0">
                                                            <div className="px-0.5 py-1" style={{ background: bgColor }}>
                                                                <span className="text-[8px] font-black" style={{ color: hasData ? 'white' : '#ccc' }}>{label || '—'}</span>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Legend */}
                            <div className="px-6 pb-4 flex flex-wrap gap-3 items-center border-t border-slate-100 pt-3">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Leyenda:</span>
                                {[
                                    ['N', 'Normal', `rgb(${pColor.join(',')})`, '#fff'],
                                    ['DR', 'Desc. Rem.', '#00b377', '#fff'],
                                    ['DNR', 'Desc. N/Rem.', '#ff9500', '#fff'],
                                    ['VAC', 'Vacacion', '#8b5cf6', '#fff'],
                                ].map(([code, label, bg, fg]) => (
                                    <div key={code} className="flex items-center gap-1.5">
                                        <div className="px-2 py-0.5 rounded text-[9px] font-black" style={{ background: bg, color: fg }}>{code}</div>
                                        <span className="text-[9px] text-slate-500">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Resumen;
