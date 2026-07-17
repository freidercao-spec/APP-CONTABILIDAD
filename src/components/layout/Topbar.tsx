import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { useAIStore } from '../../store/aiStore';
import { useUIStore } from '../../store/uiStore';
import { useAppStore } from '../../store/appStore';
import { usePuestoStore } from '../../store/puestoStore';

// ─── PAGE META ────────────────────────────────────────────────────────────────
const PAGE_META: Record<string, { title: string; icon: string; section: string }> = {
    '/':                { title: 'Estadísticas',          icon: 'dashboard',        section: 'Cuadro Operativo' },
    '/dashboard':       { title: 'Estadísticas',          icon: 'dashboard',        section: 'Cuadro Operativo' },
    '/vigilantes':      { title: 'Gestión de Personal',   icon: 'local_police',     section: 'Cuadro Operativo' },
    '/disponibles':     { title: 'Personal Disponible',   icon: 'group_add',        section: 'Cuadro Operativo' },
    '/puestos':         { title: 'Mapa de Puestos',       icon: 'hub',              section: 'Cuadro Operativo' },
    '/gestion-puestos': { title: 'Puestos Activos',       icon: 'event_note',       section: 'Cuadro Operativo' },
    '/resumen':         { title: 'Resumen / PDF',         icon: 'picture_as_pdf',   section: 'Cuadro Operativo' },
    '/inteligencia':    { title: 'Inteligencia IA',       icon: 'insights',         section: 'Inteligencia' },
    '/novedades':       { title: 'Novedades Operativas',  icon: 'warning_amber',    section: 'Inteligencia' },
    '/configuracion':   { title: 'Sistema Central',       icon: 'settings',         section: 'Control Central' },
    '/auditoria':       { title: 'Auditoría Interna',    icon: 'policy',           section: 'Control Central' },
};

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
const Topbar = () => {
    const [time, setTime] = React.useState(new Date());
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isTimeMenuOpen, setIsTimeMenuOpen] = React.useState(false);
    const [selectedTZ, setSelectedTZ] = React.useState({ label: 'CO', zone: 'America/Bogota' });
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);

    const location = useLocation();
    const navigate = useNavigate();
    const vigilantes = useVigilanteStore((s) => s.vigilantes);
    const puestos = usePuestoStore((s) => s.puestos);
    const { topbarConfig } = useAppStore();
    const { unreadNotifications, toggleOpen, isOpen, isMuted, toggleMute } = useAIStore();
    const toggleSidebar = useUIStore((s) => s.toggleSidebar);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const alertCount = vigilantes.filter(v => v.estado === 'ausente').length + unreadNotifications;

    // Online/Offline status listeners
    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Clock
    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Close time menu on outside click
    React.useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsTimeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const meta = PAGE_META[location.pathname] ?? PAGE_META['/'];

    // Timezones
    const timezones = [
        { label: 'CO', zone: 'America/Bogota' },
        { label: 'US', zone: 'America/New_York' },
        { label: 'ES', zone: 'Europe/Madrid' },
        { label: 'UK', zone: 'Europe/London' },
    ];

    return (
        <header className="
            h-[56px]
            flex items-center justify-between
            px-3 sm:px-4 lg:px-6
            bg-white
            border-b border-slate-200
            sticky top-0 z-30
            shadow-sm
            transition-all duration-150
        ">
            {/* ── LEFT: Breadcrumb + Title ────────────────────────── */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Mobile hamburger */}
                <button
                    id="mobile-menu-btn"
                    onClick={toggleSidebar}
                    className="
                        lg:hidden flex-shrink-0
                        size-9 flex items-center justify-center
                        rounded-xl text-slate-500
                        hover:bg-slate-100 hover:text-slate-900
                        active:scale-90 transition-all
                    "
                    aria-label="Abrir menú"
                >
                    <span className="material-symbols-outlined text-[22px]">menu</span>
                </button>
 
                {/* Page icon + title */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="hidden sm:flex size-9 rounded-xl bg-primary-soft border border-primary/20 items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-primary" translate="no">
                            {meta.icon}
                        </span>
                    </div>
                <div className="min-w-0">
                        <div className="hidden sm:flex items-center gap-1.5 mb-0.5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">
                                {topbarConfig.companyName || 'Coraza CTA'}
                            </span>
                            <span className="material-symbols-outlined text-[10px] text-slate-400">chevron_right</span>
                            <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] truncate">
                                {meta.section}
                            </span>
                        </div>
                        <h2
                            className="text-[13px] sm:text-[14px] font-black text-slate-950 tracking-tight leading-none uppercase truncate"
                            style={{ borderLeft: `2px solid ${topbarConfig.accentColor || '#0d6efd'}`, paddingLeft: '8px' }}
                        >
                            {meta.title}
                        </h2>
                    </div>
                </div>
            </div>

            {/* ── RIGHT: Actions pill ─────────────────────────────── */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-2 py-1.5 shadow-sm ml-3 shrink-0">

                {/* Search (xl+) */}
                {topbarConfig.showSearch && (
                    <div className="relative hidden xl:block w-[180px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[14px] pointer-events-none">search</span>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Búsqueda rápida..."
                            className="w-full bg-white border border-slate-200 rounded-full py-1.5 pl-8 pr-3 text-[11px] font-semibold text-slate-800 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                    </div>
                )}

                <div className="flex items-center gap-1 px-1">
                    {/* Data Status Indicator - compact */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full mr-2 shadow-sm">
                        <div className="flex items-center gap-1">
                            <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest tabular-nums">
                                {vigilantes.length} Vig.
                            </span>
                        </div>
                        <div className="w-[1px] h-3 bg-slate-200" />
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black text-primary uppercase tracking-widest tabular-nums">
                                {puestos.length} Ptos.
                            </span>
                        </div>
                        <div className="w-[1px] h-3 bg-slate-200" />
                        {isOnline ? (
                            <span className="size-1.5 bg-emerald-500 rounded-full" title="Conectado" />
                        ) : (
                            <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-600 rounded text-[7px] font-black uppercase border border-rose-200 animate-pulse">
                                OFF
                            </span>
                        )}
                    </div>

                    {/* Clock */}
                    {topbarConfig.showClock && (
                        <div className="relative hidden lg:block" ref={menuRef}>
                            <button
                                onClick={() => setIsTimeMenuOpen(v => !v)}
                                className="flex flex-col items-center px-3 py-1 mr-1 border-r border-slate-200 hover:opacity-80 transition-opacity"
                                aria-label="Cambiar zona horaria"
                            >
                                <span className="text-[12px] font-black text-slate-800 tracking-widest tabular-nums leading-none">
                                    {time.toLocaleTimeString('es-CO', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: false,
                                        timeZone: selectedTZ.zone,
                                    })}
                                </span>
                                <span className="text-[7px] font-black text-primary/80 uppercase tracking-widest mt-0.5">
                                    {selectedTZ.label}
                                </span>
                            </button>

                            {isTimeMenuOpen && (
                                <div className="absolute top-full right-0 mt-3 w-40 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-3 py-2 border-b border-slate-100 mb-1">
                                        Zona Horaria
                                    </p>
                                    {timezones.map(tz => (
                                        <button
                                            key={tz.zone}
                                            onClick={() => { setSelectedTZ(tz); setIsTimeMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-between ${
                                                selectedTZ.zone === tz.zone
                                                    ? 'bg-slate-900 text-white'
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`}
                                        >
                                            <span>{tz.label}</span>
                                            {selectedTZ.zone === tz.zone && (
                                                <span className="material-symbols-outlined text-[12px]">check</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mute toggle */}
                    <TopbarButton
                        icon={isMuted ? 'notifications_off' : 'notifications_active'}
                        onClick={toggleMute}
                        title={isMuted ? 'Activar sonido' : 'Silenciar'}
                        accent={topbarConfig.accentColor}
                    />

                    {/* Notifications */}
                    {topbarConfig.showNotifications && (
                        <TopbarButton
                            icon="notifications"
                            onClick={() => { if (!isOpen) toggleOpen(); }}
                            badge={alertCount}
                            title="Alertas del sistema"
                            accent={topbarConfig.accentColor}
                        />
                    )}

                    {/* Settings */}
                    <TopbarButton
                        icon="settings"
                        onClick={() => navigate('/configuracion')}
                        title="Configuración"
                        accent={topbarConfig.accentColor}
                    />
                </div>

                {/* User avatar */}
                {topbarConfig.showUserAvatar && (
                    <button
                        onClick={() => navigate('/configuracion')}
                        className="size-8 rounded-full overflow-hidden border border-slate-200 hover:border-primary/60 hover:scale-105 active:scale-95 transition-all shadow-sm"
                        title="Mi perfil"
                        style={{ borderColor: topbarConfig.accentColor ? `${topbarConfig.accentColor}66` : undefined }}
                    >
                        <img
                            src={topbarConfig.logoUrl || `https://ui-avatars.com/api/?name=Admin&background=0d6efd&color=fff&bold=true&size=64`}
                            alt="Usuario"
                            className="w-full h-full object-cover"
                        />
                    </button>
                )}
            </div>
        </header>
    );
};

// ─── TOPBAR BUTTON ────────────────────────────────────────────────────────────
interface TopbarButtonProps {
    icon: string;
    onClick: () => void;
    badge?: number;
    title?: string;
    accent?: string;
}

const TopbarButton = ({ icon, onClick, badge, title, accent }: TopbarButtonProps) => {
    const hasAlert = badge !== undefined && badge > 0;
    return (
        <button
            onClick={onClick}
            title={title}
            className={`
                relative p-1.5 rounded-lg flex items-center justify-center
                transition-all duration-150 group border
                ${hasAlert
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-55 border-slate-200 hover:border-slate-300'
                }
            `}
            style={hasAlert && accent ? { color: accent } : {}}
        >
            <span
                className={`material-symbols-outlined text-[16px] transition-transform duration-150 group-hover:scale-105 active:scale-95 ${hasAlert ? 'fill-[1]' : ''}`}
                translate="no"
            >
                {icon}
            </span>
            {hasAlert && (
                <span className="absolute -top-1 -right-1 size-4 bg-red-500 rounded-full border border-white text-[8px] font-bold text-white flex items-center justify-center animate-bounce shadow-sm">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
};

export default Topbar;
