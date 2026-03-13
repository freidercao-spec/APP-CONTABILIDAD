import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPRESA_ID } from '../lib/supabase';

interface UserInfo {
    id: string;
    nombre: string;
    rol: string;
    foto?: string;
}

export interface TopbarConfig {
    companyName: string;
    showSearch: boolean;
    showClock: boolean;
    showNotifications: boolean;
    showUserAvatar: boolean;
    accentColor: string;
    logoUrl?: string;
}

export interface ShiftPreset {
    id: string;
    label: string;
    value: string;
    color: string;
}

interface AppState {
    user: UserInfo | null;
    currentEmpresaId: string | null;
    isDarkMode: boolean;
    soundEnabled: boolean;
    topbarConfig: TopbarConfig;
    shiftPresets: ShiftPreset[];

    // Actions
    setUser: (user: UserInfo | null) => void;
    setCurrentEmpresa: (id: string) => void;
    toggleTheme: () => void;
    toggleSound: () => void;
    setTopbarConfig: (config: Partial<TopbarConfig>) => void;
    setShiftPresets: (presets: ShiftPreset[]) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            user: { id: 'admin123', nombre: 'Cmdt. Operativo', rol: 'Admin Global' },
            currentEmpresaId: EMPRESA_ID,
            isDarkMode: true,
            soundEnabled: true,
            topbarConfig: {
                companyName: 'CORAZA SEGURIDAD',
                showSearch: true,
                showClock: true,
                showNotifications: true,
                showUserAvatar: true,
                accentColor: '#4318FF',
            },
            shiftPresets: [
                { id: '1', label: 'MAÑANA', value: '06:00', color: '#f59e0b' },
                { id: '2', label: 'TARDE', value: '14:00', color: '#3b82f6' },
                { id: '3', label: 'NOCHE', value: '18:00', color: '#8b5cf6' },
                { id: '4', label: 'RELEVO', value: '22:00', color: '#6366f1' },
                { id: '5', label: 'MEDIO D', value: '00:00', color: '#64748b' },
            ],

            setUser: (user) => set({ user }),
            setCurrentEmpresa: (id) => set({ currentEmpresaId: id }),
            toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
            toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
            setTopbarConfig: (changes) => set((state) => ({
                topbarConfig: { ...state.topbarConfig, ...changes }
            })),
            setShiftPresets: (presets) => set({ shiftPresets: presets }),
        }),
        { name: 'coraza-app-v2' }
    )
);
