import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

interface AuthState {
    isAuthenticated: boolean;
    username: string | null;
    role: string | null;
    userId: string | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => Promise<void>;
    updateProfile: (name: string, role: string) => void;
    checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            isAuthenticated: false,
            username: null,
            role: null,
            userId: null,
            loading: true,
            error: null,

            login: async (email, password) => {
                set({ loading: true, error: null });
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (error) {
                        set({ loading: false, error: error.message });
                        return { success: false, message: error.message };
                    }

                    if (!data.user) {
                        set({ loading: false, error: 'No se pudo obtener el usuario.' });
                        return { success: false, message: 'No se pudo obtener el usuario.' };
                    }

                    // Obtener perfil
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
                    return { success: true };
                } catch (err: any) {
                    const msg = err.message || 'Error de conexión desconocido';
                    set({ loading: false, error: msg });
                    return { success: false, message: msg };
                }
            },

            logout: async () => {
                try {
                    await supabase.auth.signOut();
                } catch { /* ignore */ }
                set({
                    isAuthenticated: false,
                    username: null,
                    role: null,
                    userId: null,
                    loading: false,
                    error: null,
                });
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
                        set({ isAuthenticated: false, loading: false });
                    }
                } catch {
                    set({ loading: false });
                }
            },
        }),
        {
            name: 'coraza-auth-v6', // Incremento de versión para forzar limpieza
            onRehydrateStorage: () => (state) => {
                if (state) state.loading = true; // Iniciar cargando hasta que checkSession termine
            }
        }
    )
);
