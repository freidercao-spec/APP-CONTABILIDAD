import { create } from 'zustand';
export const useProgramacionStore = create(() => ({
  programaciones: [],
  fetchProgramaciones: async () => {},
  personal: [],
  asignaciones: []
}));
export const idsMatch = (a: any, b: any) => a === b;
export const translatePuestoToUuid = (id: any) => id;
export const translateToUuid = (id: any) => id;
export const translateToReadableId = (id: any) => id;
export const translateFromDb = (id: any) => id;
export const translateToDb = (id: any) => id;
export const calculatePuestoStats = () => ({});
