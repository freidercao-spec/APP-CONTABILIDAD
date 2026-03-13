import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';

interface AuthState {
    isAuthenticated: boolean;
    username: string | null;
    role: string | null;
    userId: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    updateProfile: (name: string, role: string) => void;
    checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            username: null,
            role: null,
            userId: null,
            loading: true,

            login: async (email, password) => {
                try {
                    // Try Supabase Auth first
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (!error && data.user) {
                        // Fetch user profile from public.usuarios
                        const { data: profile } = await supabase
                            .from('usuarios')
                            .select('nombre_completo, rol')
                            .eq('id', data.user.id)
                            .single();

                        set({
                            isAuthenticated: true,
                            username: profile?.nombre_completo || data.user.email || 'Usuario',
                            role: profile?.rol || 'coordinador',
                            userId: data.user.id,
                            loading: false,
                        });
                        return true;
                    }

                    // Fallback: Demo mode credentials (for development/demo only)
                    const DEMO_USERS = [
                        { username: 'admin', password: 'coraza2026', role: 'Administrador Global', display: 'Cmdt. Operativo' },
                        { username: 'supervisor', password: 'coraza123', role: 'Supervisor', display: 'Supervisor de Turno' },
                    ];

                    const demoUser = DEMO_USERS.find(
                        u => u.username === email.toLowerCase() && u.password === password
                    );

                    if (demoUser) {
                        set({
                            isAuthenticated: true,
                            username: demoUser.display,
                            role: demoUser.role,
                            userId: null,
                            loading: false,
                        });
                        return true;
                    }

                    return false;
                } catch {
                    // If Supabase is unreachable, try demo mode
                    const DEMO_USERS = [
                        { username: 'admin', password: 'coraza2026', role: 'Administrador Global', display: 'Cmdt. Operativo' },
                        { username: 'supervisor', password: 'coraza123', role: 'Supervisor', display: 'Supervisor de Turno' },
                    ];
                    const demoUser = DEMO_USERS.find(
                        u => u.username === email.toLowerCase() && u.password === password
                    );
                    if (demoUser) {
                        set({ isAuthenticated: true, username: demoUser.display, role: demoUser.role, userId: null, loading: false });
                        return true;
                    }
                    return false;
                }
            },

            logout: async () => {
                try {
                    await supabase.auth.signOut();
                } catch { /* ignore */ }
                set({ isAuthenticated: false, username: null, role: null, userId: null, loading: false });
            },

            updateProfile: (username, role) => set({ username, role }),

            checkSession: async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        const { data: profile } = await supabase
                            .from('usuarios')
                            .select('nombre_completo, rol')
                            .eq('id', session.user.id)
                            .single();

                        set({
                            isAuthenticated: true,
                            username: profile?.nombre_completo || session.user.email || 'Usuario',
                            role: profile?.rol || 'coordinador',
                            userId: session.user.id,
                            loading: false,
                        });
                    } else {
                        // Keep existing auth state (for demo mode)
                        set({ loading: false });
                    }
                } catch {
                    set({ loading: false });
                }
            },
        }),
        {
            name: 'coraza-auth-v3',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.isAuthenticated = !!state.isAuthenticated;
                }
            }
        }
    )
);
