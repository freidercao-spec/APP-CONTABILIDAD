import { useEffect, useRef, useState } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';

/**
 * Hook para inicializar la carga de datos desde Supabase.
 * CORRECCIONES:
 * 1. Timeout reducido de 180s → 30s
 * 2. Programaciones solo se cargan DESPUÉS de que vigilantes y puestos terminen
 *    (para que el mapeo shorthand → UUID funcione correctamente)
 * 3. Se cargan mes anterior, actual y siguiente desde el inicio
 */
export function useSupabaseInit() {
    const didInit = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        console.log(`[INIT] ${msg}`);
        setLogs(prev => [...prev, msg]);
    };

    const fetchVigilantes = useVigilanteStore(s => s.fetchVigilantes);
    const fetchPuestos = usePuestoStore(s => s.fetchPuestos);
    const fetchProgramacionesByMonth = useProgramacionStore(s => s.fetchProgramacionesByMonth);
    const fetchTemplates = useProgramacionStore(s => s.fetchTemplates);
    const fetchAudit = useAuditStore(s => s.fetchEntries);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        const initBaseDatos = async () => {
            try {
                setIsLoading(true);
                addLog('📦 Conectando a Supabase...');

                // 1. CARGA CRÍTICA (Vigilantes y Puestos en paralelo)
                // CORRECCIÓN: Timeout reducido a 30s (era 180s = 3 minutos, inaceptable)
                addLog('🧬 Sincronizando DNA Operativo (Vigilantes y Puestos)...');
                const [vigRes, puestRes] = await Promise.allSettled([
                    Promise.race([
                        fetchVigilantes(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Vigilantes')), 30000))
                    ]),
                    Promise.race([
                        fetchPuestos(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Puestos')), 30000))
                    ])
                ]);

                if (vigRes.status === 'rejected') addLog('⚠️ Vigilantes lentos, continuando con datos parciales...');
                else addLog('✅ Vigilantes Listos');

                if (puestRes.status === 'rejected') addLog('⚠️ Puestos lentos, continuando con datos parciales...');
                else addLog('✅ Puestos Listos');

                // 2. CARGA DE PROGRAMACIONES
                // CORRECCIÓN CRÍTICA: Cargar programaciones DESPUÉS de vigilantes y puestos.
                // El mapeo de IDs (shorthand MED-0001 → UUID) requiere que los puestos y vigilantes
                // estén en memoria. Si se cargan en paralelo, los calendarios aparecen vacíos
                // porque translatePuestoToUuid y translateFromDb no encuentran nada.
                addLog('📑 Recuperando Programaciones y Auditoria...');

                const now = new Date();
                const anio = now.getFullYear();
                const mesActual = now.getMonth();

                // Cargar mes anterior + actual + siguiente para navegación fluida
                const mesesACargar = [
                    { anio: mesActual === 0 ? anio - 1 : anio, mes: mesActual === 0 ? 11 : mesActual - 1 },
                    { anio, mes: mesActual },
                    { anio: mesActual === 11 ? anio + 1 : anio, mes: mesActual === 11 ? 0 : mesActual + 1 },
                ];

                const secondWave = await Promise.allSettled([
                    ...mesesACargar.map(m => fetchProgramacionesByMonth(m.anio, m.mes)),
                    fetchTemplates(),
                    fetchAudit(),
                ]);

                const waveSuccess = secondWave.filter(r => r.status === 'fulfilled').length;
                addLog(`🚀 Sistema Listo (${waveSuccess}/${secondWave.length} módulos operativos).`);
            } catch (err: any) {
                addLog('⚠️ Alerta de Sistema: ' + (err.message || 'Error Desconocido'));
                console.error('[Coraza] ❌ Error Critico:', err);
            } finally {
                setTimeout(() => setIsLoading(false), 500);
            }
        };

        initBaseDatos();
    }, []);

    return { isLoading, logs };
}
