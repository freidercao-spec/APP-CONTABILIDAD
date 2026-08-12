import { useEffect, useRef, useState } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';
import { useAuthStore } from '../store/authStore';

/**
 * Hook para inicializar la carga de datos desde Supabase.
 * CORRECCIONES CRÍTICAS:
 * 1. Monitorea `isAuthenticated` activamente para cargar los datos en cuanto el usuario inicie sesión.
 * 2. Carga Vigilantes, Puestos, Programaciones de 3 meses (anterior, actual, siguiente) y sus detalles.
 * 3. Activa canales Realtime y reanuda sincronizaciones pendientes.
 */
export function useSupabaseInit() {
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const didInitForUser = useRef<string | boolean>(false);
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
        if (!isAuthenticated) {
            setIsLoading(false);
            didInitForUser.current = false;
            return;
        }

        if (didInitForUser.current === true) return;
        didInitForUser.current = true;

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

                const mesesMap = new Map<string, { anio: number; mes: number }>();
                [
                    { anio: mesActual === 0 ? anio - 1 : anio, mes: mesActual === 0 ? 11 : mesActual - 1 },
                    { anio, mes: mesActual },
                    { anio: mesActual === 11 ? anio + 1 : anio, mes: mesActual === 11 ? 0 : mesActual + 1 },
                    { anio: 2026, mes: 7 } // Garantizar siempre la carga táctica de Agosto 2026
                ].forEach(m => mesesMap.set(`${m.anio}-${m.mes}`, m));

                const mesesACargar = Array.from(mesesMap.values());

                await Promise.all([
                    ...mesesACargar.map(m => retry(() => fetchProgramacionesByMonth(m.anio, m.mes))),
                    retry(() => fetchTemplates()),
                    retry(() => fetchAudit()),
                ]);

                // PRE-CARGA DE DETALLES (Crítico para que el dashboard no se vea vacío post-refresh)
                const currentProgs = useProgramacionStore.getState().programaciones.filter(p => (p.anio === anio && p.mes === mesActual) || (p.anio === 2026 && p.mes === 7));
                if (currentProgs.length > 0) {
                    addLog(`📥 Cargando detalles estratégicos (${currentProgs.length} puestos)...`);
                    await useProgramacionStore.getState()._fetchDetails(currentProgs, currentProgs.map(p => p.id));
                }

                // Activar Sincronización Realtime Global
                useVigilanteStore.getState().setupRealtime();
                usePuestoStore.getState().setupRealtime();
                useProgramacionStore.getState().setupRealtime();

                // REANUDAR MOTOR DE GUARDADO
                addLog('📡 Reanudando sincronizaciones pendientes...');
                useProgramacionStore.getState().resumePendingSyncs();

                addLog('🚀 Sistema Listo.');
            } catch (err: any) {
                console.error('[INIT ERROR]', err);
                addLog('❌ Error en inicialización: ' + err.message);
            } finally {
                setIsLoading(false);
            }
        };

        initBaseDatos();
    }, [isAuthenticated, fetchVigilantes, fetchPuestos, fetchProgramacionesByMonth, fetchTemplates, fetchAudit]);

    return { isLoading, logs };
}
