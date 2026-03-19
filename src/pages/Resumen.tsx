import { useState, useMemo } from 'react';
import { usePuestoStore } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import { useAuditStore } from '../store/auditStore';
import { showTacticalToast } from '../utils/tacticalToast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Vivid colors for each puesto
const PUESTO_COLORS = [
    [67, 24, 255],   // Primary purple
    [0, 179, 119],   // Green
    [255, 77, 77],   // Red
    [255, 160, 0],   // Amber
    [0, 153, 255],   // Blue
    [180, 0, 255],   // Violet
    [255, 100, 50],  // Orange
    [0, 210, 180],   // Teal
    [220, 20, 100],  // Crimson
    [100, 200, 0],   // Lime
];

const SHIFT_ABBREVS: Record<string, string> = {
    'diurno': 'D12',
    'nocturno': 'N12',
    'disponible': 'Dis',
    'descanso': 'Des',
};

const getShiftAbbrev = (inicio: string, fin: string): string => {
    const [ih] = inicio.split(':').map(Number);
    const [fh] = fin.split(':').map(Number);
    const hours = fh > ih ? fh - ih : (24 - ih + fh);
    if (ih >= 6 && ih < 18) return `D${hours}`;
    return `N${hours}`;
};

const Resumen = () => {
    const puestos = usePuestoStore(s => s.puestos);
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const getCobertura24Horas = usePuestoStore(s => s.getCobertura24Horas);
    const logAction = useAuditStore(s => s.logAction);

    // Date filter for schedule
    const now = new Date();
    const [filterPuesto, setFilterPuesto] = useState('todos');
    const [filterEstado, setFilterEstado] = useState('todos');
    const [scheduleYear, setScheduleYear] = useState(now.getFullYear());
    const [scheduleMonth, setScheduleMonth] = useState(now.getMonth()); // 0-indexed
    const [isGenerating, setIsGenerating] = useState(false);
    const [generated, setGenerated] = useState(false);

    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const daysInMonth = new Date(scheduleYear, scheduleMonth + 1, 0).getDate();
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const resumenData = useMemo(() => {
        return puestos.map((p, idx) => {
            const cobertura = getCobertura24Horas(p.id);
            const turnosConNombres = (p.turnos || []).map(t => {
                const v = vigilantes.find(v => v.id === t.vigilanteId);
                return { ...t, nombre: v?.nombre || 'Sin nombre', cedula: v?.cedula || '-', rango: v?.rango || '-', color: PUESTO_COLORS[idx % PUESTO_COLORS.length] };
            });
            return { ...p, turnosDetalle: turnosConNombres, coberturaCompleta: cobertura.completa, horasDescubiertas: cobertura.huecos, colorIdx: idx };
        });
    }, [puestos, vigilantes, getCobertura24Horas]);

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
        totalVigilantesDesplegados: puestos.reduce((acc, p) => acc + (p.turnos?.length || 0), 0),
    }), [puestos, resumenData]);

    // ── PDF Generation: Schedule Grid Style ──────────────────────────────
    const generateSchedulePDF = async () => {
        setIsGenerating(true);
        logAction('RESUMEN', 'Generacion de PDF', `CUADRO OPERATIVO de ${monthNames[scheduleMonth]} ${scheduleYear} para ${filterPuesto === 'todos' ? 'todos los puestos' : filterPuesto}`, 'info');

        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const fecha = new Date().toLocaleDateString('es-CO', { dateStyle: 'long' });

            // ── Helper to convert image to Base64 (Reliable Rendering) ──
            const getBase64Image = (url: string): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } else reject();
                    };
                    img.onerror = reject;
                    img.src = url;
                });
            };

            const logoBase64 = await getBase64Image('/logo_premium.png').catch(() => null);

            // Helper to add logo
            const addLogo = (x: number, y: number, w: number, h: number) => {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(x, y, w, h, 3, 3, 'F');
                if (logoBase64) {
                    try {
                        doc.addImage(logoBase64, 'PNG', x + 1, y + 1, w - 2, h - 2);
                    } catch (e) { /* fallback below */ }
                } else {
                    doc.setFontSize(6);
                    doc.setTextColor(11, 20, 60);
                    doc.setFont('helvetica', 'bold');
                    doc.text('CORAZA', x + w/2, y + h/2 - 1, { align: 'center' });
                    doc.text('SEGURIDAD', x + w/2, y + h/2 + 2, { align: 'center' });
                }
            };

            filteredData.forEach((puesto, puestoIdx) => {
                if (puestoIdx > 0) doc.addPage();

                const pColor = PUESTO_COLORS[puesto.colorIdx % PUESTO_COLORS.length] as [number, number, number];

                // ── Header ─────────────────────────────────────────────────────
                doc.setFillColor(11, 20, 65);
                doc.rect(0, 0, pageW, 35, 'F');

                addLogo(8, 4, 27, 27);

                // Date info (Left side)
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(`MES OPERATIVO:`, 40, 15);
                doc.setFont('helvetica', 'normal');
                doc.text(`${monthNames[scheduleMonth].toUpperCase()} ${scheduleYear}`, 68, 15);

                // Info box (right side)
                const rightX = 145;
                const gap = 20;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('PROGRAMACION CORAZA SEGURIDAD CTA', rightX, 12);
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(180, 200, 255);
                doc.text(`PUESTO:`, rightX, 17);
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.text(puesto.nombre, rightX + gap, 17);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(180, 200, 255);
                doc.text(`DIRECCION:`, rightX, 22);
                doc.setTextColor(255, 255, 255);
                doc.text(puesto.direccion || 'CRA. 81 #49-24, CALASANZ, MEDELLIN', rightX + gap, 22);

                doc.setTextColor(180, 200, 255);
                doc.text(`TELEFONO:`, rightX, 27);
                doc.setTextColor(255, 255, 255);
                doc.text('3113836939', rightX + gap, 27);
                
                doc.setTextColor(255, 255, 255);
                doc.text(fecha, pageW - 8, 27, { align: 'right' });

                // ── Column Headers (days) ─────────────────────────────────────
                const tableStartY = 38;
                const colW_cedula = 22;
                const colW_nombre = 52;
                const colW_anio = 10;
                const colW_mes = 14;
                const fixedW = colW_cedula + colW_nombre + colW_anio + colW_mes + 8; // 8 = margin
                const availW = pageW - 16 - fixedW;
                const colW_day = Math.max(4, availW / daysInMonth);

                // Header row
                doc.setFillColor(...pColor);
                doc.rect(8, tableStartY, pageW - 16, 8, 'F');
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text('CEDULA', 8 + colW_cedula / 2, tableStartY + 5.5, { align: 'center' });
                doc.text('APELLIDOS Y NOMBRES', 8 + colW_cedula + colW_nombre / 2, tableStartY + 5.5, { align: 'center' });
                doc.text('ANO', 8 + colW_cedula + colW_nombre + colW_anio / 2, tableStartY + 5.5, { align: 'center' });
                doc.text('MES', 8 + colW_cedula + colW_nombre + colW_anio + colW_mes / 2, tableStartY + 5.5, { align: 'center' });

                let xDay = 8 + colW_cedula + colW_nombre + colW_anio + colW_mes;
                dayNumbers.forEach(d => {
                    doc.text(String(d).padStart(2, '0'), xDay + colW_day / 2, tableStartY + 5.5, { align: 'center' });
                    xDay += colW_day;
                });

                // ── Data Rows ─────────────────────────────────────────────────
                const rowH = 10;
                let yRow = tableStartY + 8;

                if (puesto.turnosDetalle.length === 0) {
                    doc.setFillColor(255, 240, 240);
                    doc.rect(8, yRow, pageW - 16, rowH, 'F');
                    doc.setTextColor(200, 80, 80);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'italic');
                    doc.text('⚠ Sin personal asignado para este periodo operativo', 14, yRow + 6.5);
                    yRow += rowH;
                } else {
                    puesto.turnosDetalle.forEach((t, tIdx) => {
                        const bgColor: [number, number, number] = tIdx % 2 === 0 ? [245, 247, 255] : [255, 255, 255];
                        doc.setFillColor(...bgColor);
                        doc.rect(8, yRow, pageW - 16, rowH, 'F');

                        doc.setTextColor(30, 30, 60);
                        doc.setFontSize(6.5);
                        doc.setFont('helvetica', 'normal');
                        doc.text(t.cedula || '-', 8 + colW_cedula / 2, yRow + 6.5, { align: 'center' });
                        doc.text(t.nombre.toUpperCase(), 8 + colW_cedula + 2, yRow + 6.5);
                        doc.text(String(scheduleYear), 8 + colW_cedula + colW_nombre + colW_anio / 2, yRow + 6.5, { align: 'center' });
                        doc.text(monthNames[scheduleMonth].substring(0, 3).toUpperCase(), 8 + colW_cedula + colW_nombre + colW_anio + colW_mes / 2, yRow + 6.5, { align: 'center' });

                        // Fill each day cell with shift code
                        const shiftCode = getShiftAbbrev(t.horaInicio, t.horaFin);
                        const isNight = shiftCode.startsWith('N');
                        const [sr, sg, sb] = isNight ? [11, 20, 60] : pColor;
                        
                        let xD = 8 + colW_cedula + colW_nombre + colW_anio + colW_mes;
                        dayNumbers.forEach(() => {
                            doc.setFillColor(sr, sg, sb);
                            doc.rect(xD + 0.5, yRow + 1.5, colW_day - 1, rowH - 3, 'F');
                            doc.setTextColor(255, 255, 255);
                            doc.setFontSize(5.5);
                            doc.setFont('helvetica', 'bold');
                            doc.text(shiftCode, xD + colW_day / 2, yRow + 6.5, { align: 'center' });
                            xD += colW_day;
                        });

                        doc.setTextColor(30, 30, 60); // reset
                        yRow += rowH;
                    });
                }

                // ── Legend ──────────────────────────────────────────────────
                const legendY = pageH - 22;
                const shifts: [string, string, [number, number, number]][] = [
                    ['D12', 'TURNO DIURNO 12H (06:00 - 18:00)', pColor],
                    ['N12', 'TURNO NOCTURNO 12H (18:00 - 06:00)', [11, 20, 60]],
                    ['Dis', 'DISPONIBLE / APOYO', [100, 120, 180]],
                    ['Des', 'DESCANSO PROGRAMADO', [180, 180, 180]],
                ];
                
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 80);
                doc.text('LEYENDA OPERATIVA:', 8, legendY - 2);

                let xLeg = 8;
                shifts.forEach(([code, label, color]) => {
                    doc.setFillColor(...color as [number, number, number]);
                    doc.rect(xLeg, legendY, 10, 6, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.text(code, xLeg + 5, legendY + 4.2, { align: 'center' });
                    doc.setTextColor(50, 50, 80);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6);
                    doc.text(label, xLeg + 12, legendY + 4);
                    xLeg += 68;
                });

                // Footer
                doc.setFontSize(7);
                doc.setTextColor(160, 160, 180);
                doc.text(
                    `CORAZA SEGURIDAD CTA - Cra. 81 #49-24, Medellin - Tel: 311 3836939 - PAGINA ${puestoIdx + 1} de ${filteredData.length}`,
                    pageW / 2,
                    pageH - 6,
                    { align: 'center' }
                );
            });

            doc.save(`CORAZA_Programacion_${monthNames[scheduleMonth]}_${scheduleYear}.pdf`);
            showTacticalToast({
                title: 'Exportacion Exitosa',
                message: `La programacion de ${monthNames[scheduleMonth]} ha sido generada correctamente.`,
                type: 'success'
            });
            setGenerated(true);
            setTimeout(() => setGenerated(false), 3000);
        } catch (error) {
            console.error('PDF Generation Error:', error);
            showTacticalToast({
                title: 'Error de Exportacion',
                message: 'No se pudo generar el archivo PDF. Verifique la integridad de los datos.',
                type: 'error'
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="page-container animate-in fade-in duration-500 pb-24">

            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 px-2">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="size-2 bg-primary animate-pulse rounded-full shadow-[0_0_10px_rgba(67,24,255,0.5)]" />
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Centro de Reportes</p>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                        Resumen <span className="text-primary">Programado</span>
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 font-medium">CUADRO OPERATIVO de vigilantes por puesto - Exportable en PDF</p>
                </div>
                <button
                    onClick={generateSchedulePDF}
                    disabled={isGenerating || filteredData.length === 0}
                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all active:scale-95 shadow-xl ${generated ? 'bg-success text-white shadow-success/30' : 'bg-primary text-white shadow-primary/30 hover:bg-primary/90'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isGenerating ? (
                        <><span className="material-symbols-outlined text-[22px] animate-spin notranslate">progress_activity</span>Generando PDF...</>
                    ) : generated ? (
                        <><span className="material-symbols-outlined text-[22px] notranslate">check_circle</span>PDF Descargado</>
                    ) : (
                        <><span className="material-symbols-outlined text-[22px] notranslate">picture_as_pdf</span>Descargar CUADRO OPERATIVO</>
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
                            <span className={`material-symbols-outlined ${s.color} notranslate`}>{s.icon}</span>
                        </div>
                        <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm mb-6 space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary notranslate">tune</span>
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

                    {/* Schedule period */}
                    <div className="flex items-center gap-2 ml-auto">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Periodo del PDF:</label>
                        <select value={scheduleMonth} onChange={e => setScheduleMonth(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30">
                            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <input type="number" value={scheduleYear} onChange={e => setScheduleYear(Number(e.target.value))}
                            min={2024} max={2030}
                            className="w-24 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary/30" />
                    </div>
                </div>
            </div>

            {/* Preview: Schedule Grid */}
            <div className="space-y-6">
                {filteredData.length === 0 ? (
                    <div className="text-center py-24 text-slate-300">
                        <span className="material-symbols-outlined text-5xl notranslate">plagiarism</span>
                        <p className="mt-4 text-[11px] font-black uppercase tracking-widest">Sin datos para mostrar</p>
                    </div>
                ) : (
                    filteredData.map((p, idx) => {
                        const pColor = PUESTO_COLORS[p.colorIdx % PUESTO_COLORS.length];
                        const pColorStr = `rgb(${pColor[0]},${pColor[1]},${pColor[2]})`;
                        return (
                            <div key={p.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                                {/* Post header */}
                                <div className="px-6 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${pColorStr}22 0%, transparent 100%)`, borderBottom: `2px solid ${pColorStr}33` }}>
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: `${pColorStr}20` }}>
                                            <span className="material-symbols-outlined notranslate" style={{ color: pColorStr }}>hub</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[10px] font-bold" style={{ color: pColorStr }}>{p.id}</span>
                                                {p.numeroContrato && <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">Contrato: {p.numeroContrato}</span>}
                                            </div>
                                            <h4 className="text-base font-bold text-slate-900">{p.nombre}</h4>
                                            {(p.cliente || p.tipoServicio) && <p className="text-[10px] text-slate-400 font-medium">{p.cliente}{p.cliente && p.tipoServicio ? ' - ' : ''}{p.tipoServicio}</p>}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${p.coberturaCompleta ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                        {p.coberturaCompleta ? '✓ 24H Completas' : `${p.horasDescubiertas.length} franjas sin cubrir`}
                                    </span>
                                </div>

                                {/* Schedule Preview Grid */}
                                <div className="overflow-x-auto p-4">
                                    <table className="text-[10px] w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="text-left px-3 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 uppercase tracking-widest w-28">Cedula</th>
                                                <th className="text-left px-3 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 uppercase tracking-widest w-48">Vigilante</th>
                                                <th className="px-2 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 uppercase tracking-widest w-14">Ano</th>
                                                <th className="px-2 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 uppercase tracking-widest w-16">Mes</th>
                                                {dayNumbers.map(d => (
                                                    <th key={d} className="px-1 py-2 bg-slate-50 border border-slate-100 font-black text-slate-400 text-center" style={{ minWidth: '30px' }}>{d}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {p.turnosDetalle.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4 + daysInMonth} className="px-4 py-6 text-center text-warning font-bold bg-orange-50 border border-slate-100">
                                                        ⚠ Sin vigilantes asignados
                                                    </td>
                                                </tr>
                                            ) : p.turnosDetalle.map((t, ti) => {
                                                const shiftCode = getShiftAbbrev(t.horaInicio, t.horaFin);
                                                const isNight = shiftCode.startsWith('N');
                                                const cellBg = isNight ? '#0b1437' : pColorStr;
                                                return (
                                                    <tr key={t.vigilanteId} className={ti % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                        <td className="px-3 py-2 border border-slate-100 font-mono font-bold text-slate-600">{t.cedula}</td>
                                                        <td className="px-3 py-2 border border-slate-100 font-bold text-slate-900">{t.nombre}</td>
                                                        <td className="px-2 py-2 border border-slate-100 text-center text-slate-500">{scheduleYear}</td>
                                                        <td className="px-2 py-2 border border-slate-100 text-center text-slate-500 font-bold">{monthNames[scheduleMonth].slice(0, 3).toUpperCase()}</td>
                                                        {dayNumbers.map(d => (
                                                            <td key={d} className="border border-slate-100 text-center p-0">
                                                                <div className="px-0.5 py-1" style={{ background: cellBg }}>
                                                                    <span className="text-[9px] font-black" style={{ color: 'white' }}>{shiftCode}</span>
                                                                </div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Legend for this post */}
                                <div className="px-6 pb-4 flex flex-wrap gap-3 items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Leyenda:</span>
                                    {[['D12', 'Diurno 06a18', pColorStr, '#fff'], ['N12', 'Nocturno 18a06', '#0b1437', '#fff']].map(([code, label, bg, fg]) => (
                                        <div key={code} className="flex items-center gap-1.5">
                                            <div className="px-2 py-0.5 rounded text-[9px] font-black" style={{ background: bg, color: fg }}>{code}</div>
                                            <span className="text-[9px] text-slate-500">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default Resumen;
