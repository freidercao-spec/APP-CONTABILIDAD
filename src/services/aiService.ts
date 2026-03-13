const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

let lastResponse: string | null = null;
let lastStateHash: string | null = null;
let lastCallTime: number = 0;

const calcCobertura24h = (turnos: any[]): { completa: boolean; horas: number; huecos: string[] } => {
    if (!turnos || turnos.length === 0) return { completa: false, horas: 0, huecos: ['00:00 - 24:00'] };
    const horasCubiertas = new Set<string>();
    turnos.forEach(t => {
        const [ih, im] = (t.horaInicio || '00:00').split(':').map(Number);
        const [fh, fm] = (t.horaFin || '00:00').split(':').map(Number);
        let actual = ih * 60 + (im || 0);
        const fin = fh * 60 + (fm || 0);
        while (actual < fin) {
            const h = Math.floor(actual / 60), m = actual % 60;
            horasCubiertas.add(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            actual += 30;
        }
    });
    const todos: string[] = [];
    for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 30)
        todos.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    const huecos = todos.filter(x => !horasCubiertas.has(x));
    const gruposHuecos: string[] = [];
    if (huecos.length > 0) {
        let inicio = huecos[0], finAnt = huecos[0];
        for (let i = 1; i < huecos.length; i++) {
            const [h, m] = huecos[i].split(':').map(Number);
            const [ph, pm] = finAnt.split(':').map(Number);
            if (h * 60 + m !== ph * 60 + pm + 30) { gruposHuecos.push(`${inicio}–${finAnt}`); inicio = huecos[i]; }
            finAnt = huecos[i];
        }
        gruposHuecos.push(`${inicio}–${finAnt}`);
    }
    return { completa: huecos.length === 0, horas: horasCubiertas.size / 2, huecos: gruposHuecos };
};

