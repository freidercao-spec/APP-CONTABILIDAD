import { useCallback } from 'react';
import { usePuestoStore } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import toast from 'react-hot-toast';
import { showTacticalToast } from '../utils/tacticalToast';

/**
 * Custom hook to handle cross-store tactical operations
 * Ensuring data consistency between Puestos and Vigilantes
 */
export const useTacticalOps = () => {
    const { assignGuard: storeAssignGuard, removeGuard: storeRemoveGuard, updatePuestoStatus } = usePuestoStore();
    const { updateGuardStatus, addActivity } = useVigilanteStore();

    const assignGuardToPuesto = useCallback((puestoId: string, vigilanteId: string, horaInicio: string, horaFin: string) => {
        try {
            // 1. Update Puesto Store
            storeAssignGuard(puestoId, vigilanteId, horaInicio, horaFin);
            
            // 2. Update Vigilante Store
            updateGuardStatus(vigilanteId, 'activo', puestoId);
            
            // 3. Update Puesto Status if it was desprotegido (the Puesto page effect handles this too, but we can be proactive)
            // updatePuestoStatus(puestoId, 'cubierto');
            
            addActivity(vigilanteId, 'Asignacion Tactica', `Desplegado en puesto ${puestoId} (${horaInicio} - ${horaFin})`);
        } catch (error) {
            console.error('Error in tactical assignment:', error);
            showTacticalToast({
                title: 'Falla de Despliegue',
                message: 'No se pudo completar la asignacion tactica del efectivo.',
                type: 'error'
            });
        }
    }, [storeAssignGuard, updateGuardStatus, addActivity]);

    const removeGuardFromPuesto = useCallback((puestoId: string, vigilanteId: string, reason?: string) => {
        try {
            // 1. Update Puesto Store
            storeRemoveGuard(puestoId, vigilanteId, reason);
            
            // 2. Update Vigilante Store
            updateGuardStatus(vigilanteId, 'disponible', undefined, reason);
            
            addActivity(vigilanteId, 'Desvinculacion', reason || 'Removido del puesto operativo');
        } catch (error) {
            console.error('Error in tactical removal:', error);
            showTacticalToast({
                title: 'Error Operativo',
                message: 'La desvinculacion del efectivo ha fallado.',
                type: 'error'
            });
        }
    }, [storeRemoveGuard, updateGuardStatus, addActivity]);

    const togglePuestoAlert = useCallback((puestoId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'alerta' ? 'cubierto' : 'alerta';
        updatePuestoStatus(puestoId, newStatus);
        
        if (newStatus === 'alerta') {
            showTacticalToast({
                title: 'Protocolo de Emergencia',
                message: `ALERTA ACTIVADA para el puesto ${puestoId}. Se requiere respuesta inmediata.`,
                type: 'error' // or 'warning', but 'error' is more red for emergency
            });
        } else {
            showTacticalToast({
                title: 'Situacion Controlada',
                message: `Puesto ${puestoId} normalizado. Amenaza neutralizada.`,
                type: 'success'
            });
        }
    }, [updatePuestoStatus]);

    return {
        assignGuardToPuesto,
        removeGuardFromPuesto,
        togglePuestoAlert
    };
};
