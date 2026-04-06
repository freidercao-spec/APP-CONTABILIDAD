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

        const retry = async <T>(fn: () => Promise<T>, retries = 2): Promise<T> => {
            try {
                return await fn();
            } catch (err) {
                if (retries > 0) return retry(fn, retries - 1);
                throw err;
            }
        };

        const initBaseDatos = async () => {
            try {
                setIsLoading(true);
                addLog('📦 Conectando a Supabase...');

                addLog('🧬 Sincronizando DNA Operativo (Vigilantes y Puestos)...');
                const [vigRes, puestRes] = await Promise.allSettled([
                    retry(() => Promise.race([
                        fetchVigilantes(addLog),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Vigilantes')), 30000))
                    ])),
                    retry(() => Promise.race([
                        fetchPuestos(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Puestos')), 30000))
                    ]))
                ]);

                if (vigRes.status === 'rejected') addLog('⚠️ Vigilantes: ' + (vigRes.reason?.message || 'Error'));
                else addLog('✅ Vigilantes Listos');
                if (puestRes.status === 'rejected') addLog('⚠️ Puestos: ' + (puestRes.reason?.message || 'Error'));
                else addLog('✅ Puestos Listos');

                addLog('📑 Recuperando Programaciones y Auditoria...');

                const now = new Date();
                const anio = now.getFullYear();
                const mesActual = now.getMonth();

                const mesesACargar = [
                    { anio: mesActual === 0 ? anio - 1 : anio, mes: mesActual === 0 ? 11 : mesActual - 1 },
                    { anio, mes: mesActual },
                    { anio: mesActual === 11 ? anio + 1 : anio, mes: mesActual === 11 ? 0 : mesActual + 1 },
                ];

                await Promise.all([
                    ...mesesACargar.map(m => retry(() => fetchProgramacionesByMonth(m.anio, m.mes))),
                    retry(() => fetchTemplates()),
                    retry(() => fetchAudit()),
                ]);

                addLog('🚀 Sistema Listo.');
            } catch (err: any) {
                addLog('⚠️ Error crítico de inicialización: ' + (err.message || 'Desconocido'));
                console.error('[Coraza] ❌ Error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initBaseDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { isLoading, logs };
}
