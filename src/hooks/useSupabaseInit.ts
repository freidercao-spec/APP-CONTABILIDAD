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

    const fetchVigilantes = useVigilanteStore(s => s.fetchVigilantes);
    const vigilantesLoaded = useVigilanteStore(s => s.loaded);
    const fetchPuestos = usePuestoStore(s => s.fetchPuestos);
    const puestosLoaded = usePuestoStore(s => s.loaded);
    const fetchProgramaciones = useProgramacionStore(s => s.fetchProgramaciones);
    const fetchTemplates = useProgramacionStore(s => s.fetchTemplates);
    const fetchAudit = useAuditStore(s => s.fetchEntries);

    useEffect(() => {
        // Si ya se inicializo, no repetir
        if (didInit.current) return;
        didInit.current = true;

        console.log('[Coraza] 🚀 Iniciando carga de datos desde Supabase...');

        const initBaseDatos = async () => {
            try {
                setIsLoading(true);
                
                // 1. CRITICO: Cargar vigilantes primero (necesario para traducir IDs)
                await fetchVigilantes();
                console.log('[Coraza] ✅ Vigilantes cargados');

                // 2. CRITICO: Cargar puestos segundo (necesario para mapear programaciones)
                await fetchPuestos();
                console.log('[Coraza] ✅ Puestos cargados');
                
                // 3. Cargar todo lo demas en paralelo
                await Promise.all([
                    fetchProgramaciones(),
                    fetchTemplates(),
                    fetchAudit(),
                ]);
                
                console.log('[Coraza] ✅ Todos los datos cargados exitosamente');
            } catch (err) {
                console.error('[Coraza] ❌ Error al cargar datos desde Supabase:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initBaseDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Solo al montar - las dependencias estables se capturan por closure

    // Cuando puestos y vigilantes ya esten listos, marcar como no-cargando
    // (esto maneja el caso de cache local de Zustand que ya tenia datos)
    useEffect(() => {
        if (vigilantesLoaded && puestosLoaded) {
            // Si los stores tenian cache y ya estan cargados, solo esperamos el fetch de programaciones
            // que se inicio en el effect anterior
        }
    }, [vigilantesLoaded, puestosLoaded]);

    return { isLoading };
}
