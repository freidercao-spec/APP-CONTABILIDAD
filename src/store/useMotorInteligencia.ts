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

    // Guardar logs que ya alertamos para no hacer spam (en memoria ram mientras la app esta abierta)
    const alertasEmitidas = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Ejecutar analisis cada vez que cambie algo, pero con un pequeno debounce tactico
        const timer = setTimeout(() => {
            analizarSistema();
        }, 3000); // 3 segundos despues del cambio

        return () => clearTimeout(timer);
    }, [puestos, vigilantes, programaciones]);

    const dispararAlerta = (id: string, texto: string, priority: 'high' | 'medium' | 'low') => {
        if (alertasEmitidas.current.has(id)) return;
        
        // Cooldown dinamico basado en prioridad (Mas estricto para no saturar)
        const now = Date.now();
        // High: 1 hora (critico). Medium: 8 horas. Low: 24 horas (una vez al dia).
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
            const vigis = vigilantes.filter(v => 
                v.puestoId === p.dbId || v.puestoId === p.id
            ); // Compare UUID or Shorthand
            return vigis.length < 3;
        });

        if (puestosIncompletos.length > 0) {
            // Solo alertar si el deficit es significativo (> 20% de los puestos) o si es un solo puesto critico
            if (puestosIncompletos.length === 1) {
                dispararAlerta(
                    `deficit_puesto_${puestosIncompletos[0].id}`,
                    `**REPORTE DE CORAZAI:** El puesto "${puestosIncompletos[0].nombre}" esta incompleto. Como supervisor de programacion, noto que falta personal para garantizar la seguridad total.`,
                    'high'
                );
            } else if (puestosIncompletos.length > 3) {
                dispararAlerta(
                    `deficit_puestos_masivo`,
                    `**ALERTA DE PROGRAMACION:** Detecto un fallo sistemico. ${puestosIncompletos.length} puestos tienen huecos en sus cuadrantes. CorazAI recomienda reasignar personal disponible inmediatamente.`,
                    'high'
                );
            }
        }

        // --- 2. FALLAS OPERATIVAS (AUSENTISMO EN TIEMPO REAL) ---
        const ausentes = vigilantes.filter(v => v.puestoId && v.estado === 'ausente');
        if (ausentes.length > 0) {
            if (ausentes.length <= 2) {
                ausentes.forEach(v => {
                    const puesto = puestos.find(p => p.dbId === v.puestoId); // Compare UUID
                    dispararAlerta(
                        `ausente_${v.id}`,
                        `**NOVEDAD OPERATIVA:** CorazAI informa que ${v.nombre} esta ausente en "${puesto?.nombre || 'Puesto'}". Esto afecta mi planificacion de turnos.`,
                        'high'
                    );
                });
            } else {
                dispararAlerta(
                    `ausentes_multiples`,
                    `**CRISIS DE COBERTURA:** Tengo ${ausentes.length} ausencias reportadas. CorazAI esta analizando el impacto en la programacion mensual.`,
                    'high'
                );
            }
        }

        // --- 3. PROGRAMACION (TRABAJO ADMINISTRATIVO - MENOS INTRUSIVO) ---
        const progsMes = programaciones.filter(p => p.anio === anioActual && p.mes === mesActual);
        const puestosSinProg = puestos.filter(p => !progsMes.some(prog => prog.puestoId === p.dbId)); // Use UUID

        if (puestosSinProg.length > 0) {
            // Solo es urgente si falta poco para acabar el mes o si son Demasiados puestos
            const esUrgente = hoy > 25 || puestosSinProg.length > (puestos.length / 2);
            
            if (esUrgente) {
                dispararAlerta(
                    `sin_prog_critical`,
                    `**URGENCIA CORAZAI:** ${puestosSinProg.length} puestos carecen de programacion oficial para este mes. CorazAI exige regularizar estos cuadrantes.`,
                    'high'
                );
            } else if (hoy > 15 && puestosSinProg.length > 0) {
                // Notificacion de media prioridad solo a mitad de mes
                dispararAlerta(
                    `sin_prog_advice`,
                    `**MONITOREO PREVENTIVO:** CorazAI ha detectado que faltan ${puestosSinProg.length} cuadrantes. Sugiero iniciar la programacion para evitar cuellos de botella.`,
                    'medium'
                );
            }
        }

        // --- 4. TRAMITES (ESTADISTICAS SILENCIOSAS) ---
        const borradoresCount = progsMes.filter(p => p.estado === 'borrador').length;
        if (borradoresCount > 5) { // Solo avisar si hay una acumulacion real
            dispararAlerta(
                `borradores_acumulados`,
                `**FLUJO DE TRABAJO:** Tienes ${borradoresCount} programaciones en borrador. Considere publicarlas para formalizar la operacion.`,
                'low'
            );
        }

        const vigAsigs = new Map<string, { p: any, a: any }[]>();
        progsMes.forEach(p => {
            (p.asignaciones || []).forEach(a => {
                const vid = a.vigilanteId;
                if (!vid) return; 
                if (!vigAsigs.has(vid)) vigAsigs.set(vid, []);
                vigAsigs.get(vid)!.push({ p, a });
            });
        });

        // --- 5. ANALISIS PREDICTIVO (AGOTAMIENTO Y FATIGA) ---
        vigilantes.forEach(v => {
            const currentAsigs = [...(vigAsigs.get(v.dbId || '') || []), ...(vigAsigs.get(v.id) || [])];
            if (currentAsigs.length === 0) return;

            const diasTotales = currentAsigs.filter(x => x.a.jornada === 'normal').length;
            if (diasTotales > 20) {
                dispararAlerta(
                    `exceso_horas_${v.id}`,
                    `**ALERTA PREDICTIVA:** ${v.nombre} ha superado los 20 turnos este mes (${diasTotales * 12} horas). Detecto riesgo de fatiga cronica que pondra en peligro la seguridad del puesto. CorazAI sugiere descanso inmediato.`,
                    'high'
                );
            } else if (diasTotales > 17) {
                dispararAlerta(
                    `limite_horas_${v.id}`,
                    `**INSIGHT OPERATIVO:** ${v.nombre} se acerca al limite legal de horas. Recomiendo no asignar mas turnos extras para este vigilante.`,
                    'medium'
                );
            }

            // b. DIAs consecutivos (Fatiga acumulada)
            // Agrupamos todas sus asignaciones del mes y las ordenamos por dia
            const todasAsigs = currentAsigs.map(x => x.a).sort((a: any, b: any) => a.dia - b.dia);
            
            let consecutivos = 0;
            let maxConsecutivos = 0;
            
            todasAsigs.forEach((asig: any) => {
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
                    `**ALERTA DE SEGURIDAD:** ${v.nombre} lleva ${maxConsecutivos} dias seguidos trabajando sin descanso. Mi analisis predice una caida en su capacidad de alerta tactica. Exijo programar un dia de descanso.`,
                    'high'
                );
            }
        });
    };

    return null; 
};
