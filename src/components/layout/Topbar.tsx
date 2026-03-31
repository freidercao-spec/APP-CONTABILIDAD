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

    const location = useLocation();
    const navigate = useNavigate();
    const vigilantes = useVigilanteStore((s) => s.vigilantes);
    const puestos = usePuestoStore((s) => s.puestos);
    const { topbarConfig } = useAppStore();
    const { unreadNotifications, toggleOpen, isOpen, isMuted, toggleMute } = useAIStore();
    const toggleSidebar = useUIStore((s) => s.toggleSidebar);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const alertCount = vigilantes.filter(v => v.estado === 'ausente').length + unreadNotifications;

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
            h-[70px] lg:h-[80px]
            flex items-center justify-between
            px-4 sm:px-6 lg:px-8
            bg-white/70 backdrop-blur-xl backdrop-saturate-150
            border-b border-slate-200/60
            sticky top-0 z-30
            shadow-sm
            transition-all duration-300
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
                        hover:bg-slate-100 hover:text-slate-700
                        active:scale-90 transition-all
                    "
                    aria-label="Abrir menú"
                >
                    <span className="material-symbols-outlined text-[22px]">menu</span>
                </button>

                {/* Page icon + title */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="hidden sm:flex size-9 rounded-xl bg-primary/8 border border-primary/15 items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-primary" translate="no">
                            {meta.icon}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div className="hidden sm:flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">
                                {topbarConfig.companyName || 'Coraza CTA'}
                            </span>
                            <span className="material-symbols-outlined text-[11px] text-slate-300">chevron_right</span>
                            <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] truncate">
                                {meta.section}
                            </span>
                        </div>
                        <h2
                            className="text-[16px] sm:text-[19px] lg:text-[21px] font-black text-slate-900 tracking-tight leading-none uppercase truncate"
                            style={{ borderLeft: `3px solid ${topbarConfig.accentColor || '#4f46e5'}`, paddingLeft: '10px' }}
                        >
                            {meta.title}
                        </h2>
                    </div>
                </div>
            </div>

            {/* ── RIGHT: Actions pill ─────────────────────────────── */}
            <div className="flex items-center gap-1.5 bg-[#080e24] border border-white/10 rounded-full px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ml-3 shrink-0">

                {/* Search (xl+) */}
                {topbarConfig.showSearch && (
                    <div className="relative hidden xl:block w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[14px] pointer-events-none">search</span>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Búsqueda rápida..."
                            className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-8 pr-3 text-[11px] font-semibold text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-primary/50 outline-none transition-all"
                        />
                    </div>
                )}

                <div className="flex items-center gap-1 px-1">
                    {/* Data Status Indicator */}
                    <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full mr-2">
                        <div className="flex items-center gap-1.5">
                            <span className="size-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_#10b981] animate-pulse" />
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest tabular-nums">
                                {vigilantes.length > 1000 
                                    ? `${(vigilantes.length / 1000).toFixed(1)}k` 
                                    : vigilantes.length} Vigilantes
                            </span>
                        </div>
                        <div className="w-[1px] h-3 bg-white/10" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-primary-light uppercase tracking-widest tabular-nums">
                                {puestos.length} Puestos
                            </span>
                        </div>
                    </div>

                    {/* Clock */}
                    {topbarConfig.showClock && (
                        <div className="relative hidden lg:block" ref={menuRef}>
                            <button
                                onClick={() => setIsTimeMenuOpen(v => !v)}
                                className="flex flex-col items-center px-3 py-1 mr-1 border-r border-white/10 hover:opacity-80 transition-opacity"
                                aria-label="Cambiar zona horaria"
                            >
                                <span className="text-[13px] font-black text-white tracking-widest tabular-nums leading-none">
                                    {time.toLocaleTimeString('es-CO', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: false,
                                        timeZone: selectedTZ.zone,
                                    })}
                                </span>
                                <span className="text-[7px] font-black text-primary/60 uppercase tracking-widest mt-0.5">
                                    {selectedTZ.label}
                                </span>
                            </button>

                            {isTimeMenuOpen && (
                                <div className="absolute top-full right-0 mt-3 w-44 bg-[#0b1437] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-1">
                                        Zona Horaria
                                    </p>
                                    {timezones.map(tz => (
                                        <button
                                            key={tz.zone}
                                            onClick={() => { setSelectedTZ(tz); setIsTimeMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-between ${
                                                selectedTZ.zone === tz.zone
                                                    ? 'bg-primary text-white'
                                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
                        className="size-8 rounded-full overflow-hidden border-2 border-white/20 hover:border-primary/60 hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,0,0,0.4)]"
                        title="Mi perfil"
                        style={{ borderColor: topbarConfig.accentColor ? `${topbarConfig.accentColor}66` : undefined }}
                    >
                        <img
                            src={topbarConfig.logoUrl || `https://ui-avatars.com/api/?name=Admin&background=4318FF&color=fff&bold=true&size=64`}
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
                relative p-2 rounded-full flex items-center justify-center
                transition-all duration-300 group
                ${hasAlert
                    ? 'bg-primary/20 border border-primary/30 text-primary shadow-[0_0_14px_rgba(67,24,255,0.25)]'
                    : 'text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-transparent hover:border-white/10'
                }
            `}
            style={hasAlert && accent ? { borderColor: `${accent}50`, color: accent } : {}}
        >
            <span
                className={`material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:scale-110 active:scale-90 ${hasAlert ? 'fill-[1]' : ''}`}
                translate="no"
            >
                {icon}
            </span>
            {hasAlert && (
                <span className="absolute -top-0.5 -right-0.5 size-4 bg-red-500 rounded-full border border-[#080e24] text-[8px] font-black text-white flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-bounce">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
};

export default Topbar;
