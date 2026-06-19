import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';

export const idsMatch = (id1: string | null | undefined, id2: string | null | undefined): boolean => {
    if (!id1 || !id2) return id1 === id2;
    const s1 = String(id1).trim();
    const s2 = String(id2).trim();
    if (s1 === s2) return true;
    
    const vStore = useVigilanteStore.getState();
    const pStore = usePuestoStore.getState();

    const v1 = vStore.vigilantes?.find(v => v.id === s1 || v.dbId === s1);
    const v2 = vStore.vigilantes?.find(v => v.id === s2 || v.dbId === s2);
    if (v1 && v2 && (v1.id === v2.id || v1.dbId === v2.dbId)) return true;

    const p1 = pStore.puestos?.find(p => p.id === s1 || p.dbId === s1);
    const p2 = pStore.puestos?.find(p => p.id === s2 || p.dbId === s2);
    if (p1 && p2 && (p1.id === p2.id || p1.dbId === p2.dbId)) return true;

    return false;
};

export const translatePuestoToUuid = (id: string | null): string | null => {
    if (!id) return null;
    const pStore = usePuestoStore.getState();
    const found = pStore.puestos?.find(p => p.id === id || p.dbId === id);
    return found?.dbId || id;
};

export const translateToUuid = (id: string | null): string | null => {
    if (!id) return null;
    const vStore = useVigilanteStore.getState();
    const found = vStore.vigilantes?.find(v => v.id === id || v.dbId === id);
    return found?.dbId || id;
};

export const translateToReadableId = (dbId: string): string => {
    const pStore = usePuestoStore.getState();
    const found = pStore.puestos?.find(p => p.dbId === dbId || p.id === dbId);
    return found?.id || dbId;
};
