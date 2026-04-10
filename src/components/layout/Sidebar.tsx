import { NavLink, useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { setAuditUser } from '../../store/auditStore';
import { useEffect, useState, useMemo } from 'react';
import { useAIStore } from '../../store/aiStore';
import { useVigilanteStore } from '../../store/vigilanteStore';

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
    <div className={collapsed ? 'px-1' : 'px-3'}>
        {!collapsed && (
            <p className="px-4 mb-2 text-[9px] font-black text-slate-500/70 uppercase tracking-[0.35em] select-none">
                {title}
            </p>
        )}
        {collapsed && <div className="mx-2 my-2 h-[1px] bg-white/10" />}
        <div className="space-y-0.5">{children}</div>
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
            `group relative flex items-center overflow-hidden transition-all duration-300 rounded-2xl ${
                collapsed ? 'justify-center mx-1 px-0 py-3' : 'gap-3 px-4 py-3 mx-1'
            } ${
                isActive
                    ? 'bg-primary shadow-[0_6px_20px_rgba(67,24,255,0.35)] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06] active:bg-white/10'
            }`
        }
    >
        {({ isActive }) => (
            <>
                {/* Active left indicator */}
                {isActive && !collapsed && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-white/80 rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                )}

                {/* Hover shimmer */}
                {!isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/8 to-transparent opacity-0 group-hover:opacity-100 -translate-x-full group-hover:translate-x-0 transition-all duration-500 pointer-events-none" />
                )}

                {/* Icon */}
                <span
                    className={`material-symbols-outlined shrink-0 relative z-10 transition-all duration-300 ${
                        collapsed ? 'text-[22px]' : 'text-[20px]'
                    } ${
                        isActive
                            ? 'text-white scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                            : 'group-hover:scale-110 group-hover:text-white'
                    }`}
                    translate="no"
                >
                    {icon}
                </span>

                {/* Label */}
                {!collapsed && (
                    <span
                        className={`text-[11px] font-black tracking-[0.08em] uppercase flex-1 relative z-10 transition-all duration-300 truncate ${
                            isActive ? 'text-white' : 'group-hover:text-white'
                        }`}
                    >
                        {label}
                    </span>
                )}

                {/* Badge (expanded) */}
                {badge && !collapsed && (
                    <div className="relative z-10 shrink-0">{badge}</div>
                )}

                {/* Active dot (expanded, no badge) */}
                {isActive && !badge && !collapsed && (
                    <div className="relative z-10 size-1.5 bg-white/80 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-pulse shrink-0" />
                )}

                {/* Badge dot (collapsed) */}
                {badge && collapsed && (
                    <div className="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.7)] z-20" />
                )}

                {/* Tooltip (collapsed) */}
                {collapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0b1437] border border-white/10 rounded-xl text-[11px] font-black text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-1 group-hover:translate-x-0 shadow-xl z-50">
                        {label}
                        {badge && <span className="ml-1 text-red-400">●</span>}
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
        ? <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-black rounded-full border border-indigo-400/20">{counts.activos}</span>
        : undefined;

    const BADGE_DISP = counts.disponibles > 0
        ? <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded-full border border-emerald-400/20">{counts.disponibles}</span>
        : undefined;

    const BADGE_AI = alertasIA > 0
        ? <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[9px] font-black rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse">{alertasIA}</span>
        : undefined;

    return (
        <>
            {/* ── PANEL ─────────────────────────────────────────── */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex flex-col
                    bg-gradient-to-b from-[#0b1437] via-[#091130] to-[#080e24]
                    border-r border-white/[0.07]
                    shadow-[4px_0_40px_rgba(0,0,0,0.5)]
                    transition-all duration-300 ease-out
                    lg:relative lg:z-auto lg:flex-shrink-0 lg:translate-x-0
                    ${c ? 'lg:w-[72px]' : 'lg:w-[272px]'}
                    ${isSidebarOpen ? 'translate-x-0 w-[272px]' : '-translate-x-full w-[272px]'}
                `}
            >
                {/* BG glows */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] -translate-y-1/4 translate-x-1/4" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[60px] translate-y-1/4 -translate-x-1/4" />
                </div>

                {/* ── LOGO ────────────────────────────────────── */}
                <div className={`relative flex flex-col items-center ${c ? 'pt-5 pb-4 px-2' : 'pt-8 pb-6 px-6'}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(67,24,255,0.1)_0%,_transparent_70%)] pointer-events-none" />

                    {/* Collapse toggle — desktop only */}
                    <button
                        onClick={toggleSidebarCollapse}
                        className="hidden lg:flex absolute top-3 right-2 size-7 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-slate-500 hover:text-white transition-all z-10 shrink-0"
                        title={c ? 'Expandir menú' : 'Colapsar menú'}
                    >
                        <span className="material-symbols-outlined text-[15px]">
                            {c ? 'chevron_right' : 'chevron_left'}
                        </span>
                    </button>

                    {/* Logo */}
                    <div className="relative group/logo">
                        <div className="absolute -inset-2 rounded-[24px] bg-primary/15 blur-xl opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
                        <div className={`relative bg-white p-2 shadow-[0_12px_30px_rgba(0,0,0,0.4)] transition-all duration-500 group-hover/logo:scale-105 ${c ? 'size-11 rounded-[14px]' : 'size-[72px] rounded-[22px]'}`}>
                            <img src="/logo.png" alt="CORAZA CTA" className="w-full h-full object-contain" />
                        </div>
                    </div>

                    {/* Brand text — hidden when collapsed */}
                    {!c && (
                        <div className="text-center mt-3 z-10">
                            <h1 className="text-[20px] font-black text-white tracking-[0.2em] leading-none">
                                CORAZA <span className="text-primary-light">CTA</span>
                            </h1>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1">
                                Seguridad de Élite
                            </p>
                            <div className="mt-3 flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1.5 justify-center">
                                <span className="size-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_#10b981] shrink-0" />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistemas Activos</span>
                            </div>
                        </div>
                    )}

                    {/* Collapsed status dot */}
                    {c && <div className="mt-2 size-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_#10b981] mx-auto" />}
                </div>

                {/* ── NAV ─────────────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 space-y-4">
                    <NavSection title="Cuadro Operativo" collapsed={c}>
                        <NavItem to="/"                icon="dashboard"      label="Estadísticas"       collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/vigilantes"       icon="local_police"   label="Vigilantes"         collapsed={c} onClick={closeSidebar} badge={BADGE_ACTIVOS} />
                        <NavItem to="/disponibles"      icon="group_add"      label="Disponibles"        collapsed={c} onClick={closeSidebar} badge={BADGE_DISP} />
                        <NavItem to="/puestos"          icon="hub"            label="Mapa de Puestos"    collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/gestion-puestos"  icon="event_note"     label="Puestos Activos"    collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/resumen"          icon="picture_as_pdf" label="Resumen / PDF"      collapsed={c} onClick={closeSidebar} />
                    </NavSection>

                    {!c && <div className="mx-4 h-[1px] bg-white/[0.05]" />}

                    <NavSection title="Inteligencia" collapsed={c}>
                        <NavItem to="/inteligencia" icon="insights"      label="Inteligencia IA"       collapsed={c} onClick={closeSidebar} badge={BADGE_AI} />
                        <NavItem to="/novedades"    icon="warning_amber" label="Novedades Operativas"  collapsed={c} onClick={closeSidebar} />
                    </NavSection>

                    {!c && <div className="mx-4 h-[1px] bg-white/[0.05]" />}

                    <NavSection title="Control Central" collapsed={c}>
                        <NavItem to="/configuracion" icon="settings" label="Sistema Central"   collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/auditoria"     icon="policy"   label="Auditoría Interna" collapsed={c} onClick={closeSidebar} />
                    </NavSection>
                </nav>

                {/* ── FOOTER / USER ───────────────────────────── */}
                <div className={`border-t border-white/[0.06] bg-black/20 ${c ? 'p-2' : 'p-3'}`}>
                    {c ? (
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={() => navigate('/configuracion')}
                                className="size-10 rounded-xl overflow-hidden border-2 border-primary/30 hover:border-primary/70 transition-colors"
                                title={username || 'Perfil'}
                            >
                                <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'A')}&background=4318FF&color=fff&bold=true&size=80`}
                                    alt="Usuario"
                                    className="w-full h-full object-cover"
                                />
                            </button>
                            <button
                                onClick={() => setShowLogoutModal(true)}
                                title="Cerrar Sesión"
                                className="size-8 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/[0.07] hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[15px]">logout</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-primary/20 rounded-2xl p-2.5 transition-all duration-300 group/user cursor-pointer"
                            onClick={() => navigate('/configuracion')}
                        >
                            <div className="size-9 rounded-xl overflow-hidden border-2 border-primary/30 shrink-0 group-hover/user:border-primary/60 transition-colors">
                                <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'Admin')}&background=4318FF&color=fff&bold=true&size=80`}
                                    alt="Usuario"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-white truncate uppercase tracking-tight group-hover/user:text-primary-light transition-colors">{username || 'Operador'}</p>
                                <p className="text-[8px] font-black text-primary-light/60 uppercase tracking-[0.15em] mt-0.5 truncate">{role || 'Staff'}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowLogoutModal(true); }}
                                title="Cerrar Sesión"
                                className="size-8 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/[0.07] hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all flex items-center justify-center shrink-0 active:scale-90"
                            >
                                <span className="material-symbols-outlined text-[15px]">logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── LOGOUT MODAL ──────────────────────────────────── */}
            {showLogoutModal && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ animation: 'fadeIn 0.2s ease-out' }}
                >
                    <div
                        className="absolute inset-0 bg-black/75 backdrop-blur-md"
                        onClick={() => setShowLogoutModal(false)}
                    />
                    <div
                        className="relative bg-[#0b1437] border border-white/10 rounded-[28px] p-8 w-full max-w-[340px] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
                        style={{ animation: 'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}
                    >
                        <div className="size-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-[28px] text-red-400">logout</span>
                        </div>
                        <h3 className="text-[17px] font-black text-white text-center uppercase tracking-tight mb-2">¿Cerrar Sesión?</h3>
                        
                        {useProgramacionStore.getState().hasPendingChanges() && (
                            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                                <span className="material-symbols-outlined text-amber-400 text-[18px]">cloud_sync</span>
                                <p className="text-[10px] font-black text-amber-300 uppercase leading-none">
                                    ¡Atención! Aún hay cambios sincronizando...
                                </p>
                            </div>
                        )}

                        <p className="text-slate-400 text-center text-[12px] font-medium mb-6 leading-relaxed">
                            Saldrás del sistema Coraza CTA. {useProgramacionStore.getState().hasPendingChanges() ? '⚠️ Se recomienda esperar a que termine la sincronización.' : 'Necesitarás tus credenciales para volver a ingresar.'}
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all text-[10px] uppercase tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-black transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] text-[10px] uppercase tracking-widest"
                            >
                                Sí, Salir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
