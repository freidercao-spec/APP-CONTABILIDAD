import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, EMPRESA_ID } from '../lib/supabase';

export type AuditModule =
    | 'LOGIN'
    | 'VIGILANTES'
    | 'PUESTOS'
    | 'PROGRAMACION'
    | 'NOVEDADES'
    | 'RESUMEN'
    | 'CONFIGURACION'
    | 'INTELIGENCIA'
    | 'SISTEMA';

export type AuditSeverity = 'info' | 'warning' | 'critical' | 'success';

export interface AuditEntry {
    id: string;
    timestamp: string;
    module: AuditModule;
    action: string;
    details: string;
    user: string;
    severity: AuditSeverity;
}

interface AuditState {
    entries: AuditEntry[];
    loaded: boolean;
    logAction: (
        module: AuditModule,
        action: string,
        details: string,
        severity?: AuditSeverity
    ) => void;
    clearAll: () => void;
    fetchEntries: () => Promise<void>;
}

let _currentUser = 'Sistema';
export const setAuditUser = (name: string) => { _currentUser = name; };

export const useAuditStore = create<AuditState>()(
    persist(
        (set, get) => ({
            entries: [],
            loaded: false,

            logAction: async (module, action, details, severity = 'info') => {
                const entry: AuditEntry = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    module,
                    action,
                    details,
                    user: _currentUser,
                    severity,
                };

                // Optimistic local update (keep latest 500)
                const entries = [entry, ...get().entries].slice(0, 500);
                set({ entries });

                // Write to Supabase
                try {
                    await supabase.from('auditoria').insert({
                        id: entry.id,
                        empresa_id: EMPRESA_ID,
                        modulo: module,
                        accion: action,
                        detalles: details,
                        usuario: _currentUser,
                        severidad: severity,
                    });
                } catch (err) {
                    console.error('Error logging audit to Supabase:', err);
                }
            },

            clearAll: () => set({ entries: [] }),

            fetchEntries: async () => {
                try {
                    const { data: rows } = await supabase
                        .from('auditoria')
                        .select('*')
                        .eq('empresa_id', EMPRESA_ID)
                        .order('created_at', { ascending: false })
                        .limit(500);

                    if (rows) {
                        const entries: AuditEntry[] = rows.map(r => ({
                            id: r.id,
                            timestamp: r.created_at,
                            module: r.modulo as AuditModule,
                            action: r.accion,
                            details: r.detalles || '',
                            user: r.usuario,
                            severity: r.severidad as AuditSeverity,
                        }));
                        set({ entries, loaded: true });
                    }
                } catch (err) {
                    console.error('Error fetching audit entries:', err);
                    set({ loaded: true });
                }
            },
        }),
        {
            name: 'coraza-audit-v2',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.entries = state.entries || [];
                }
            }
        }
    )
);
