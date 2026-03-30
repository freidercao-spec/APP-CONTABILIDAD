import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
    // Mobile drawer
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
    openSidebar: () => void;

    // Desktop collapse (persistent preference)
    isSidebarCollapsed: boolean;
    toggleSidebarCollapse: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isSidebarOpen: false,
            toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
            closeSidebar: () => set({ isSidebarOpen: false }),
            openSidebar: () => set({ isSidebarOpen: true }),

            isSidebarCollapsed: false,
            toggleSidebarCollapse: () => set(s => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
        }),
        {
            name: 'coraza-ui-prefs',
            partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed }),
        }
    )
);
