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

            login: async (email, password) => {
                set({ loading: true, error: null });

                try {
                    // LOGIN DE SOPORTE Y USUARIO PRINCIPAL (FAILSAFE)
                    if ((email === 'admin@coraza.com' && password === '123456') || 
                        (email === 'documental@corazaseguridadcta.com' && password === '124578')) {
                        console.log('✅ Acceso Garantizado');
                        set({
                            isAuthenticated: true,
                            username: email === 'admin@coraza.com' ? 'Soporte Coraza' : 'Documental Coraza',
                            role: 'admin',
                            userId: '00000000-0000-0000-0000-000000000000',
                            empresaId: 'a0000000-0000-0000-0000-000000000001',
                            loading: false,
                            error: null
                        });
                        return { success: true };
                    }

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
                // Si ya tenemos una sesion válida de Supabase, no la pises
                const current = get();
                if (current.isAuthenticated && current.userId && 
                    current.userId !== 'emergency-fix-id' && current.userId !== 'bypass-id') {
                    // Verificar que la sesión de Supabase sigue vigente
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.user) {
                            // Sesión venida a menos, limpiar
                            set({ isAuthenticated: false, empresaId: null, loading: false });
                            return;
                        }
                        set({ loading: false });
                        return;
                    } catch {
                        set({ loading: false });
                        return;
                    }
                }
                
                // Sesiones de bypass siempre se mantienen
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
                } catch (e) {
                    console.error('[AUTH] Error checking session:', e);
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
