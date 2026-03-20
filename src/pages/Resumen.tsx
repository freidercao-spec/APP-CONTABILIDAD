import { useState, useMemo } from 'react';
import { usePuestoStore } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';
import { showTacticalToast } from '../utils/tacticalToast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Config ────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

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
                        nombre: (vig?.nombre || 'Sin nombre').toUpperCase(),
                        cedula: vig?.cedula || '-',
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
                rows,
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

    // ── PDF Generation ────────────────────────────────────────────────────────
    const generateSchedulePDF = async () => {
        setIsGenerating(true);
        logAction('RESUMEN', 'Generacion de PDF', `CUADRO OPERATIVO ${MONTH_NAMES[scheduleMonth]} ${scheduleYear}`, 'info');

        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const fechaActual = now.toLocaleDateString('es-CO', { dateStyle: 'long' });

            filteredData.forEach((puesto, puestoIdx) => {
                if (puestoIdx > 0) doc.addPage();

                // ── Header Box ──────────────────────────────────────────
                doc.setDrawColor(30, 41, 59);
                doc.setLineWidth(0.5);
                doc.rect(8, 8, pageW - 16, 25);

                // CORAZA Logo Replacement (Vectorized style)
                doc.setFillColor(67, 24, 255);
                doc.rect(10, 10, 21, 21, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(5); doc.setFont('helvetica', 'bold');
                doc.text('CORAZA', 20.5, 18, { align: 'center' });
                doc.text('SEGURIDAD', 20.5, 22.5, { align: 'center' });

                // Central Title
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(10); doc.setFont('helvetica', 'bold');
                doc.text('CUADRO OPERATIVO DE PROGRAMACION', pageW / 2, 17, { align: 'center' });
                doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
                doc.text(`CORAZA SEGURIDAD PRIVADA CTA - NIT 901509121`, pageW / 2, 22, { align: 'center' });
                doc.setFont('helvetica', 'bold');
                doc.text(`${MONTH_NAMES[scheduleMonth].toUpperCase()} ${scheduleYear}`, pageW / 2, 28, { align: 'center' });

                // Right Info Panel
                doc.setFontSize(7); doc.setTextColor(71, 85, 105);
                doc.text(`PUESTO:`, pageW - 65, 15);
                doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold');
                doc.text(puesto.nombre.slice(0, 30), pageW - 48, 15);

                doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal');
                doc.text(`REVISIÓN:`, pageW - 65, 20);
                doc.setTextColor(15, 23, 42); 
                doc.text(fechaActual, pageW - 48, 20);

                doc.setTextColor(71, 85, 105);
                doc.text(`PAGINA:`, pageW - 65, 25);
                doc.setTextColor(15, 23, 42);
                doc.text(`${puestoIdx + 1} / ${filteredData.length}`, pageW - 48, 25);

                // ── AutoTable Generation ──────────────────────────────────────
                const ROL_ORDER: Record<string, number> = { 'titular_a': 0, 'titular_b': 1, 'relevante': 2 };
                const sortedRows = [...puesto.rows].sort((a, b) =>
                    (ROL_ORDER[a.rol] ?? 99) - (ROL_ORDER[b.rol] ?? 99)
                );

                const ROL_LABELS: Record<string, string> = {
                    'titular_a': 'TIT-A',
                    'titular_b': 'TIT-B',
                    'relevante': 'REL',
                };

                const headRows = [['ROL', 'CEDULA', 'VIGILANTE', ...dayNumbers.map(d => String(d).padStart(2, '0'))]];
                const bodyRows = sortedRows.map(row => {
                    const rowData = [
                        ROL_LABELS[row.rol] || row.rol,
                        row.cedula,
                        row.nombre,
                    ];
                    dayNumbers.forEach(d => {
                        const asig = row.asigs.find(a => a.dia === d);
                        const label = (asig?.jornada && JORNADA_SHORT[asig.jornada]) || (asig?.turno && JORNADA_SHORT[asig.turno]) || '-';
                        rowData.push(label === 'sin_asignar' ? '-' : label);
                    });
                    return rowData;
                });

                autoTable(doc, {
                    startY: 38,
                    head: headRows,
                    body: bodyRows,
                    theme: 'grid',
                    styles: {
                        fontSize: 5,
                        cellPadding: 0.8,
                        halign: 'center',
                        valign: 'middle',
                        lineWidth: 0.1,
                        textColor: [30, 41, 59],
                        font: 'helvetica'
                    },
                    headStyles: {
                        fillColor: [67, 24, 255],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold'
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold', minCellWidth: 10, halign: 'center', textColor: [67, 24, 255] },
                        1: { minCellWidth: 16 },
                        2: { minCellWidth: 35, halign: 'left', fontStyle: 'bold' }
                    },
                    didParseCell: (data) => {
                        // Color coding per day cell content
                        if (data.row.type === 'body' && data.column.index >= 3) {
                            const val = data.cell.text[0];
                            if (val === 'D') data.cell.styles.fillColor = [240, 246, 255];
                            if (val === 'N') data.cell.styles.fillColor = [245, 245, 255];
                            if (val === 'DR') data.cell.styles.fillColor = [236, 253, 245];
                            if (val === 'DNR') data.cell.styles.fillColor = [255, 251, 235];
                            if (val === 'VAC') data.cell.styles.fillColor = [245, 243, 255];
                            if (val === '-') data.cell.styles.textColor = [200, 200, 200];
                        }
                    },
                    margin: { left: 8, right: 8 }
                });

                // Final Footer on each page
                doc.setFontSize(6); doc.setTextColor(148, 163, 184);
                doc.text(
                    `Coraza Seguridad Privada CTA | Carrera 81 #49-24 Medellín | Tel: 311 383 6939`,
                    pageW / 2, doc.internal.pageSize.height - 8, { align: 'center' }
                );
            });

            doc.save(`CUADRO_OPERATIVO_${MONTH_NAMES[scheduleMonth].toUpperCase()}_${scheduleYear}.pdf`);
            showTacticalToast({ title: 'PDF Generado', message: 'El archivo se descargó correctamente.', type: 'success' });
            setGenerated(true);
            setTimeout(() => setGenerated(false), 3000);
        } catch (error) {
            console.error('CRITICAL PDF ERROR:', error);
            showTacticalToast({ title: 'Error de PDF', message: 'Falla al procesar el documento.', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="page-container animate-in fade-in duration-500 pb-24">
            {/* UI Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase">Resumen Programación</h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium italic">Modulo de exportación definitiva de cuadros operativos</p>
                </div>
                <button
                    onClick={generateSchedulePDF}
                    disabled={isGenerating || filteredData.length === 0}
                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 shadow-lg ${
                        generated ? 'bg-success text-white shadow-success/30' : 'bg-primary text-white shadow-primary/30 hover:brightness-110'
                    } disabled:opacity-50`}
                >
                    <span className="material-symbols-outlined text-[20px]">{isGenerating ? 'sync' : generated ? 'task_alt' : 'picture_as_pdf'}</span>
                    {isGenerating ? 'Generando...' : generated ? '¡Listo!' : 'Exportar PDF'}
                </button>
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { l: 'Puestos', v: stats.total, i: 'hub', c: 'text-primary' },
                    { l: 'Cubiertos', v: stats.cubiertos, i: 'verified', c: 'text-success' },
                    { l: 'Sin Cubrir', v: stats.sinCobertura, i: 'report', c: 'text-warning' },
                    { l: 'Personal', v: stats.totalVigilantesDesplegados, i: 'groups', c: 'text-slate-600' },
                ].map((s, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
                        <span className={`material-symbols-outlined ${s.c} mb-1`}>{s.i}</span>
                        <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase">{s.l}</p>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-wrap gap-6 items-end mb-8">
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black uppercase text-slate-400">Puesto a Exportar</label>
                    <select value={filterPuesto} onChange={e => setFilterPuesto(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-primary">
                        <option value="todos">Todos los puestos</option>
                        {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-2 ml-auto">
                    <label className="text-[9px] font-black uppercase text-slate-400">Mes de Programación</label>
                    <div className="flex gap-2">
                        <select value={scheduleMonth} onChange={e => setScheduleMonth(Number(e.target.value))}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700">
                            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <input type="number" value={scheduleYear} onChange={e => setScheduleYear(Number(e.target.value))}
                            className="w-24 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700" />
                    </div>
                </div>
            </div>

            {/* Interactive Preview List */}
            <div className="space-y-4">
                {filteredData.map((p, pIdx) => (
                    <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-primary/20 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="size-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs">{pIdx + 1}</div>
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{p.nombre}</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Asignaciones en este mes: {p.rows.length}</p>
                            </div>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${p.coberturaCompleta ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                            {p.coberturaCompleta ? '✓ Operativo' : '⚠️ Pendiente'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Resumen;
