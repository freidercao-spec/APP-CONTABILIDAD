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
}

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
            <div className="flex items-center gap-2 px-4 mb-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] select-none truncate">
                    {title}
                </span>
                <div className="flex-1 h-[1px] bg-slate-200 min-w-[10px]" />
            </div>
        )}
        {collapsed && <div className="mx-2 my-3 h-[1px] bg-slate-200" />}
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
            `group relative flex items-center overflow-hidden transition-all duration-150 rounded-[12px] border ${
                collapsed ? 'justify-center mx-1 px-0 py-3' : 'gap-3 px-4 py-2.5 mx-1'
            } ${
                isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-transparent border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`
        }
    >
        {({ isActive }) => (
            <>
                {/* Active Indicator Bar */}
                {isActive && !collapsed && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-white rounded-r-full" />
                )}

                {/* Icon */}
                <span
                    className={`material-symbols-outlined shrink-0 relative z-10 transition-all duration-150 ${
                        collapsed ? 'text-[22px]' : 'text-[20px]'
                    } ${
                        isActive
                            ? 'text-white scale-100'
                            : 'text-slate-500 group-hover:text-slate-950'
                    }`}
                    translate="no"
                >
                    {icon}
                </span>

                {/* Label */}
                {!collapsed && (
                    <span
                        className={`text-[11px] font-bold flex-1 relative z-10 truncate ${
                            isActive ? 'text-white' : 'text-slate-700 group-hover:text-slate-950'
                        }`}
                    >
                        {label}
                    </span>
                )}

                {/* Badge (Flat Pill) */}
                {badge && !collapsed && (
                    <div className="relative z-10 shrink-0">{badge}</div>
                )}

                {/* Tooltip (collapsed) */}
                {collapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 translate-x-2 group-hover:translate-x-0 shadow-lg z-50">
                        {label}
                        {badge && <span className="ml-1.5 text-rose-400">●</span>}
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
        ? <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-slate-100 text-slate-800 border border-slate-300 text-[9px] font-bold rounded-md">{counts.activos}</span>
        : undefined;

    const BADGE_DISP = counts.disponibles > 0
        ? <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-emerald-50 text-white text-[9px] font-bold rounded-md">{counts.disponibles}</span>
        : undefined;

    const BADGE_AI = alertasIA > 0
        ? <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-600 text-white text-[9px] font-bold rounded-md">{alertasIA}</span>
        : undefined;

    return (
        <>
            {/* ── PANEL ─────────────────────────────────────────── */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex flex-col
                    bg-white
                    border-r border-slate-200
                    shadow-sm
                    transition-all duration-200 ease-in-out
                    lg:relative lg:z-auto lg:flex-shrink-0 lg:translate-x-0
                    ${c ? 'lg:w-[80px]' : 'lg:w-[260px]'}
                    ${isSidebarOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full w-[260px]'}
                `}
            >
                {/* ── LOGO ────────────────────────────────────── */}
                <div className={`relative flex flex-col items-center border-b border-slate-200 ${c ? 'pt-3 pb-3 px-2' : 'pt-5 pb-4 px-5'}`}>
                    {/* Brand text */}
                    {!c && (
                        <div className="flex flex-col items-center mb-2">
                            <h1 className="text-[16px] font-black text-slate-900 tracking-[0.1em] uppercase">
                                CORAZA<span className="text-primary">CTA</span>
                            </h1>
                        </div>
                    )}

                    {/* Logo Plate */}
                    <div className="relative group/logo">
                        <div className={`relative flex items-center justify-center bg-slate-50 border border-slate-200 shadow-sm transition-all duration-150 ${c ? 'size-9 rounded-lg' : 'size-11 rounded-xl'}`}>
                            <img src="./logo.png" alt="Logo" className="w-[70%] h-[70%] object-contain" />
                        </div>
                    </div>

                    {!c && (
                        <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                            <div className="size-1.5 bg-emerald-600 rounded-full animate-pulse" />
                            <span className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider">En línea</span>
                        </div>
                    )}

                    {/* Collapse Button (Desktop) */}
                    <button
                        onClick={toggleSidebarCollapse}
                        className="hidden lg:flex absolute bottom-0 right-0 translate-x-1/2 -translate-y-1/2 size-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-all z-20 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[14px]">
                            {c ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                        </span>
                    </button>
                </div>

                {/* ── NAV ─────────────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 space-y-4">
                    <NavSection title="OPERACIONES" collapsed={c}>
                        <NavItem to="/"                icon="dashboard"      label="Estadísticas"       collapsed={c} onClick={closeSidebar} />
                        <NavItem to="/vigilantes"       icon="shield_person"  label="Vigilantes"         collapsed={c} onClick={closeSidebar} badge={BADGE_ACTIVOS} />
                        <NavItem to="/disponibles"      icon="group_add"      label="Disponibles"        collapsed={c} onClick={closeSidebar} badge={BADGE_DISP} />
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
                <div className={`border-t border-slate-200 bg-slate-50 ${c ? 'p-2' : 'p-4'}`}>
                    <div 
                        className={`flex items-center gap-2.5 p-1 rounded-xl border border-transparent transition-all group/user ${!c && 'hover:bg-slate-100 hover:border-slate-200 cursor-pointer'}`}
                        onClick={() => !c && navigate('/configuracion')}
                    >
                        <div className={`shrink-0 overflow-hidden border border-slate-200 transition-all ${c ? 'size-9 rounded-lg' : 'size-10 rounded-xl'}`}>
                            <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'A')}&background=0d6efd&color=fff&bold=true&size=80`}
                                alt="U"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        
                        {!c && (
                            <div className="flex-1 min-w-0 pr-1">
                                <p className="text-[11px] font-bold text-slate-900 truncate uppercase leading-tight">{username || 'Operador'}</p>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider truncate">{role || 'Elite'}</p>
                            </div>
                        )}

                        {!c && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowLogoutModal(true); }}
                                className="size-8 rounded-lg bg-slate-200 hover:bg-rose-600 text-slate-600 hover:text-white transition-all flex items-center justify-center shrink-0 border border-slate-300 hover:border-rose-700"
                            >
                                <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* ── LOGOUT MODAL ──────────────────────────────────── */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowLogoutModal(false)} />
                    <div className="relative bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-[360px] shadow-xl overflow-hidden text-slate-900">
                        <div className="size-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-[24px] text-rose-600">logout</span>
                        </div>
                        
                        <h3 className="text-[16px] font-black text-slate-900 text-center uppercase tracking-wide mb-2">¿Desconectar Enlace?</h3>
                        <p className="text-slate-600 text-center text-[12px] font-semibold mb-6 leading-normal">
                            Finalizarás tu sesión actual. Todos los procesos activos quedarán en segundo plano.
                        </p>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all border border-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm"
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
