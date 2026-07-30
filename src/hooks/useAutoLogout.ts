import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

export function useAutoLogout() {
    const logout = useAuthStore(s => s.logout);
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;

        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            
            timerRef.current = setTimeout(() => {
                toast.error('🔒 Sesión cerrada por inactividad por motivos de seguridad.', {
                    duration: 6000,
                });
                logout();
            }, INACTIVITY_TIMEOUT_MS);
        };

        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        
        events.forEach(event => {
            window.addEventListener(event, resetTimer, { passive: true });
        });

        // Iniciar temporizador
        resetTimer();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [isAuthenticated, logout]);
}
