import { useState, useMemo } from 'react';
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

    const generateScheduleExcel = async () => {
        setIsGenerating(true);
        logAction('RESUMEN', 'Generacion de Excel', `CUADRO OPERATIVO ${MONTH_NAMES[scheduleMonth]} ${scheduleYear} — ${exportData.length} puestos`, 'info');

        // ── Paleta de colores (igual al PDF) ─────────────────────────────────
        const COLOR_HEADER_BG  = '4318FF'; // Azul Coraza
        const COLOR_HEADER_FG  = 'FFFFFF';
        const COLOR_TITLE_BG   = '1E293B'; // Slate-800
        const COLOR_PUESTO_BG  = '1E3A5F'; // Azul oscuro para fila puesto
        const COLOR_PUESTO_FG  = 'FFFFFF';
        const COLOR_ROL_A      = 'EDE9FE'; // lila suave TIT-A
        const COLOR_ROL_B      = 'E0F2FE'; // celeste suave TIT-B
        const COLOR_ROL_R      = 'FEF9C3'; // amarillo suave REL
        const COLOR_D          = 'DBEAFE'; // Dia (AM)
        const COLOR_N          = 'E0E7FF'; // Noche (PM)
        const COLOR_24         = 'FDE68A'; // 24H
        const COLOR_DR         = 'DCFCE7'; // Descanso Remunerado
        const COLOR_DNR        = 'FEF3C7'; // Descanso No Remunerado
        const COLOR_VAC        = 'F3E8FF'; // Vacacion
        const COLOR_BORDER     = 'CBD5E1'; // slate-300
        const COLOR_SUB_BG     = 'F8FAFC'; // rows pares

        const ROL_ORDER: Record<string, number> = { 'titular_a': 0, 'titular_b': 1, 'relevante': 2 };
        const ROL_LABELS: Record<string, string> = { 'titular_a': 'TIT-A', 'titular_b': 'TIT-B', 'relevante': 'REL' };
        const ROL_BG: Record<string, string> = { 'TIT-A': COLOR_ROL_A, 'TIT-B': COLOR_ROL_B, 'REL': COLOR_ROL_R };
        const JORNADA_COLOR: Record<string, string> = {
            'D': COLOR_D, 'N': COLOR_N, '24': COLOR_24,
            'DR': COLOR_DR, 'DNR': COLOR_DNR, 'VAC': COLOR_VAC,
        };

        // Estilo base de borde fino en todas las celdas
        const borderThin = {
            top:    { style: 'thin' as const, color: { argb: COLOR_BORDER } },
            left:   { style: 'thin' as const, color: { argb: COLOR_BORDER } },
            bottom: { style: 'thin' as const, color: { argb: COLOR_BORDER } },
            right:  { style: 'thin' as const, color: { argb: COLOR_BORDER } },
        };
        const applyBorder = (cell: ExcelJS.Cell) => { cell.border = borderThin; };
        const applyFill = (cell: ExcelJS.Cell, argb: string) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
        };
        const applyFont = (cell: ExcelJS.Cell, opts: Partial<ExcelJS.Font>) => {
            cell.font = { name: 'Calibri', size: 10, ...opts };
        };

        try {
            const wb = new ExcelJS.Workbook();
            wb.creator = 'Coraza CTA';
            wb.created = new Date();

            const fechaActual = now.toLocaleDateString('es-CO', { dateStyle: 'long' });
            const mesLabel = `${MONTH_NAMES[scheduleMonth].toUpperCase()} ${scheduleYear}`;

            // ── UNA HOJA POR PUESTO (usa exportData — TODOS los puestos programados) ─────
            exportData.forEach((puesto, puestoIdx) => {
                // Nombre de la pestaña (max 31 chars, Excel limit)
                const sheetName = puesto.nombre.slice(0, 28).replace(/[[\]*/\\?:]/g, '').trim() || `Puesto ${puestoIdx + 1}`;
                const ws = wb.addWorksheet(sheetName, {
                    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
                    views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
                });

                // ── FILA 1: Título principal ─────────────────────────────────
                ws.mergeCells('A1:E1');
                const titleCell = ws.getCell('A1');
                titleCell.value = 'CUADRO OPERATIVO DE PROGRAMACION';
                applyFill(titleCell, COLOR_TITLE_BG);
                titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(1).height = 24;

                // ── FILA 2: Empresa ───────────────────────────────────────────
                ws.mergeCells('A2:E2');
                const empresaCell = ws.getCell('A2');
                empresaCell.value = 'CORAZA SEGURIDAD PRIVADA CTA  |  NIT 901509121  |  Cra 81 #49-24 Medellín';
                applyFill(empresaCell, COLOR_TITLE_BG);
                empresaCell.font = { name: 'Calibri', size: 9, color: { argb: 'CBD5E1' } };
                empresaCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(2).height = 16;

                // ── FILA 3: Período ───────────────────────────────────────────
                ws.mergeCells('A3:E3');
                const periodoCell = ws.getCell('A3');
                periodoCell.value = mesLabel;
                applyFill(periodoCell, '4318FF');
                periodoCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFF' } };
                periodoCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(3).height = 20;

                // ── FILA 4: Nombre del Puesto ─────────────────────────────────
                ws.mergeCells('A4:E4');
                const puestoCell = ws.getCell('A4');
                puestoCell.value = `PUESTO: ${puesto.nombre.toUpperCase()}`;
                applyFill(puestoCell, COLOR_PUESTO_BG);
                puestoCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_PUESTO_FG } };
                puestoCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
                ws.getRow(4).height = 20;

                // ── FILA 5: Meta info (Dirección / Fecha revisión / Página) ────
                ws.mergeCells('A5:C5');
                const dirCell = ws.getCell('A5');
                dirCell.value = puesto.direccion ? `Dir: ${puesto.direccion}` : 'Dirección no registrada';
                applyFill(dirCell, 'F1F5F9');
                dirCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: '64748B' } };
                dirCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

                ws.mergeCells('D5:E5');
                const revCell = ws.getCell('D5');
                revCell.value = `Revisión: ${fechaActual}  |  Pág.: ${puestoIdx + 1}/${exportData.length}`;
                applyFill(revCell, 'F1F5F9');
                revCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: '64748B' } };
                revCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
                ws.getRow(5).height = 14;

                // ── FILA 6: Encabezados de columnas ───────────────────────────
                const totalCols = 3 + daysInMonth + 3; // ROL + CEDULA + VIGILANTE + días + TRAB + DESC + VAC
                const COL_TRAB = 3 + daysInMonth + 1;
                const COL_DESC = 3 + daysInMonth + 2;
                const COL_VAC  = 3 + daysInMonth + 3;

                const headerRow = ws.getRow(6);
                headerRow.height = 18;
                const headerValues = ['ROL', 'CÉDULA', 'VIGILANTE', ...dayNumbers.map(d => String(d).padStart(2, '0')), 'TRAB', 'DESC', 'VAC'];
                headerValues.forEach((val, colIdx) => {
                    const cell = headerRow.getCell(colIdx + 1);
                    cell.value = val;
                    applyFill(cell, COLOR_HEADER_BG);
                    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_HEADER_FG } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    applyBorder(cell);
                });

                // ── FILAS DE DATOS ────────────────────────────────────────────
                const sortedRows = [...puesto.rows].sort((a, b) =>
                    (ROL_ORDER[a.rol] ?? 99) - (ROL_ORDER[b.rol] ?? 99)
                );

                sortedRows.forEach((row, rowIdx) => {
                    const excelRow = ws.getRow(7 + rowIdx);
                    excelRow.height = 16;
                    const isEven = rowIdx % 2 === 1;
                    const rowBg = isEven ? COLOR_SUB_BG : 'FFFFFF';

                    const rolLabel = ROL_LABELS[row.rol] || row.rol.toUpperCase();
                    const rolBg = ROL_BG[rolLabel] || rowBg;

                    // COL 1: ROL
                    const rolCell = excelRow.getCell(1);
                    rolCell.value = rolLabel;
                    applyFill(rolCell, rolBg);
                    rolCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '4318FF' } };
                    rolCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    applyBorder(rolCell);

                    // COL 2: CÉDULA
                    const cedCell = excelRow.getCell(2);
                    cedCell.value = row.cedula;
                    applyFill(cedCell, rowBg);
                    cedCell.font = { name: 'Calibri', size: 9, color: { argb: '334155' } };
                    cedCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    applyBorder(cedCell);

                    // COL 3: VIGILANTE
                    const vigCell = excelRow.getCell(3);
                    vigCell.value = row.nombre;
                    applyFill(vigCell, rowBg);
                    vigCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '0F172A' } };
                    vigCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    applyBorder(vigCell);

                    // COLS 4..4+days: días del mes
                    let trab = 0, desc = 0, vac = 0;
                    dayNumbers.forEach((d, dIdx) => {
                        const asig = row.asigs.find(a => a.dia === d);
                        const label = (asig?.jornada && JORNADA_SHORT[asig.jornada]) || (asig?.turno && JORNADA_SHORT[asig.turno]) || '';
                        const cleanLabel = label === 'sin_asignar' ? '' : label;

                        const dCell = excelRow.getCell(4 + dIdx);
                        dCell.value = cleanLabel || '';
                        const cellBg = cleanLabel ? (JORNADA_COLOR[cleanLabel] || rowBg) : rowBg;
                        applyFill(dCell, cellBg);
                        dCell.font = { name: 'Calibri', size: 8, bold: !!cleanLabel, color: { argb: cleanLabel ? '1E293B' : 'CBD5E1' } };
                        dCell.alignment = { horizontal: 'center', vertical: 'middle' };
                        applyBorder(dCell);

                        // Contadores resumen
                        if (cleanLabel === 'D' || cleanLabel === 'N' || cleanLabel === '24') trab++;
                        else if (cleanLabel === 'DR' || cleanLabel === 'DNR') desc++;
                        else if (cleanLabel === 'VAC') vac++;
                    });

                    // COLS resumen: TRAB / DESC / VAC
                    const trabCell = excelRow.getCell(COL_TRAB);
                    trabCell.value = trab || '';
                    applyFill(trabCell, trab > 0 ? 'DBEAFE' : rowBg);
                    trabCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '1D4ED8' } };
                    trabCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    applyBorder(trabCell);

                    const descCell = excelRow.getCell(COL_DESC);
                    descCell.value = desc || '';
                    applyFill(descCell, desc > 0 ? 'DCFCE7' : rowBg);
                    descCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '15803D' } };
                    descCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    applyBorder(descCell);

                    const vacCell = excelRow.getCell(COL_VAC);
                    vacCell.value = vac || '';
                    applyFill(vacCell, vac > 0 ? 'F3E8FF' : rowBg);
                    vacCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '7E22CE' } };
                    vacCell.alignment = { horizontal: 'center', vertical: 'middle' };
                    applyBorder(vacCell);
                });

                // ── ANCHOS DE COLUMNA ──────────────────────────────────────────
                ws.getColumn(1).width = 8;   // ROL
                ws.getColumn(2).width = 13;  // CÉDULA
                ws.getColumn(3).width = 28;  // VIGILANTE
                dayNumbers.forEach((_, i) => { ws.getColumn(4 + i).width = 4; });
                ws.getColumn(COL_TRAB).width = 6;
                ws.getColumn(COL_DESC).width = 6;
                ws.getColumn(COL_VAC).width = 6;

                // Borde negro grueso alrededor del área de datos completa (fila 1 a última de datos)
                const lastDataRow = 6 + sortedRows.length;
                for (let c = 1; c <= totalCols; c++) {
                    ['1','2','3','4','5'].forEach(r => {
                        const cell = ws.getCell(parseInt(r), c);
                        if (!cell.border) cell.border = borderThin;
                    });
                }
                // Fila vacía al final de cada hoja (separador visual)
                const sepRow = ws.getRow(lastDataRow + 1);
                sepRow.height = 10;
            });

            // ── DESCARGA ──────────────────────────────────────────────────────
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CUADRO_OPERATIVO_${MONTH_NAMES[scheduleMonth].toUpperCase()}_${scheduleYear}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);

            showTacticalToast({ title: 'Excel Profesional Generado', message: `${filteredData.length} hoja(s) exportadas correctamente.`, type: 'success' });
            setGenerated(true);
            setTimeout(() => setGenerated(false), 3000);
        } catch (error) {
            console.error('CRITICAL EXCEL ERROR:', error);
            showTacticalToast({ title: 'Error de Excel', message: 'Falla al procesar el archivo.', type: 'error' });
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
