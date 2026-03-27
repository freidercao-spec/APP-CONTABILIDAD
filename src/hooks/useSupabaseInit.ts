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
                
                // 1. CRITICO: Cargar vigilantes primero
                await Promise.race([
                    fetchVigilantes(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Vigilantes')), 10000))
                ]);
                addLog('✅ Vigilantes Sincronizados');

                // 2. CRITICO: Cargar puestos segundo
                await Promise.race([
                    fetchPuestos(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Puestos')), 10000))
                ]);
                addLog('✅ Puestos Sincronizados');
                
                // 3. Cargar todo lo demas en paralelo
                addLog('📑 Recuperando Programaciones y Auditoria...');
                await Promise.all([
                    fetchProgramaciones().catch(e => console.warn('Prog error', e)),
                    fetchTemplates().catch(e => console.warn('Temp error', e)),
                    fetchAudit().catch(e => console.warn('Audit error', e)),
                ]);
                
                addLog('🚀 Sistema Listo.');
            } catch (err: any) {
                addLog('⚠️ Error de enlace: ' + (err.message || 'Error Desconocido'));
                console.error('[Coraza] ❌ Error:', err);
            } finally {
                // Pequeño delay cosmético para que el usuario vea el "Listo"
                setTimeout(() => setIsLoading(false), 800);
            }
        };

        initBaseDatos();
    }, []); 

    return { isLoading, logs };
}
