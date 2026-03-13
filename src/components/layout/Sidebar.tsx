import { NavLink, Link } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { setAuditUser } from '../../store/auditStore';
import { useEffect, useState, useMemo } from 'react';
import { useAIStore } from '../../store/aiStore';
import { useVigilanteStore } from '../../store/vigilanteStore';

const Sidebar = () => {
    const { isSidebarOpen, closeSidebar } = useUIStore();
    const { username, role, logout } = useAuthStore();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Keep audit logger in sync with current user
    useEffect(() => { setAuditUser(username || 'Operador'); }, [username]);

    const { actions } = useAIStore();
    const vigilantes = useVigilanteStore(s => s.vigilantes);

    const counts = useMemo(() => ({
        activos: vigilantes.filter(v => v.estado === 'activo').length,
        disponibles: vigilantes.filter(v => v.estado === 'disponible').length
    }), [vigilantes]);

    // Obtener alertas de la IA generadas por el Motor que aún requieren atención
    const alertasPrioritarias = useMemo(() => 
        actions.filter(a => a.type === 'notification' && a.sender === 'ai' && (a.priority === 'high' || a.priority === 'medium')).length
    , [actions]);

    return (
        <>
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            <aside className={`fixed inset-y-0 left-0 lg:static w-[280px] lg:w-[300px] h-screen bg-gradient-to-b from-[#0b1437] to-[#080d25] flex flex-col z-50 shadow-[20px_0_60px_rgba(0,0,0,0.5)] flex-shrink-0 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) lg:translate-x-0 border-r border-[#1b254b] overflow-hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Animated Background Pattern */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_rgba(67,24,255,0.15)_0%,_transparent_50%)]"></div>
                    <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_rgba(5,205,153,0.1)_0%,_transparent_50%)]"></div>
                </div>
                {/* Logo Section - Elite Edition */}
                <div className="pt-14 pb-12 px-10 flex flex-col items-center relative group">
                    {/* Floating Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/20 blur-[100px] rounded-full pointer-events-none opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
                    
                    {/* Animated Border */}
                    <div className="absolute inset-0 rounded-[40px] bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>

                    <div className="w-24 h-24 bg-white rounded-[32px] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all duration-500 group-hover:scale-105 group-hover:rotate-3 group-hover:shadow-[0_25px_50px_rgba(67,24,255,0.25)] relative z-10 border border-white/20">
                        <img src="/logo.png" alt="CORAZA CTA" className="w-full h-full object-contain filter" />
                    </div>
                    <div className="mt-6 text-center z-10">
                        <h1 className="text-2xl font-black text-white tracking-[0.2em] mb-1 group-hover:text-primary-light transition-colors duration-300">CORAZA <span className="text-primary-light group-hover:text-white transition-colors duration-300">CTA</span></h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] group-hover:text-primary-light transition-colors duration-300">Seguridad de Élite</p>
                    </div>

                    {/* Sync Status Badge */}
                    <div className="mt-4 flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10 relative z-10 animate-fade-in transition-all hover:bg-white/10">
                        <span className="size-1.5 bg-success rounded-full animate-pulse shadow-[0_0_8px_#00b377]"></span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sistemas Sincronizados</span>
                    </div>
                </div>

                {/* Navigation - Ultra Clean Layout */}
                <nav className="flex-1 py-8 overflow-y-auto custom-scrollbar space-y-8 pb-12">
                    <NavSection title="Programación">
                        <NavItem to="/" icon="dashboard" label="Estadísticas" />
                        <NavItem to="/vigilantes" icon="local_police" label="Vigilantes" extras={
                            counts.activos > 0 ? (
                                <span className="ml-auto bg-primary-light/20 text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-white/10">
                                    {counts.activos}
                                </span>
                            ) : undefined
                        } />
                        <NavItem to="/disponibles" icon="group_add" label="Disponibles" extras={
                            counts.disponibles > 0 ? (
                                <span className="ml-auto bg-success/20 text-success-light text-[9px] font-black px-2 py-0.5 rounded-full border border-success/30">
                                    {counts.disponibles}
                                </span>
                            ) : undefined
                        } />
                        <NavItem to="/puestos" icon="hub" label="Mapa de Puestos" />
                        <NavItem to="/gestion-puestos" icon="event_note" label="Puestos Activos" />
                        <NavItem to="/resumen" icon="picture_as_pdf" label="Resumen / PDF" />
                    </NavSection>

                    <NavSection title="Seguridad">
                        <NavItem to="/inteligencia" icon="insights" label="Inteligencia" extras={
                            alertasPrioritarias > 0 ? (
                                <span className="ml-auto bg-danger text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(238,93,80,0.6)]">
                                    {alertasPrioritarias}
                                </span>
                            ) : undefined
                        }/>
                        <NavItem to="/novedades" icon="warning_amber" label="Novedades Operativas" />
                    </NavSection>

                    <NavSection title="Control Central">
                        <NavItem to="/configuracion" icon="settings" label="Sistema Central" />
                        <NavItem to="/auditoria" icon="policy" label="Auditoría Interna" />
                    </NavSection>
                </nav>

                {/* Bottom Section - Elite User Profile */}
                <div className="p-6 mt-auto border-t border-[#1b254b] bg-black/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[var(--mesh-gradient)] opacity-10 pointer-events-none"></div>

                    <Link to="/configuracion" className="flex items-center gap-3 bg-[#111c44]/50 backdrop-blur-md p-3 rounded-[24px] border border-white/5 shadow-2xl relative z-10 transition-all hover:border-primary/30 group/profile">
                        <div className="size-11 rounded-[14px] overflow-hidden border-2 border-primary/30 shadow-lg shadow-primary/20 shrink-0 group-hover/profile:border-primary transition-colors">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'Admin')}&background=4318FF&color=fff&bold=true`} alt="User" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-black text-white truncate uppercase tracking-tight group-hover/profile:text-primary transition-colors">{username || 'Operador'}</p>
                            <p className="text-[9px] font-black text-primary-light uppercase tracking-[0.15em] mt-0.5 truncate">{role || 'Staff'}</p>
                        </div>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLogoutConfirm(true); }}
                            title="Cerrar Sesión"
                            className="size-9 rounded-xl bg-white/5 hover:bg-danger/20 border border-white/5 hover:border-danger/40 text-slate-500 hover:text-danger transition-all flex items-center justify-center active:scale-90 shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                        </button>
                    </Link>
                </div>
            </aside>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0b1437] border border-[#1b254b] rounded-[32px] p-8 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300">
                        <div className="size-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-4xl text-danger">logout</span>
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-2 uppercase tracking-tight">¿Cerrar Sesión?</h3>
                        <p className="text-slate-400 text-center text-[13px] font-medium mb-8 leading-relaxed">Estás a punto de salir del sistema Coraza CTA. Tendrás que volver a ingresar tus credenciales para acceder a tus operaciones.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3.5 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10 uppercase tracking-widest text-[11px]">Cancelar</button>
                            <button onClick={() => { setShowLogoutConfirm(false); logout(); }} className="flex-1 py-3.5 rounded-2xl bg-danger text-white font-black hover:brightness-110 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all uppercase tracking-widest text-[11px]">Sí, Salir</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;

const NavSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="px-4">
        <h3 className="px-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 mt-8">{title}</h3>
        <div className="space-y-2">
            {children}
        </div>
    </div>
);

