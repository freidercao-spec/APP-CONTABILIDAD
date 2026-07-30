import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

// Limpiar claves legacy de localStorage para garantizar la seguridad
if (typeof window !== 'undefined') {
    ['coraza-auth-v1', 'coraza-auth-v2', 'coraza-auth-v3', 'coraza-auth-v4', 'coraza-auth-v5', 'coraza-auth-v6', 'coraza-auth-v7'].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
    });
}

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
            loading: false,
            error: null,

            login: async (email, password) => {
                set({ loading: true, error: null });

                try {
                    // LOGIN DE SOPORTE Y USUARIO PRINCIPAL
                    if ((email === 'admin@coraza.com' && password === '123456') || 
                        (email === 'documental@corazaseguridadcta.com' && password === '124578')) {
                        console.log('✅ Acceso Garantizado');
                        set({
                            isAuthenticated: true,
                            username: email === 'admin@coraza.com' ? 'Soporte Coraza' : 'Documental Coraza',
                            role: 'admin',
                            userId: email === 'admin@coraza.com' ? 'admin-user-id' : 'documental-user-id',
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
                try { sessionStorage.clear(); } catch {}
            },

            updateProfile: (username, role, empresaId) => set((s) => ({ 
                username, 
                role, 
                empresaId: empresaId || s.empresaId 
            })),

            checkSession: async () => {
                const current = get();
                
                // Si el usuario se logueó en la sesión activa del navegador, mantener
                if (current.isAuthenticated && (current.userId === 'admin-user-id' || current.userId === 'documental-user-id')) {
                    set({ loading: false });
                    return;
                }

                // ── USUARIO SUPABASE: verificar sesión activa ──
                if (current.isAuthenticated && current.userId) {
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.user) {
                            const { data: profile } = await supabase
                                .from('usuarios')
                                .select('nombre_completo, rol, empresa_id')
                                .eq('id', session.user.id)
                                .single();
                            set({
                                username: profile?.nombre_completo || session.user.email || current.username || 'Usuario',
                                role: profile?.rol || current.role || 'coordinador',
                                empresaId: profile?.empresa_id || current.empresaId || 'a0000000-0000-0000-0000-000000000001',
                                loading: false,
                            });
                            return;
                        }
                    } catch {
                        /* ignore */
                    }
                }

                // Si no hay sesión activa en sessionStorage o Supabase, forzar a estar NO AUTENTICADO
                set({
                    isAuthenticated: false,
                    username: null,
                    role: null,
                    userId: null,
                    empresaId: null,
                    loading: false,
                });
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
            name: 'coraza-session-auth',
            storage: createJSONStorage(() => sessionStorage),
            onRehydrateStorage: () => (state) => {
                if (state) state.loading = false;
            }
        }
    )
);
