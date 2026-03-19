import React from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from 'react-hot-toast';
import { showTacticalToast } from '../utils/tacticalToast';
import { supabase, EMPRESA_ID } from '../lib/supabase';

export interface AIAction {
    id: string;
    text: string;
    timestamp: number;
    type: 'notification' | 'chat';
    sender: 'ai' | 'user';
    priority?: 'low' | 'medium' | 'high';
}

interface AIState {
    actions: AIAction[];
    isAnalyzing: boolean;
    isOpen: boolean;
    isMuted: boolean;
    unreadNotifications: number;
    addAction: (action: Omit<AIAction, 'id' | 'timestamp'>) => void;
    setAnalyzing: (val: boolean) => void;
    toggleOpen: () => void;
    toggleMute: () => void;
    clearUnread: () => void;
    clearChat: () => void;
    clearHistory: () => void;
}

export const useAIStore = create<AIState>()(
    persist(
        (set) => ({
            actions: [{
                id: 'init-msg',
                text: 'CorazAI Programador Iniciado. Estoy supervisando la integridad de toda la programacion y turnos del sistema.',
                timestamp: Date.now(),
                type: 'notification',
                sender: 'ai',
                priority: 'low'
            }],
            isAnalyzing: false,
            isOpen: false,
            isMuted: false,
            unreadNotifications: 1,
            addAction: (action) => set((state) => {
                const isFromAI = action.sender === 'ai';
                const isClosed = !state.isOpen;
                
                // Auto-determine priority if not provided
                let priority: AIAction['priority'] = action.priority || 'low';
                if (!action.priority) {
                    if (action.text.toLowerCase().includes('alerta') || action.text.toLowerCase().includes('critico') || action.text.toLowerCase().includes('atencion')) {
                        priority = 'high';
                    } else if (action.text.toLowerCase().includes('aviso') || action.text.toLowerCase().includes('revisar') || action.text.toLowerCase().includes('insight')) {
                        priority = 'medium';
                    }
                }

                if (isFromAI && isClosed && !state.isMuted) {
                    // --- SISTEMA DE NOTIFICACIONES FILTRADO POR RELEVANCIA ---
                    
                    // Solo enviamos WhatsApp automatico si es prioridad HIGH y viene del sistema
                    if (priority === 'high') {
                        const cleanMsg = action.text.replace(/\*\*(.*?)\*\*/g, '$1');
                        
                        // Disparo asincrono a Supabase Edge Function
                        supabase.functions.invoke('enviar-whatsapp', {
                            body: {
                                numero: '573113836939',
                                mensaje: `🚨 ALERTA CORAZAI: ${cleanMsg}`,
                                tipo_alerta: 'critica'
                            }
                        }).then(({ data, error }) => {
                            if (error) {
                                console.error('Error enviando WhatsApp automatico:', error);
                                // Notificacion discreta de fallo tecnico
                                showTacticalToast({
                                    title: 'Falla de Comunicaciones',
                                    message: 'Enlace WhatsApp interrumpido. Verifique Supabase Edge Functions.',
                                    type: 'error'
                                });
                            } else {
                                console.log('WhatsApp automatico enviado correctamente:', data);
                            }
                        });
                    }
                    
                    // 1. ALTA PRIORIDAD: Toast tactico expandido (Maxima visibilidad)
                    if (priority === 'high') {
                        let rawText = action.text.replace(/\*\*(.*?)\*\*/g, '$1');
                        showTacticalToast({
                            title: 'Protocolo Critico',
                            message: rawText,
                            type: 'ai',
                            duration: 10000,
                            action: {
                                label: 'Reportar WhatsApp',
                                href: `https://wa.me/573113836939?text=${encodeURIComponent(`🚨 ALERTA CORAZAI: ${rawText}`)}`
                            }
                        });
                    } 
                    // 2. MEDIA PRIORIDAD: Toast tactico refinado (Informativo pero premium)
                    else if (priority === 'medium') {
                        let rawText = action.text.replace(/\*\*(.*?)\*\*/g, '$1');
                        showTacticalToast({
                            title: 'Sugerencia Operativa',
                            message: rawText,
                            type: 'ai',
                            duration: 7000
                        });
                    }
                    // 3. BAJA PRIORIDAD: Silencioso (Solo badge en la campana)
                    // No hace nada, el usuario lo vera al abrir el panel o por el contador de Topbar.
                }

                // --- SYNC TO SUPABASE (NOVEDADES) ---
                if (isFromAI && priority !== 'low') {
                    const rawText = action.text.replace(/\*\*(.*?)\*\*/g, '$1');
                    supabase.from('novedades').insert({
                        empresa_id: EMPRESA_ID,
                        tipo: 'IA_INSIGHT',
                        titulo: priority === 'high' ? 'ALERTA CRITICA CORAZAI' : 'Aviso Operativo',
                        descripcion: rawText,
                        gravedad: priority === 'high' ? 'alta' : 'media',
                        estado: 'pendiente'
                    }).then(({ error }) => {
                        if (error) console.error('Error syncing AI novelty to Supabase:', error);
                    });
                }

                return {
                    actions: [...state.actions, {
                        ...action,
                        id: Math.random().toString(36).substr(2, 9),
                        timestamp: Date.now(),
                        priority
                    }],
                    unreadNotifications: (isClosed && isFromAI) ? state.unreadNotifications + 1 : state.unreadNotifications
                };
            }),
            setAnalyzing: (val) => set({ isAnalyzing: val }),
            toggleOpen: () => set((state) => ({
                isOpen: !state.isOpen,
                unreadNotifications: 0
            })),
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            clearUnread: () => set({ unreadNotifications: 0 }),
            clearChat: () => set((state) => ({
                actions: state.actions.filter(a => a.type !== 'chat')
            })),
            clearHistory: () => set({
                actions: [{
                    id: 'init-msg-' + Date.now(),
                    text: 'Historial purgado. CorazAI Programador reinicializado. Monitoreando cuadrantes...',
                    timestamp: Date.now(),
                    type: 'notification',
                    sender: 'ai',
                    priority: 'low'
                }]
            })
        }),
        {
            name: 'coraza-ai-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ actions: state.actions }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.actions = state.actions || [];
                }
            }
        }
    )
);
