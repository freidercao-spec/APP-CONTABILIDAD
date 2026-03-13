import { useEffect, useRef } from 'react';
import { usePuestoStore } from './puestoStore';
import { useVigilanteStore } from './vigilanteStore';
import { useProgramacionStore } from './programacionStore';
import { useAIStore } from './aiStore';

export const useMotorInteligencia = () => {
    const puestos = usePuestoStore(s => s.puestos);
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const programaciones = useProgramacionStore(s => s.programaciones);
    const addAction = useAIStore(s => s.addAction);
    const actions = useAIStore(s => s.actions);

    // Guardar logs que ya alertamos para no hacer spam (en memoria ram mientras la app está abierta)
    const alertasEmitidas = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Ejecutar análisis cada vez que cambie algo, pero con un pequeño debounce táctico
        const timer = setTimeout(() => {
            analizarSistema();
        }, 3000); // 3 segundos después del cambio

        return () => clearTimeout(timer);
    }, [puestos, vigilantes, programaciones]);

    const dispararAlerta = (id: string, texto: string, priority: 'high' | 'medium' | 'low') => {
        if (alertasEmitidas.current.has(id)) return;
        
        // Cooldown dinámico basado en prioridad (Más estricto para no saturar)
        const now = Date.now();
        // High: 1 hora (crítico). Medium: 8 horas. Low: 24 horas (una vez al día).
        const cooldown = priority === 'high' ? 1000 * 60 * 60 : priority === 'medium' ? 1000 * 60 * 60 * 8 : 1000 * 60 * 60 * 24;
        
        const yaExiste = actions.some(a => 
            (a.text === texto || a.id.split('_')[0] === id.split('_')[0]) && 
            (now - a.timestamp) < cooldown
        );
        
        if (yaExiste) return;

        addAction({
            text: texto,
            type: 'notification',
            sender: 'ai',
            priority
        });
        alertasEmitidas.current.add(id);
    };

    const analizarSistema = () => {
        if (!puestos || !Array.isArray(puestos)) return;
        if (!vigilantes || !Array.isArray(vigilantes)) return;
        if (!programaciones || !Array.isArray(programaciones)) return;

        const mesActual = new Date().getMonth();
        const anioActual = new Date().getFullYear();
        const hoy = new Date().getDate();

        // --- 1. COBERTURA DE PUESTOS (ALTA CRITICIDAD) ---
        const puestosIncompletos = puestos.filter(p => {
            const vigis = vigilantes.filter(v => v.puestoId === p.id);
            return vigis.length < 3;
        });

        if (puestosIncompletos.length > 0) {
            // Solo alertar si el déficit es significativo (> 20% de los puestos) o si es un solo puesto crítico
            if (puestosIncompletos.length === 1) {
                dispararAlerta(
                    `deficit_puesto_${puestosIncompletos[0].id}`,
                    `**REPORTE DE CORAZAI:** El puesto "${puestosIncompletos[0].nombre}" está incompleto. Como supervisor de programación, noto que falta personal para garantizar la seguridad total.`,
                    'high'
                );
            } else if (puestosIncompletos.length > 3) {
                dispararAlerta(
                    `deficit_puestos_masivo`,
                    `**ALERTA DE PROGRAMACIÓN:** Detecto un fallo sistémico. ${puestosIncompletos.length} puestos tienen huecos en sus cuadrantes. CorazAI recomienda reasignar personal disponible inmediatamente.`,
                    'high'
                );
            }
        }

        // --- 2. FALLAS OPERATIVAS (AUSENTISMO EN TIEMPO REAL) ---
        const ausentes = vigilantes.filter(v => v.puestoId && v.estado === 'ausente');
        if (ausentes.length > 0) {
            if (ausentes.length <= 2) {
                ausentes.forEach(v => {
                    const puesto = puestos.find(p => p.id === v.puestoId);
                    dispararAlerta(
                        `ausente_${v.id}`,
                        `**NOVEDAD OPERATIVA:** CorazAI informa que ${v.nombre} está ausente en "${puesto?.nombre || 'Puesto'}". Esto afecta mi planificación de turnos.`,
                        'high'
                    );
                });
            } else {
                dispararAlerta(
                    `ausentes_multiples`,
                    `**CRISIS DE COBERTURA:** Tengo ${ausentes.length} ausencias reportadas. CorazAI está analizando el impacto en la programación mensual.`,
                    'high'
                );
            }
        }

        // --- 3. PROGRAMACIÓN (TRABAJO ADMINISTRATIVO - MENOS INTRUSIVO) ---
        const progsMes = programaciones.filter(p => p.anio === anioActual && p.mes === mesActual);
        const puestosSinProg = puestos.filter(p => !progsMes.some(prog => prog.puestoId === p.id));

        if (puestosSinProg.length > 0) {
            // Solo es urgente si falta poco para acabar el mes o si son Demasiados puestos
            const esUrgente = hoy > 25 || puestosSinProg.length > (puestos.length / 2);
            
            if (esUrgente) {
                dispararAlerta(
                    `sin_prog_critical`,
                    `**URGENCIA CORAZAI:** ${puestosIncompletos.length} puestos carecen de programación oficial. Como encargado de los turnos, exijo regularizar estos cuadrantes.`,
                    'high'
                );
            } else if (hoy > 15 && puestosSinProg.length > 0) {
                // Notificación de media prioridad solo a mitad de mes
                dispararAlerta(
                    `sin_prog_advice`,
                    `**MONITOREO PREVENTIVO:** CorazAI ha detectado que faltan ${puestosSinProg.length} cuadrantes. Sugiero iniciar la programación para evitar cuellos de botella.`,
                    'medium'
                );
            }
        }

        // --- 4. TRÁMITES (ESTADÍSTICAS SILENCIOSAS) ---
        const borradoresCount = progsMes.filter(p => p.estado === 'borrador').length;
        if (borradoresCount > 5) { // Solo avisar si hay una acumulación real
            dispararAlerta(
                `borradores_acumulados`,
                `**FLUJO DE TRABAJO:** Tienes ${borradoresCount} programaciones en borrador. Considere publicarlas para formalizar la operación.`,
                'low'
            );
        }

        // --- 5. ANÁLISIS PREDICTIVO (AGOTAMIENTO Y FATIGA) ---
        vigilantes.forEach(v => {
            const misProgs = progsMes.map(p => ({
                puesto: puestos.find(pst => pst.id === p.puestoId),
                asigs: p.asignaciones.filter(a => a.vigilanteId === v.id)
            })).filter(x => x.asigs.length > 0);

            if (misProgs.length === 0) return;

            // a. Horas acumuladas (Días * 12h)
            const diasTotales = misProgs.reduce((acc, curr) => acc + curr.asigs.filter(a => a.jornada === 'normal').length, 0);
            if (diasTotales > 20) {
                dispararAlerta(
                    `exceso_horas_${v.id}`,
                    `**ALERTA PREDICTIVA:** ${v.nombre} ha superado los 20 turnos este mes (${diasTotales * 12} horas). Detecto riesgo de fatiga crónica que pondrá en peligro la seguridad del puesto. CorazAI sugiere descanso inmediato.`,
                    'high'
                );
            } else if (diasTotales > 17) {
                dispararAlerta(
                    `limite_horas_${v.id}`,
                    `**INSIGHT OPERATIVO:** ${v.nombre} se acerca al límite legal de horas. Recomiendo no asignar más turnos extras para este vigilante.`,
                    'medium'
                );
            }

            // b. Días consecutivos (Fatiga acumulada)
            // Agrupamos todas sus asignaciones del mes y las ordenamos por día
            const todasAsigs = misProgs.flatMap(p => p.asigs).sort((a, b) => a.dia - b.dia);
            
            let consecutivos = 0;
            let maxConsecutivos = 0;
            
            todasAsigs.forEach(asig => {
                if (asig.jornada === 'normal') {
                    consecutivos++;
                    if (consecutivos > maxConsecutivos) maxConsecutivos = consecutivos;
                } else {
                    consecutivos = 0;
                }
            });

            if (maxConsecutivos >= 6) {
                dispararAlerta(
                    `consecutivos_critico_${v.id}`,
                    `**ALERTA DE SEGURIDAD:** ${v.nombre} lleva ${maxConsecutivos} días seguidos trabajando sin descanso. Mi análisis predice una caída en su capacidad de alerta táctica. Exijo programar un día de descanso.`,
                    'high'
                );
            }
        });
    };

    return null; 
};
