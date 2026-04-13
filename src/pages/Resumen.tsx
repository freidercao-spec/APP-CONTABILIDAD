import { useState, useMemo, useCallback } from 'react';
import { usePuestoStore } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';
import { showTacticalToast } from '../utils/tacticalToast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

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

            // ── NUEVA LÓGICA ROBUSTA DE FILAS (Coincidente con el Tablero) ──
            const personalRoles = (prog?.personal || []).map(ps => ps.rol);
            const assignmentRoles = Array.from(new Set((prog?.asignaciones || [])
              .filter(a => a.vigilanteId !== null)
              .map(a => a.rol)));
            
            const allUniqueRoles = Array.from(new Set([...personalRoles, ...assignmentRoles]))
                .filter(rol => !/^\d+$/.test(rol));

            const rows = allUniqueRoles.map(rol => {
                const per = (prog?.personal || []).find(p => p.rol === rol);
                const vigId = per?.vigilanteId || (prog?.asignaciones || []).find(a => a.rol === rol && a.vigilanteId)?.vigilanteId;
                
                const vig = vigilantes.find(v =>
                    v.id === vigId || v.dbId === vigId
                );

                // Get asignaciones for this role in this post
                const asigs = (prog?.asignaciones || [])
                    .filter(a => a.rol === rol)
                    .sort((a, b) => a.dia - b.dia);

                return {
                    rol,
                    vigilanteId: vigId || null,
                    nombre: (vig?.nombres ? `${vig.nombres} ${vig.apellidos}` : (vig?.nombre || 'Sin Asignar')).toUpperCase(),
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

    // exportData: Incluimos TODOS los puestos para que el reporte sea completo (600+ puestos)
    const exportData = useMemo(() => {
        return resumenData;
    }, [resumenData]);

    const stats = useMemo(() => ({
        total: puestos.length,
        cubiertos: resumenData.filter(p => p.coberturaCompleta).length,
        sinCobertura: resumenData.filter(p => !p.coberturaCompleta).length,
        totalVigilantesDesplegados: resumenData.reduce((acc, p) => acc + p.rows.length, 0),
    }), [puestos, resumenData]);

    // ── PDF Generation ─────────────────────────────────────────────────────────
    const generateSchedulePDF = async () => {
        setIsGenerating(true);
        logAction('RESUMEN', 'Generacion de PDF', `CUADRO OPERATIVO ${MONTH_NAMES[scheduleMonth]} ${scheduleYear} — ${exportData.length} puestos`, 'info');

        try {
            // Usamos exportData (TODOS los puestos programados del mes), no filteredData
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const fechaActual = now.toLocaleDateString('es-CO', { dateStyle: 'long' });

            exportData.forEach((puesto, puestoIdx) => {
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
                doc.text(`${puestoIdx + 1} / ${exportData.length}`, pageW - 48, 25);

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
                        if (data.section === 'body' && data.column.index >= 3) {
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
            showTacticalToast({ title: 'PDF Generado', message: `${exportData.length} puesto(s) exportados correctamente.`, type: 'success' });
            setGenerated(true);
            setTimeout(() => setGenerated(false), 3000);
        } catch (error) {
            console.error('CRITICAL PDF ERROR:', error);
            showTacticalToast({ title: 'Error de PDF', message: 'Falla al procesar el documento.', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const generateScheduleExcel = useCallback(async () => {
        setIsGenerating(true);
        logAction('RESUMEN', 'Generación Excel', `Reporte masivo ${MONTH_NAMES[scheduleMonth]} ${scheduleYear}`, 'info');

        try {
            const wb = new ExcelJS.Workbook();
            const CLR_VERDE_MES = '4ADE80'; 
            const CLR_D12 = 'FFB547';     
            const CLR_N12 = '3B82F6';     
            const CLR_NR  = 'EF4444';     
            const CLR_X   = 'FACC15';     
            const CLR_VAC = 'F472B6';     

            const borderThin = {
                top: { style: 'thin' as const, color: { argb: '000000' } },
                left: { style: 'thin' as const, color: { argb: '000000' } },
                bottom: { style: 'thin' as const, color: { argb: '000000' } },
                right: { style: 'thin' as const, color: { argb: '000000' } }
            };

            const getTacticalCode = (asig: any): string => {
                if (!asig || asig.jornada === 'sin_asignar' || !asig.jornada) return '-';
                if (asig.codigo_personalizado) return asig.codigo_personalizado;
                const j = asig.jornada || asig.turno || '';
                if (j === 'descanso_remunerado' || j === 'X' || j === 'DR') return 'X';
                if (j === 'descanso_no_remunerado' || j === 'NR' || j === 'DNR') return 'NR';
                if (j === 'vacacion' || j === 'VAC') return 'VAC';
                if (j === 'AM' || j === 'D' || (j === 'normal' && asig.turno !== 'PM')) return 'D12';
                if (j === 'PM' || j === 'N' || (j === 'normal' && asig.turno === 'PM')) return 'N12';
                if (j === '24H' || j === '24') return '24';
                return j;
            };

            const getCodeColor = (code: string): string | null => {
                if (code === '-') return 'EF4444'; // Rojo para desasignados
                if (code === 'D12' || code === 'D') return CLR_D12;
                if (code === 'N12' || code === 'N') return CLR_N12;
                if (code === 'NR')  return CLR_NR;
                if (code === 'X')   return CLR_X;
                if (code === 'VAC') return CLR_VAC;
                return null;
            };

            exportData.forEach((puesto, pIdx) => {
                const sheetName = puesto.nombre.slice(0, 31).replace(/[[\]*/\\?:]/g, '').trim() || `Puesto ${pIdx + 1}`;
                const ws = wb.addWorksheet(sheetName);

                // --- ENCABEZADO CORPORATIVO (Elegante) ---
                ws.mergeCells('A1', 'C1');
                const headTitle = ws.getCell('A1');
                headTitle.value = 'CORAZA SEGURIDAD PRIVADA CTA';
                headTitle.font = { name: 'Arial Narrow', size: 14, bold: true, color: { argb: '4318FF' } };
                
                ws.mergeCells('A2', 'C2');
                const headNit = ws.getCell('A2');
                headNit.value = 'NIT: 901509121';
                headNit.font = { name: 'Arial Narrow', size: 10, bold: true };

                ws.mergeCells('A3', 'C3');
                const headAddr = ws.getCell('A3');
                headAddr.value = 'Carrera 81 #49-24 Medellín | Tel: 311 383 6939';
                headAddr.font = { name: 'Arial Narrow', size: 9 };

                ws.mergeCells('A4', 'C4');
                const headPuesto = ws.getCell('A4');
                headPuesto.value = `PUESTO: ${puesto.nombre.toUpperCase()}`;
                headPuesto.font = { name: 'Arial Narrow', size: 11, bold: true };
                headPuesto.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

                // Row 5: Green Month Bar
                ws.mergeCells(`A5:${String.fromCharCode(65 + 3 + daysInMonth + 4)}5`);
                const mc = ws.getCell('A5');
                mc.value = MONTH_NAMES[scheduleMonth].toUpperCase();
                mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLR_VERDE_MES } };
                mc.font = { name: 'Arial Narrow', size: 10, bold: true };
                mc.alignment = { horizontal: 'center' };
                ws.getRow(5).height = 18;

                // Row 6: Day Names
                const dowNames = ['D','L','M','W','J','V','S'];
                dayNumbers.forEach((d, i) => {
                    const dt = new Date(scheduleYear, scheduleMonth, d);
                    const cell = ws.getRow(6).getCell(4 + i);
                    cell.value = dowNames[dt.getDay()];
                    cell.font = { name: 'Arial Narrow', size: 8, bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = borderThin;
                });

                // Row 7: Numbers
                dayNumbers.forEach((d, i) => {
                    const cell = ws.getRow(7).getCell(4 + i);
                    cell.value = d;
                    cell.font = { name: 'Arial Narrow', size: 8, bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = borderThin;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
                });

                // Row 8: Column Headers
                const ROL_LABELS: Record<string, string> = { 'titular_a': 'TIT-A', 'titular_b': 'TIT-B', 'relevante': 'REL' };
                ['ROL', 'CÉDULA', 'NOMBRE DE GUARDA'].forEach((v, i) => {
                    const cell = ws.getRow(8).getCell(i + 1);
                    cell.value = v;
                    cell.font = { name: 'Arial Narrow', size: 9, bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = borderThin;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
                });

                // Summary Headers (al final de los días)
                const lastColIdx = 4 + daysInMonth;
                ['TRAB', 'DESC', 'NR', 'VAC'].forEach((v, i) => {
                    const cell = ws.getRow(8).getCell(lastColIdx + i);
                    cell.value = v;
                    cell.font = { name: 'Arial Narrow', size: 8, bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = borderThin;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
                });

                ws.getRow(8).height = 18;

                // Data Rows
                puesto.rows.forEach((row, ri) => {
                    const exRow = ws.getRow(9 + ri);
                    exRow.height = 16;

                    // Col 1: ROL
                    const c0 = exRow.getCell(1);
                    c0.value = ROL_LABELS[row.rol] || row.rol.toUpperCase();
                    c0.font = { name: 'Arial Narrow', size: 7, bold: true };
                    c0.alignment = { horizontal: 'center' };
                    c0.border = borderThin;

                    // Col 2: Cedula
                    const c2 = exRow.getCell(2);
                    c2.value = row.cedula;
                    c2.font = { name: 'Arial Narrow', size: 8 };
                    c2.alignment = { horizontal: 'center' };
                    c2.border = borderThin;

                    // Col 3: Nombre
                    const c3 = exRow.getCell(3);
                    c3.value = (row.nombre || "SIN ASIGNAR").toUpperCase();
                    c3.font = { name: 'Arial Narrow', size: 8 };
                    c3.border = borderThin;

                    // Days & Totals
                    let tTrab = 0, tDesc = 0, tNR = 0, tVac = 0;

                    dayNumbers.forEach((d, di) => {
                        const cell = exRow.getCell(4 + di);
                        const asig = (row.asigs || []).find((a: any) => a.dia === d);
                        const code = getTacticalCode(asig);
                        
                        cell.value = code;
                        cell.font = { name: 'Arial Narrow', size: 7, bold: true };
                        cell.alignment = { horizontal: 'center' };
                        cell.border = borderThin;

                        const color = getCodeColor(code);
                        if (color) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                        }

                        // Conteo para resumen
                        if (['D12', 'N12', '24'].includes(code)) tTrab++;
                        else if (code === 'X') tDesc++;
                        else if (code === 'NR') tNR++;
                        else if (code === 'VAC') tVac++;
                    });

                    // Totals
                    [tTrab, tDesc, tNR, tVac].forEach((val, vi) => {
                        const tCell = exRow.getCell(lastColIdx + vi);
                        tCell.value = val || '';
                        tCell.font = { name: 'Arial Narrow', size: 8, bold: true };
                        tCell.alignment = { horizontal: 'center' };
                        tCell.border = borderThin;
                    });
                });

                // Widths
                ws.getColumn(1).width = 10;
                ws.getColumn(2).width = 14;
                ws.getColumn(3).width = 40;
                dayNumbers.forEach((_, i) => { ws.getColumn(4 + i).width = 3.5; });
                [1,2,3,4].forEach((_, i) => { ws.getColumn(lastColIdx + i).width = 6; });
            });

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RESUMEN_OPERATIVO_${MONTH_NAMES[scheduleMonth].toUpperCase()}_${scheduleYear}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);

            showTacticalToast({ title: '💎 Excel Premium Generado', message: 'Reporte fiel al cuadro táctico.', type: 'success' });
            setGenerated(true);
            setTimeout(() => setGenerated(false), 3000);
        } catch (error) {
            console.error('EXCEL ERROR:', error);
            showTacticalToast({ title: 'Error de Excel', message: 'Falla al procesar el archivo masivo.', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    }, [exportData, scheduleMonth, scheduleYear, dayNumbers, logAction]);

    return (
        <div className="page-container animate-in fade-in duration-500 pb-24">
            {/* UI Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase">Resumen Programación</h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium italic">Modulo de exportación definitiva de cuadros operativos</p>
                </div>
                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={generateScheduleExcel}
                        disabled={isGenerating || exportData.length === 0}
                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 shadow-lg ${
                            generated ? 'bg-success text-white shadow-success/30' : 'bg-emerald-600 text-white shadow-emerald-600/30 hover:brightness-110'
                        } disabled:opacity-50`}
                    >
                        <span className="material-symbols-outlined text-[20px]">{isGenerating ? 'sync' : generated ? 'task_alt' : 'table_view'}</span>
                        {isGenerating ? 'Generando...' : generated ? '¡Listo!' : `Exportar Excel (${exportData.length} puestos)`}
                    </button>

                    <button
                        onClick={generateSchedulePDF}
                        disabled={isGenerating || exportData.length === 0}
                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 shadow-lg ${
                            generated ? 'bg-success text-white shadow-success/30' : 'bg-primary text-white shadow-primary/30 hover:brightness-110'
                        } disabled:opacity-50`}
                    >
                        <span className="material-symbols-outlined text-[20px]">{isGenerating ? 'sync' : generated ? 'task_alt' : 'picture_as_pdf'}</span>
                        {isGenerating ? 'Generando...' : generated ? '¡Listo!' : `Exportar PDF (${exportData.length} puestos)`}
                    </button>
                </div>
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

            {/* Filter Bar — solo afecta la vista previa en pantalla */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-wrap gap-6 items-end mb-8">
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black uppercase text-slate-400">Filtro Vista Previa</label>
                    <select value={filterPuesto} onChange={e => setFilterPuesto(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-primary">
                        <option value="todos">Todos los puestos</option>
                        {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <p className="text-[9px] text-slate-400">✅ El PDF/Excel exporta <strong>todos</strong> los puestos del sistema ({stats.total})</p>
                </div>
                <div className="flex flex-col gap-2 ml-auto">
                    <label className="text-[9px] font-black uppercase text-slate-400">Estado de Sincronización</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-emerald-500/20 rounded-xl">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Realtime Activo</span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
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