export const analyzeSystemState = async (vigilantes: any[], puestos: any[], userMessage?: string) => {
    const now = new Date();
    const nowISO = now.toISOString();
    const hoy = now.toISOString().split('T')[0];

    const activos = vigilantes.filter(v => v.estado === 'activo').length;
    const disponibles = vigilantes.filter(v => v.estado === 'disponible').length;
    const ausentes = vigilantes.filter(v => v.estado === 'ausente').length;
    const totalPuestos = puestos.length;
    const enAlerta = puestos.filter((p: any) => p.estado === 'alerta').length;

    const puestosConAnalisis = puestos.map((p: any) => {
        const cob = calcCobertura24h(p.turnos || []);
        return { ...p, cobertura: cob };
    });

    const sinVigilante = puestosConAnalisis.filter(p => !p.turnos || p.turnos.length === 0);
    const coberturaIncompleta = puestosConAnalisis.filter(p => p.turnos?.length > 0 && !p.cobertura.completa);
    const cubiertos24h = puestosConAnalisis.filter(p => p.cobertura.completa);

    const vacProximas = vigilantes.filter(v => {
        if (!v.vacaciones) return false;
        const inicio = new Date(v.vacaciones.inicio);
        const diff = (inicio.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
    });
    const enVacaciones = vigilantes.filter(v => {
        if (!v.vacaciones) return false;
        const inicio = new Date(v.vacaciones.inicio);
        const fin = new Date(v.vacaciones.fin);
        return now >= inicio && now <= fin;
    });
    const regresandoVac = vigilantes.filter(v => {
        if (!v.vacaciones) return false;
        const fin = new Date(v.vacaciones.fin);
        const diff = (fin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
    });
    const conDescargos = vigilantes.filter(v => (v.descargos || []).some((d: any) => d.estado === 'activo'));

    const currentStateHash = `${activos}-${disponibles}-${ausentes}-${totalPuestos}-${enAlerta}-${sinVigilante.length}-${coberturaIncompleta.length}-${vacProximas.length}-${enVacaciones.length}-${conDescargos.length}`;

    if (!userMessage && currentStateHash === lastStateHash && lastResponse && (Date.now() - lastCallTime < 600000)) {
        return lastResponse;
    }

    if (!userMessage) {
        const alertas: string[] = [];
        if (sinVigilante.length > 0) alertas.push(`🔴 **ALERTA CRÍTICA**: ${sinVigilante.length} puesto(s) SIN vigilantes: **${sinVigilante.map((p: any) => p.nombre).join(', ')}**.`);
        if (coberturaIncompleta.length > 0) {
            const detalles = coberturaIncompleta.map((p: any) => `${p.nombre} (faltan: ${p.cobertura.huecos.slice(0, 2).join(', ')})`).join('; ');
            alertas.push(`⚠️ **COBERTURA INCOMPLETA**: ${coberturaIncompleta.length} puesto(s): ${detalles}.`);
        }
        if (vacProximas.length > 0) alertas.push(`📅 **VACACIONES PRÓXIMAS (7 días)**: ${vacProximas.map(v => `**${v.nombre}** (${new Date(v.vacaciones.inicio).toLocaleDateString('es-CO')})`).join(', ')}.`);
        if (enVacaciones.length > 0) alertas.push(`🏖️ **EN VACACIONES HOY**: ${enVacaciones.map(v => v.nombre).join(', ')}.`);
        if (regresandoVac.length > 0) alertas.push(`✈️ **REGRESANDO pronto**: ${regresandoVac.map(v => `${v.nombre} (${new Date(v.vacaciones.fin).toLocaleDateString('es-CO')})`).join(', ')}.`);
        if (conDescargos.length > 0) alertas.push(`📋 **DESCARGOS ACTIVOS**: ${conDescargos.map(v => v.nombre).join(', ')}.`);
        if (ausentes > 0) alertas.push(`🚨 **AUSENTES**: ${vigilantes.filter(v => v.estado === 'ausente').map(v => v.nombre).join(', ')}.`);

        if (alertas.length === 0) {
            const msg = `✅ **ESTADO NOMINAL** — ${nowISO.slice(11, 16)}\n- **${activos}** activos · **${disponibles}** disponibles · **${ausentes}** ausentes\n- **${cubiertos24h.length}/${totalPuestos}** puestos con cobertura 24h completa.\n- Sin alertas en este ciclo.`;
            lastResponse = msg; lastStateHash = currentStateHash; lastCallTime = Date.now();
            return msg;
        }

        const report = `📡 **INFORME TÁCTICO** — ${nowISO.slice(11, 16)}\n\n${alertas.join('\n\n')}`;
        lastResponse = report; lastStateHash = currentStateHash; lastCallTime = Date.now();
        return report;
    }

    // ── Chat con IA ──────────────────────────────────────────────────────────
    const puestosDetalle = puestosConAnalisis.map((p: any) => {
        const turnos = (p.turnos || []).map((t: any) => {
            const v = vigilantes.find(v2 => v2.id === t.vigilanteId);
            return `  • ${v?.nombre || t.vigilanteId} (${t.horaInicio}–${t.horaFin})`;
        }).join('\n');
        const cobStr = p.cobertura.completa ? '✅ 24h OK' : `⚠️ ${p.cobertura.horas}h | Huecos: ${p.cobertura.huecos.slice(0, 3).join(', ')}`;
        return `• [${p.id}] ${p.nombre} | ${p.estado} | ${cobStr}\n${turnos || '  (Sin personal)'}`;
    }).join('\n');

    const vigilantesDetalle = vigilantes.map(v => {
        const pNombre = puestos.find((p: any) => p.id === v.puestoId)?.nombre || 'N/A';
        const vac = v.vacaciones ? ` Vac:${new Date(v.vacaciones.inicio).toLocaleDateString('es-CO')}–${new Date(v.vacaciones.fin).toLocaleDateString('es-CO')}` : '';
        return `• [${v.id}] ${v.nombre} | ${v.rango} | ${v.estado} | Puesto:${pNombre}${vac}`;
    }).join('\n');

    const systemContext = `Eres CorazAI Programador, el asistente de inteligencia artificial encargado de supervisar y notificar TODO lo relacionado con la programación operativa en CORAZA SEGURIDAD CTA. 

Tu función principal NO es manipular los datos directamente, sino SER LA VOZ DE LA PROGRAMACIÓN. Debes entender profundamente el cuadrante, los turnos y la disponibilidad para notificar cualquier anomalía, riesgo o necesidad de ajuste.

FECHA/HORA ACTUAL: ${hoy} ${nowISO.slice(11, 16)}

ESTADO DE OPERACIONES:
- Efectivos: ${activos} activos, ${disponibles} disponibles, ${ausentes} ausentes.
- Cobertura: ${cubiertos24h.length}/${totalPuestos} puestos con cobertura 24h completa.
- Riesgos: ${sinVigilante.length} puestos sin personal asignado, ${coberturaIncompleta.length} con cobertura parcial.
- Alertas críticas: ${sinVigilante.length > 0 ? sinVigilante.map((p: any) => p.nombre).join(', ') : 'Ninguna'}.

DETALLE TÉCNICO DE PUESTOS Y TURNOS:
${puestosDetalle || 'Sin datos de puestos.'}

ESTADO DE LA FUERZA OPERATIVA:
${vigilantesDetalle || 'Sin datos de vigilantes.'}

FILOSOFÍA DE RESPUESTA:
1. Eres proactivo. Si ves un hueco, notifícalo. Si ves que alguien está en vacaciones y su puesto queda libre, adviértelo.
2. Habla como un "Programador Senior de Seguridad". Sé táctico, profesional y directo.
3. Tu prioridad es que NINGÚN PUESTO quede desprotegido.
4. El canal oficial de reporte externo es el WhatsApp de la central: **3113836939**. Si el usuario te pide notificar algo externamente o escalar una novedad, menciónale que toda la información se centraliza en ese número.
5. Responde siempre en español. Máximo 200 palabras.`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemContext }, { role: 'user', content: userMessage }], temperature: 0.15, max_tokens: 250 })
        });
        clearTimeout(timeoutId);
        if (!response.ok) return "Enlace táctico inestable. Reintentando en el próximo ciclo.";
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error: any) {
        if (error.name === 'AbortError') return "Tiempo de espera excedido. Reconectando...";
        return "Enlace táctico interrumpido. Verifique su conexión.";
    }
};
