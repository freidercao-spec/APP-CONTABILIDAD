import { useEffect, useRef, useState } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAuditStore } from '../store/auditStore';

/**
 * Hook para inicializar la carga de datos desde Supabase.
 * Se ejecuta UNA VEZ cuando el usuario está autenticado.
 */
export function useSupabaseInit() {
    const didInit = useRef(false);
    const [initialFetchDone, setInitialFetchDone] = useState(false);

    const fetchVigilantes = useVigilanteStore(s => s.fetchVigilantes);
    const vigilantesLoaded = useVigilanteStore(s => s.loaded);
    const fetchPuestos = usePuestoStore(s => s.fetchPuestos);
    const puestosLoaded = usePuestoStore(s => s.loaded);
    const fetchProgramaciones = useProgramacionStore(s => s.fetchProgramaciones);
    const fetchTemplates = useProgramacionStore(s => s.fetchTemplates);
    const programacionLoaded = useProgramacionStore(s => s.loaded);
    const fetchAudit = useAuditStore(s => s.fetchEntries);

    useEffect(() => {
        if (!vigilantesLoaded || !puestosLoaded) return;
        if (initialFetchDone && vigilantesLoaded && puestosLoaded) return;

        if (didInit.current) {
            // Re-fetch if data was cleared (e.g., after localStorage rehydration)
            if (!programacionLoaded) {
                console.log('[Coraza] 🔄 Re-fetching programaciones after rehydration...');
                fetchProgramaciones();
                fetchTemplates();
            }
            return;
        }
        
        didInit.current = true;

        console.log('[Coraza] 🔄 Inicializando datos desde Supabase...');

        const initBaseDatos = async () => {
            try {
                // 1. MUST FETCH VIGILANTES FIRST
                await fetchVigilantes();

                // 2. MUST FETCH PUESTOS SECOND (required for programacion mapping)
                await fetchPuestos();
                
                // 3. Fetch the rest safely
                await Promise.all([
                    fetchProgramaciones(),
                    fetchTemplates(),
                    fetchAudit(),
                ]);
                
                setInitialFetchDone(true);
                console.log('[Coraza] ✅ Datos cargados exitosamente desde Supabase');
            } catch (err) {
                console.warn('[Coraza] ⚠️ Algunos datos no pudieron cargarse. Usando cache local.', err);
            }
        };

        initBaseDatos();
    }, [vigilantesLoaded, puestosLoaded, programacionLoaded]);

    return {
        isLoading: !vigilantesLoaded || !puestosLoaded || !programacionLoaded,
    };
}
