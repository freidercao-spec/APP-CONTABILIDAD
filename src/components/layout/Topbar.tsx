import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { useAIStore } from '../../store/aiStore';
import { useUIStore } from '../../store/uiStore';
import { useAppStore } from '../../store/appStore';

const PAGE_TITLE: Record<string, string> = {
    '/': 'Estadísticas',
    '/vigilantes': 'Gestión de Personal',
    '/disponibles': 'Personal Disponible',
    '/puestos': 'Mapa de Puestos',
    '/inteligencia': 'Inteligencia Operativa',
    '/novedades': 'Novedades Operativas',
    '/configuracion': 'Sistema Central',
    '/resumen': 'Resumen Programado',
    '/auditoria': 'Auditoría Interna',
    '/gestion-puestos': 'Puestos Activos',
};

const Topbar = () => {
    const [time, setTime] = React.useState(new Date());
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isTimeMenuOpen, setIsTimeMenuOpen] = React.useState(false);
    const [selectedTZ, setSelectedTZ] = React.useState({ label: 'Local (CO)', zone: 'America/Bogota' });
    
    const location = useLocation();
    const navigate = useNavigate();
    const vigilantes = useVigilanteStore((s) => s.vigilantes);
    const { topbarConfig } = useAppStore();

    // AI Integration
    const { unreadNotifications, toggleOpen, isOpen, isMuted, toggleMute } = useAIStore();
    const alertCount = (vigilantes.filter((v) => v.estado === 'ausente').length) + unreadNotifications;

    // UI Integration
    const toggleSidebar = useUIStore((s) => s.toggleSidebar);

    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Close menu on click outside
    const menuRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsTimeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const pageTitle = PAGE_TITLE[location.pathname] ?? 'Panel de Control';
    const breadcrumb = location.pathname === '/' ? 'Principal' : 'Módulos';

    return (
        <header className="h-[80px] lg:h-[120px] flex items-center justify-between px-4 sm:px-6 lg:px-10 bg-app-bg/60 backdrop-blur-2xl backdrop-saturate-150 shrink-0 sticky top-0 z-40 pointer-events-none border-b border-white/40 transition-all duration-500">
            {/* Left Area - Elite Breadcrumbs & Page Title */}
            <div className="flex items-center gap-4 pointer-events-auto flex-1 min-w-0">
                {/* Mobile Menu Button */}
                <button
                    onClick={toggleSidebar}
                    className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden transition-colors shrink-0"
                >
                    <span className="material-symbols-outlined text-[28px]">menu</span>
                </button>

                <div className="flex flex-col justify-center min-w-0 flex-1">
                    <nav className="hidden sm:flex items-center gap-3 mb-1 lg:mb-2">
                        <span className="text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">{topbarConfig.companyName}</span>
                        <span className="material-symbols-outlined text-[12px] text-slate-300">chevron_right</span>
                        <span className="text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">{breadcrumb}</span>
                        <span className="material-symbols-outlined text-[12px] text-slate-300">chevron_right</span>
                        <span className="text-[10px] lg:text-[11px] font-black text-primary uppercase tracking-[0.3em] truncate" style={{ color: topbarConfig.accentColor }}>{pageTitle}</span>
                    </nav>
                    <h2 className="text-[18px] sm:text-[22px] lg:text-[28px] font-black text-slate-900 tracking-tighter leading-none border-l-[3px] lg:border-l-4 border-primary pl-3 lg:pl-4 uppercase truncate" style={{ borderColor: topbarConfig.accentColor }}>{pageTitle}</h2>
                </div>
            </div>

            {/* Right Area - Floating Search and Actions Container */}
            <div className="flex items-center gap-2 sm:gap-3 p-2 bg-[#0b1424]/80 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] pointer-events-auto transition-all hover:bg-[#0b1424]/95 hover:border-white/20 shrink-0">

                {/* Search Bar - Elite Tactical */}
                {topbarConfig.showSearch && (
                    <div className="relative hidden xl:block w-[220px]">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                        </div>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-xs font-bold placeholder:text-slate-500 text-white focus:bg-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none transition-all shadow-inner"
                            placeholder="Navegación Rápida..."
                        />
                    </div>
                )}

                <div className="flex items-center gap-1.5 px-2 ml-1">
                    {/* Time Display - Progressive Dropdown */}
                    {topbarConfig.showClock && (
                        <div className="hidden xl:flex relative group/time mr-2" ref={menuRef}>
                            <button 
                                onClick={() => setIsTimeMenuOpen(!isTimeMenuOpen)}
                                className="flex flex-col items-center justify-center mr-3 pr-4 border-r border-white/10 hover:opacity-80 transition-all pointer-events-auto"
                            >
                                <p className="text-[14px] font-black text-white tracking-widest leading-none drop-shadow-md">
                                    {time.toLocaleTimeString('es-CO', { 
                                        hour: '2-digit', 
                                        minute: '2-digit', 
                                        hour12: false,
                                        timeZone: selectedTZ.zone 
                                    })}
                                </p>
                                <span className="text-[7px] font-black text-primary uppercase tracking-widest mt-1 opacity-60 group-hover/time:opacity-100 transition-opacity">
                                    {selectedTZ.label}
                                </span>
                            </button>

                            {isTimeMenuOpen && (
                                <div className="absolute top-full right-0 mt-4 w-48 bg-[#0b1424] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-1">Zona Horaria</p>
                                    {[
                                        { label: 'Local (CO)', zone: 'America/Bogota' },
                                        { label: 'Miami (US)', zone: 'America/New_York' },
                                        { label: 'Madrid (ES)', zone: 'Europe/Madrid' },
                                        { label: 'London (UK)', zone: 'Europe/London' },
                                    ].map((tz) => (
                                        <button
                                            key={tz.zone}
                                            onClick={() => {
                                                setSelectedTZ(tz);
                                                setIsTimeMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-between group/tz ${
                                                selectedTZ.zone === tz.zone ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                            style={{ backgroundColor: selectedTZ.zone === tz.zone ? topbarConfig.accentColor : undefined }}
                                        >
                                            <span>{tz.label}</span>
                                            {selectedTZ.zone === tz.zone && <span className="material-symbols-outlined text-[14px]">check</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <ActionButton
                        icon={isMuted ? "notifications_off" : "notifications_active"}
                        onClick={toggleMute}
                        accentColor={topbarConfig.accentColor}
                    />

                    {topbarConfig.showNotifications && (
                        <ActionButton
                            icon="notifications"
                            onClick={() => {
                                if (!isOpen) toggleOpen();
                            }}
                            badgeCount={alertCount}
                            accentColor={topbarConfig.accentColor}
                        />
                    )}

                    <ActionButton
                        icon="settings"
                        onClick={() => navigate('/configuracion')}
                        accentColor={topbarConfig.accentColor}
                    />
                </div>

                {/* User Mini Avatar - Horizon Style */}
                {topbarConfig.showUserAvatar && (
                    <div 
                        onClick={() => navigate('/configuracion')}
                        className="ml-0 sm:ml-2 size-9 sm:size-10 rounded-full overflow-hidden border-2 border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer hover:border-primary hover:scale-105 active:scale-95 transition-all shrink-0"
                        style={{ borderColor: topbarConfig.accentColor }}
                    >
                        <img src={topbarConfig.logoUrl || `https://ui-avatars.com/api/?name=Admin&background=${topbarConfig.accentColor.replace('#','')}&color=fff&bold=true`} alt="User" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>
        </header>
    );
};

const ActionButton = ({ icon, onClick, badgeCount, accentColor }: { icon: string; onClick: () => void; badgeCount?: number; accentColor?: string }) => (
    <button
        onClick={onClick}
        className={`relative p-2.5 flex items-center justify-center rounded-full transition-all duration-300 group ${badgeCount && badgeCount > 0
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_20px_rgba(67,24,255,0.3)] animate-pulse'
                : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
            }`}
        style={badgeCount && badgeCount > 0 ? { borderColor: `${accentColor}4D`, color: accentColor } : {}}
    >
        <span className={`material-symbols-outlined text-[20px] transition-transform duration-300 active:scale-90 group-hover:scale-110 ${badgeCount && badgeCount > 0 ? 'fill-[1]' : ''
            }`} translate="no">{icon}</span>
        {badgeCount !== undefined && badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full border border-white/20 shadow-[0_0_10px_rgba(255,0,0,0.5)] flex items-center justify-center text-[9px] font-black text-white animate-bounce shadow-lg">
                {badgeCount > 9 ? '9+' : badgeCount}
            </span>
        )}
    </button>
);

export default Topbar;
