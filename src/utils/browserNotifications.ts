/**
 * UTILIDAD DE NOTIFICACIONES PUSH DEL NAVEGADOR (WEB NOTIFICATION API)
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
        console.warn('[Notifications] El navegador no soporta notificaciones de escritorio.');
        return false;
    }
    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return Notification.permission === 'granted';
};

export const sendBrowserNotification = (title: string, body: string, iconUrl?: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body,
                icon: iconUrl || './logo.png',
                tag: 'coraza-alert',
                requireInteraction: false
            });
        } catch (err) {
            console.error('[Notifications] Error disparando notificacion nativa:', err);
        }
    }
};
