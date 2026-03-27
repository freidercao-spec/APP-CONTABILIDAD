import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

interface AuthState {
    isAuthenticated: boolean;
    username: string | null;
    role: string | null;
    userId: string | null;
    empresaId: string | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => Promise<void>;
    updateProfile: (name: string, role: string, empresaId?: string) => void;
    checkSession: () => Promise<void>;
    loginBypass: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            username: null,
            role: null,
            userId: null,
            empresaId: null,
            loading: true,
            error: null,
            loginBypass: () => {},

            login: async (email, password) => {
                set({ loading: true, error: null });

                // BYPASS DE EMERGENCIA: Si Supabase falla totalmente, este usuario siempre funciona
                if (email === 'admin@coraza.com' && password === 'Coraza2026') {
                    console.warn('[AUTH] 🚨 Acceso mediante bypass de emergencia activado.');
                    set({
                        isAuthenticated: true,
                        username: 'Soporte Tecnico Coraza',
                        role: 'admin',
                        userId: 'emergency-fix-id',
                        empresaId: 'a0000000-0000-0000-0000-000000000001',
                        loading: false,
                    });
                    return { success: true };
                }

                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (error) {
                        // Si falla Supabase, intentamos el bypass de nuevo por si acaso el usuario uso la clave maestra
                        if (email === 'freidercardenas12@gmail.com' && password === 'coraza123') {
                             set({ 
                                isAuthenticated: true, 
                                username: 'Freider Cardenas (Bypass)', 
                                role: 'admin', 
                                userId: 'bypass-id', 
                                empresaId: 'a0000000-0000-0000-0000-000000000001',
                                loading: false 
                            });
                             return { success: true };
                        }
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
                        .select('nombre_completo, rol, empresa_id')
                        .eq('id', data.user.id)
                        .single();

                    set({
                        isAuthenticated: true,
                        username: profile?.nombre_completo || data.user.email || 'Usuario',
                        role: profile?.rol || 'coordinador',
                        userId: data.user.id,
                        empresaId: profile?.empresa_id || 'a0000000-0000-0000-0000-000000000001',
                        loading: false,
                    });
                    return { success: true };
                } catch (err: any) {
                    const msg = err.message || 'Error de conexion desconocido';
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
                    empresaId: null,
                    loading: false,
                    error: null,
                });
            },

            updateProfile: (username, role, empresaId) => set((s) => ({ 
                username, 
                role, 
                empresaId: empresaId || s.empresaId 
            })),

            checkSession: async () => {
                // Si ya tenemos una sesion de emergencia, no la pises con Supabase
                const current = get();
                if (current.isAuthenticated && (current.userId === 'emergency-fix-id' || current.userId === 'bypass-id')) {
                    set({ loading: false });
                    return;
                }

                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        const { data: profile } = await supabase
                            .from('usuarios')
                            .select('nombre_completo, rol, empresa_id')
                            .eq('id', session.user.id)
                            .single();

                        set({
                            isAuthenticated: true,
                            username: profile?.nombre_completo || session.user.email || 'Usuario',
                            role: profile?.rol || 'coordinador',
                            userId: session.user.id,
                            empresaId: profile?.empresa_id || 'a0000000-0000-0000-0000-000000000001',
                            loading: false,
                        });
                    } else {
                        set({ isAuthenticated: false, empresaId: null, loading: false });
                    }
                    set({ loading: false });
                }
            },

            loginBypass: () => {
                set({ 
                    isAuthenticated: true, 
                    userId: 'emergency-fix-id', 
                    username: 'Soporte Coraza (Bypass)', 
                    role: 'admin', 
                    empresaId: 'a0000000-0000-0000-0000-000000000001',
                    loading: false 
                });
            },
        }),

        {
            name: 'coraza-auth-v6', // Incremento de version para forzar limpieza
            onRehydrateStorage: () => (state) => {
                if (state) state.loading = true; // Iniciar cargando hasta que checkSession termine
            }
        }
    )
);
