import { NavLink, useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { setAuditUser } from '../../store/auditStore';
import { useEffect, useState, useMemo } from 'react';
import { useAIStore } from '../../store/aiStore';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { useProgramacionStore } from '../../store/programacionStore';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface NavItemProps {
    to: string;
    icon: string;
    label: string;
    badge?: React.ReactNode;
    collapsed?: boolean;
    onClick?: () => void;
}

// ─── NAV SECTION ──────────────────────────────────────────────────────────────
const NavSection = ({
    title,
    children,
    collapsed,
}: {
    title: string;
    children: React.ReactNode;
    collapsed?: boolean;
}) => (
    <div className={collapsed ? 'px-1' : 'px-4'}>
        {!collapsed && (
            <div className="flex items-center gap-2 px-4 mb-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] select-none truncate">
                    {title}
                </span>
                <div className="flex-1 h-[1px] bg-white/5 min-w-[10px]" />
            </div>
        )}
        {collapsed && <div className="mx-2 my-4 h-[1px] bg-white/10" />}
        <div className="space-y-1">{children}</div>
    </div>
);

// ─── NAV ITEM ─────────────────────────────────────────────────────────────────
const NavItem = ({ to, icon, label, badge, collapsed, onClick }: NavItemProps) => (
    <NavLink
        to={to}
        end={to === '/'}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
            `group relative flex items-center overflow-hidden transition-all duration-300 rounded-[20px] ${
                collapsed ? 'justify-center mx-1 px-0 py-3.5' : 'gap-3.5 px-5 py-3.5 mx-1'
            } ${
                isActive
                    ? 'bg-[#5B6EE8] shadow-[0_10px_30px_rgba(91,110,232,0.4)] text-white'
                    : 'text-slate-500 hover:text-white hover:bg-white/[0.04] active:bg-white/08'
            }`
        }
    >
        {({ isActive }) => (
            <>
                {/* Active Indicator Pulse */}
                {isActive && !collapsed && (
                    <div className="absolute left-0 top-3 bottom-3 w-[4px] bg-white rounded-r-full shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                )}

                {/* Hover Glow */}
                {!isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                {/* Icon */}
                <span
                    className={`material-symbols-outlined shrink-0 relative z-10 transition-all duration-300 ${
                        collapsed ? 'text-[24px]' : 'text-[22px]'
                    } ${
                        isActive
                            ? 'text-white scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                            : 'group-hover:scale-110'
                    }`}
                    translate="no"
                >
                    {icon}
                </span>

                {/* Label */}
                {!collapsed && (
                    <span
                        className={`text-[11px] font-black tracking-normal uppercase flex-1 relative z-10 transition-colors duration-300 truncate ${
                            isActive ? 'text-white' : 'group-hover:text-white'
                        }`}
                    >
                        {label}
                    </span>
                )}

                {/* Badge (Solid Pill) */}
                {badge && !collapsed && (
                    <div className="relative z-10 shrink-0">{badge}</div>
                )}

                {/* Tooltip (collapsed) */}
                {collapsed && (
                    <div className="absolute left-full ml-4 px-3 py-2 bg-[#111827] border border-white/10 rounded-2xl text-[11px] font-black text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-2 group-hover:translate-x-0 shadow-2xl z-50">
                        {label}
                        {badge && <span className="ml-2 text-rose-400">●</span>}
                    </div>
                )}
            </>
        )}
    </NavLink>
);

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const Sidebar = () => {
    const { isSidebarOpen, closeSidebar, isSidebarCollapsed, toggleSidebarCollapse } = useUIStore();
    const { username, role, logout } = useAuthStore();
    const navigate = useNavigate();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const c = isSidebarCollapsed;

    useEffect(() => { setAuditUser(username || 'Operador'); }, [username]);

    const { actions } = useAIStore();
    const vigilantes = useVigilanteStore(s => s.vigilantes);

    const counts = useMemo(() => ({
        activos:     vigilantes.filter(v => v.estado === 'activo').length,
        disponibles: vigilantes.filter(v => v.estado === 'disponible').length,
    }), [vigilantes]);

    const alertasIA = useMemo(() =>
        actions.filter(a =>
            a.type === 'notification' &&
            a.sender === 'ai' &&
            (a.priority === 'high' || a.priority === 'medium')
        ).length
    , [actions]);

    const handleLogout = () => { setShowLogoutModal(false); logout(); };

    const BADGE_ACTIVOS = counts.activos > 0
        ? <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-2 bg-indigo-500 text-white text-[9px] font-black rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)]">{counts.activos}</span>
        : undefined;

    const BADGE_DISP = counts.disponibles > 0
        ? <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-2 bg-emerald-500 text-white text-[9px] font-black rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]">{counts.disponibles}</span>
        : undefined;

    const BADGE_AI = alertasIA > 0
        ? <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-2 bg-rose-500 text-white text-[9px] font-black rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse">{alertasIA}</span>
        : undefined;

    return (
        <>
            {/* ── PANEL ─────────────────────────────────────────── */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex flex-col
                    bg-[#0B1120]
                    border-r border-white/5
                    shadow-[10px_0_60px_rgba(0,0,0,0.6)]
                    transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    lg:relative lg:z-auto lg:flex-shrink-0 lg:translate-x-0
                    ${c ? 'lg:w-[84px]' : 'lg:w-[280px]'}
                    ${isSidebarOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full w-[280px]'}
                `}
            >
                {/* Visual accents */}
                <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-b from-[#5B6EE810] to-transparent pointer-events-none" />

                {/* ── LOGO ────────────────────────────────────── */}
                <div className={`relative flex flex-col items-center border-b border-white/5 ${c ? 'pt-6 pb-6 px-2' : 'pt-10 pb-8 px-8'}`}>
                    {/* Brand text */}
                    {!c && (
                        <div className="flex flex-col items-center mb-6">
                            <h1 className="text-[22px] font-black text-white tracking-[0.25em] italic">
                                CORAZA<span className="text-[#5B6EE8]">CTA</span>
                            </h1>
                            <div className="h-[2px] w-12 bg-[#5B6EE8] mt-1 shadow-[0_0_8px_#5B6EE8]" />
                        </div>
                    )}

                    {/* Logo Plate */}
                    <div className="relative group/logo">
                        <div className="absolute -inset-4 rounded-full bg-[#5B6EE815] blur-2xl opacity-0 group-hover/logo:opacity-100 transition-opacity duration-700" />
                        <div className={`relative flex items-center justify-center bg-white shadow-2xl transition-all duration-700 group-hover/logo:scale-105 ${c ? 'size-12 rounded-2xl' : 'size-20 rounded-[30px]'}`}>
                            <img src="/logo.png" alt="Logo" className="w-[70%] h-[70%] object-contain" />
                        </div>
                    </div>

                    {!c && (
                        <div className="mt-5 flex items-center gap-2.5 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
                            <div className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Sistemas Óptimos</span>
                        </div>
                    )}

                    {/* Collapse Button (Desktop) */}
                    <button
                        onClick={toggleSidebarCollapse}
                        className="hidden lg:flex absolute bottom-0 right-0 translate-x-1/2 -translate-y-1/2 size-8 items-center justify-center rounded-xl bg-[#111827] border border-white/10 text-slate-400 hover:text-white transition-all z-20 shadow-xl"
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {c ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                        </span>
                    </button>
                </div>

                {/* ── NAV ─────────────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-8 space-y-10">
                    <NavSection title="OPERACIONES" collapsed={c}>
                        <NavItem to="/"                icon="dashboard"      label="Estadísticas"       collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/vigilantes"       icon="shield_person"  label="Vigilantes"         collapsed={c} onClick={closeSidebar} badge={BADGE_ACTIVOS} />
                        <NavItem to="/disponibles"      icon="group_add"      label="Disponibles"        collapsed={c} onClick={closeSidebar} badge={BADGE_DISP} />
                        <NavItem to="/puestos"          icon="hub"            label="Mapa de Puestos"    collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/gestion-puestos"  icon="clinical_notes" label="Puestos Activos"    collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/resumen"          icon="picture_as_pdf" label="Resumen / PDF"      collapsed={c} onClick={closeSidebar} />
                    </NavSection>

                    <NavSection title="INTELIGENCIA" collapsed={c}>
                        <NavItem to="/inteligencia" icon="psychology"    label="Centro IA"          collapsed={c} onClick={closeSidebar} badge={BADGE_AI} />
                        <NavItem to="/novedades"    icon="report_problem" label="Incidentes"         collapsed={c} onClick={closeSidebar} />
                    </NavSection>

                    <NavSection title="SISTEMA" collapsed={c}>
                        <NavItem to="/configuracion" icon="settings"      label="Configuración"      collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/auditoria"     icon="security"      label="Auditoría"          collapsed={c} onClick={closeSidebar} />
                    </NavSection>
                </nav>

                {/* ── USER PANEL ───────────────────────────── */}
                <div className={`border-t border-white/5 bg-black/20 ${c ? 'p-3' : 'p-5'}`}>
                    <div 
                        className={`flex items-center gap-3 bg-white/03 p-1.5 rounded-[22px] border border-transparent transition-all group/user ${!c && 'hover:bg-white/05 hover:border-white/05'}`}
                        onClick={() => !c && navigate('/configuracion')}
                    >
                        <div className={`shrink-0 overflow-hidden border-2 border-[#5B6EE840] transition-all group-hover/user:border-[#5B6EE8] ${c ? 'size-10 rounded-xl' : 'size-11 rounded-2xl'}`}>
                            <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'A')}&background=5B6EE8&color=fff&bold=true&size=80`}
                                alt="U"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        
                        {!c && (
                            <div className="flex-1 min-w-0 pr-2">
                                <p className="text-[12px] font-black text-white truncate uppercase leading-tight">{username || 'Operador'}</p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">{role || 'Elite'}</p>
                            </div>
                        )}

                        {!c && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowLogoutModal(true); }}
                                className="size-9 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all flex items-center justify-center shrink-0"
                            >
                                <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* ── LOGOUT MODAL ──────────────────────────────────── */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowLogoutModal(false)} />
                    <div className="relative bg-[#0F172A] border border-white/10 rounded-[32px] p-10 w-full max-w-[380px] shadow-2xl overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px]" />
                        
                        <div className="size-16 rounded-[24px] bg-rose-500/20 flex items-center justify-center mx-auto mb-6 border border-rose-500/30">
                            <span className="material-symbols-outlined text-[32px] text-rose-500">logout</span>
                        </div>
                        
                        <h3 className="text-[22px] font-black text-white text-center uppercase tracking-tight mb-3 italic">¿Desconectar Enlace?</h3>
                        <p className="text-slate-400 text-center text-[13px] font-medium mb-8 leading-relaxed">
                            Finalizarás tu sesión actual en el Centro de Comando Tac. Todos los procesos activos quedarán en segundo plano.
                        </p>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                            >
                                Abortar
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 py-4 rounded-2xl bg-[#FF4C4C] hover:bg-[#FF3030] text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-rose-500/20"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
