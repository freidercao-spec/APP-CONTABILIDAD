import { useEffect, useRef, useState } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';

/**
 * Hook para inicializar la carga de datos desde Supabase.
 * CORRECCION CRITICA: Se garantiza que fetchProgramaciones siempre se ejecuta
 * despues de que puestos y vigilantes esten listos, sin condiciones que lo bloqueen.
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
    const fetchProgramaciones = useProgramacionStore(s => s.fetchProgramaciones);
    const fetchTemplates = useProgramacionStore(s => s.fetchTemplates);
    const fetchAudit = useAuditStore(s => s.fetchEntries);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        const initBaseDatos = async () => {
            try {
                setIsLoading(true);
                addLog('📦 Conectando a Supabase...');
                
                // 1. CARGA CRÍTICA (Vigilantes y Puestos en paralelo para no sumarse tiempos)
                addLog('🧬 Sincronizando DNA Operativo (Vigilantes y Puestos)...');
                const [vigRes, puestRes] = await Promise.allSettled([
                    Promise.race([
                        fetchVigilantes(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Slow Vigilantes')), 90000))
                    ]),
                    Promise.race([
                        fetchPuestos(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Slow Puestos')), 90000))
                    ])
                ]);

                if (vigRes.status === 'rejected') addLog('⚠️ Vigilantes lentos, continuando...');
                else addLog('✅ Vigilantes Listos');

                if (puestRes.status === 'rejected') addLog('⚠️ Puestos lentos, continuando...');
                else addLog('✅ Puestos Listos');
                
                // 2. CARGA SECUNDARIA
                addLog('📑 Recuperando Programaciones y Auditoria...');
                const secondWave = await Promise.allSettled([
                    fetchProgramaciones(),
                    fetchTemplates(),
                    fetchAudit(),
                ]);
                
                const waveSuccess = secondWave.filter(r => r.status === 'fulfilled').length;
                addLog(`🚀 Sistema Listo (${waveSuccess}/3 módulos operativos).`);
            } catch (err: any) {
                addLog('⚠️ Alerta de Sistema: ' + (err.message || 'Error Desconocido'));
                console.error('[Coraza] ❌ Error Critico:', err);
            } finally {
                setTimeout(() => setIsLoading(false), 800);
            }
        };

        initBaseDatos();
    }, []); 

    return { isLoading, logs };
}