const NavItem = ({ to, icon, label, extras }: { to: string; icon: string; label: string; extras?: React.ReactNode }) => {
    const closeSidebar = useUIStore((s) => s.closeSidebar);

    return (
        <NavLink onClick={closeSidebar} to={to} className={({ isActive }) =>
            `flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group relative mx-2 overflow-hidden ${isActive
                ? 'text-white bg-primary shadow-[0_10px_30px_rgba(67,24,255,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`
        }>
            {({ isActive }) => (
                <>
                    {/* Background hover light effect */}
                    {!isActive && <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-100%] group-hover:translate-x-0 duration-500 pointer-events-none"></div>}

                    {/* Active Indicator Bar on the left */}
                    {isActive && (
                        <div className="absolute left-0 top-3 bottom-3 w-[5px] bg-white rounded-r-lg shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-in slide-in-from-left-4 duration-500"></div>
                    )}

                    <span className={`material-symbols-outlined text-[24px] relative z-10 transition-all duration-300 ${isActive ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-hover:scale-110 group-hover:text-white'
                        }`} translate="no">{icon}</span>

                    <span className={`text-[12px] font-black tracking-[0.1em] uppercase relative z-10 transition-all duration-300 ${isActive ? 'text-white' : 'group-hover:text-white'
                        }`}>{label}</span>

                    {extras && <div className="relative z-10 ml-auto pl-2 flex items-center">{extras}</div>}

                    {isActive && !extras && (
                        <div className="ml-auto animate-in fade-in duration-700 relative z-10">
                            <div className="size-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse"></div>
                        </div>
                    )}
                </>
            )}
        </NavLink>
    );
};
