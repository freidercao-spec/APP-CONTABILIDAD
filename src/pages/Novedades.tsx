import { useState, useMemo } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';

const Novedades = () => {
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const puestos = usePuestoStore(s => s.puestos);
    const now = new Date();

    // Aggregated history from all guards
    const allHistory = vigilantes
        .flatMap(v => v.historial.map(h => ({ ...h, guardName: v.nombre, guardId: v.id })))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentNovedades = allHistory.slice(0, 8);

    // Vacation intelligence
    const enVacacionesHoy = useMemo(() => vigilantes.filter(v => {
        if (!v.vacaciones) return false;
        const inicio = new Date(v.vacaciones.inicio);
        const fin = new Date(v.vacaciones.fin);
        return now >= inicio && now <= fin;
    }), [vigilantes]);

    const vacProximas = useMemo(() => vigilantes.filter(v => {
        if (!v.vacaciones) return false;
        const inicio = new Date(v.vacaciones.inicio);
        const diff = (inicio.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 7;
    }), [vigilantes]);

    const regresandoProx = useMemo(() => vigilantes.filter(v => {
        if (!v.vacaciones) return false;
        const fin = new Date(v.vacaciones.fin);
        const diff = (fin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
    }), [vigilantes]);

    const ausentes = vigilantes.filter(v => v.estado === 'ausente');
    const puestosAlerta = puestos.filter(p => p.estado === 'alerta');
    const puestosSinCoverage = puestos.filter(p => !p.turnos || p.turnos.length === 0);

    return (
        <div className="page-container space-y-10 animate-in fade-in duration-500 pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                        <span>Centro de Control</span>
                        <span className="material-symbols-outlined text-[14px] notranslate" translate="no">chevron_right</span>
                        <span className="text-primary">Registro de Novedades</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase tracking-widest">Panel de <span className="text-primary font-black">Novedades</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsWhatsAppModalOpen(true)} className="px-6 py-3 bg-success/10 border border-success/20 text-success rounded-xl hover:bg-success/20 transition-all flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] notranslate" translate="no">chat</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none pt-0.5">WhatsApp Bridge</span>
                    </button>
                </div>
            </div>

            {/* IA Novedades Críticas */}
            {(puestosAlerta.length > 0 || puestosSinCoverage.length > 0 || ausentes.length > 0 || enVacacionesHoy.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {puestosSinCoverage.length > 0 && (
                        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-5 flex gap-3 items-start">
                            <span className="size-8 rounded-xl bg-danger/20 flex items-center justify-center text-danger shrink-0"><span className="material-symbols-outlined text-[18px]">hub</span></span>
                            <div><p className="text-[9px] font-black text-danger uppercase tracking-widest mb-1">Puestos sin personal</p><p className="text-sm font-black text-slate-900">{puestosSinCoverage.length} Puestos</p><p className="text-[10px] text-slate-500 mt-1">{puestosSinCoverage.slice(0,2).map(p=>p.nombre).join(', ')}</p></div>
                        </div>
                    )}
                    {ausentes.length > 0 && (
                        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-5 flex gap-3 items-start">
                            <span className="size-8 rounded-xl bg-danger/20 flex items-center justify-center text-danger shrink-0"><span className="material-symbols-outlined text-[18px]">person_off</span></span>
                            <div><p className="text-[9px] font-black text-danger uppercase tracking-widest mb-1">Vigilantes Ausentes</p><p className="text-sm font-black text-slate-900">{ausentes.length} Ausentes</p><p className="text-[10px] text-slate-500 mt-1">{ausentes.slice(0,2).map(v=>v.nombre).join(', ')}</p></div>
                        </div>
                    )}
                    {enVacacionesHoy.length > 0 && (
                        <div className="bg-warning/10 border border-warning/20 rounded-2xl p-5 flex gap-3 items-start">
                            <span className="size-8 rounded-xl bg-warning/20 flex items-center justify-center text-warning shrink-0"><span className="material-symbols-outlined text-[18px]">beach_access</span></span>
                            <div><p className="text-[9px] font-black text-warning uppercase tracking-widest mb-1">En Vacaciones Hoy</p><p className="text-sm font-black text-slate-900">{enVacacionesHoy.length} Vigilantes</p><p className="text-[10px] text-slate-500 mt-1">{enVacacionesHoy.map(v=>v.nombre).join(', ')}</p></div>
                        </div>
                    )}
                    {vacProximas.length > 0 && (
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 flex gap-3 items-start">
                            <span className="size-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0"><span className="material-symbols-outlined text-[18px]">calendar_today</span></span>
                            <div><p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Vacaciones próximas (7d)</p><p className="text-sm font-black text-slate-900">{vacProximas.length} Vigilantes</p><p className="text-[10px] text-slate-500 mt-1">{vacProximas.map(v=>v.nombre).join(', ')}</p></div>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* News Feed (70%) */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="flex items-center justify-between px-2 mb-4">
                        <div className="flex gap-8">
                            <button className="text-[11px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-primary pb-3">Todo</button>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Registros: {allHistory.length}</p>
                    </div>

                    {/* Vacaciones / IA Events */}
                    {regresandoProx.map(v => (
                        <div key={v.id} className="bg-white border border-slate-100 rounded-[32px] p-7 border-l-8 border-l-success group hover:border-success/40 transition-all shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-3 py-1 bg-success/10 text-success text-[10px] font-black uppercase tracking-widest rounded-xl border border-success/10">Regreso</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(v.vacaciones!.fin).toLocaleDateString('es-CO')}</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{v.nombre} — Regresa de vacaciones</h3>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">El vigilante <strong>{v.nombre}</strong> finaliza su período de vacaciones el <strong>{new Date(v.vacaciones!.fin).toLocaleDateString('es-CO', { dateStyle: 'long' })}</strong>. Prepare su reincorporación y asignación de turno.</p>
                        </div>
                    ))}

                    {vacProximas.map(v => (
                        <div key={v.id} className="bg-white border border-slate-100 rounded-[32px] p-7 border-l-8 border-l-warning group hover:border-warning/40 transition-all shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-3 py-1 bg-warning/10 text-warning text-[10px] font-black uppercase tracking-widest rounded-xl border border-warning/10">Vacaciones</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inicia: {new Date(v.vacaciones!.inicio).toLocaleDateString('es-CO')}</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{v.nombre} — Vacaciones próximas</h3>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">El vigilante <strong>{v.nombre}</strong> inicia vacaciones el <strong>{new Date(v.vacaciones!.inicio).toLocaleDateString('es-CO', { dateStyle: 'long' })}</strong>. Asegure cobertura del turno correspondiente antes de esa fecha.</p>
                        </div>
                    ))}

                    {/* Real Dynamic History */}
                    {recentNovedades.map((h, i) => (
                        <div key={h.id} className={`bg-white border border-slate-100 rounded-[32px] p-7 border-l-8 ${i === 0 ? 'border-l-primary shadow-md' : 'border-l-slate-200'} group hover:border-primary/40 transition-all ${i > 3 ? 'opacity-60' : ''} shadow-sm`}>
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`px-3 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg ${i === 0 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                    {h.action}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {new Date(h.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })} · {new Date(h.timestamp).toLocaleDateString('es-CO')}
                                </span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter">{h.guardName}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">{h.details}</p>
                        </div>
                    ))}

                    {recentNovedades.length === 0 && vacProximas.length === 0 && regresandoProx.length === 0 && (
                        <div className="text-center py-24 text-slate-300">
                            <span className="material-symbols-outlined text-5xl notranslate">plagiarism</span>
                            <p className="mt-4 text-[11px] font-black uppercase tracking-widest">Sin novedades registradas</p>
                        </div>
                    )}
                </div>

                {/* Status Sidebar (30%) */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Resumen de Red</h2>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-8">
                        <div>
                            <div className="flex justify-between items-end mb-4">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado Global</h4>
                                <span className={`text-xs font-bold uppercase tracking-widest ${ausentes.length > 0 || puestosSinCoverage.length > 0 ? 'text-warning' : 'text-success'}`}>
                                    {ausentes.length > 0 || puestosSinCoverage.length > 0 ? 'Requiere Atención' : 'Estable'}
                                </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${ausentes.length > 0 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.max(10, 100 - ((puestosSinCoverage.length + ausentes.length) * 10))}%` }} />
                            </div>
                        </div>

                        {/* Próximas vacaciones panel */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">Calendario Operativo</p>
                            {enVacacionesHoy.length === 0 && vacProximas.length === 0 && regresandoProx.length === 0 ? (
                                <p className="text-[11px] text-slate-400 font-medium">Sin eventos de personal programados.</p>
                            ) : (
                                [...enVacacionesHoy.map(v => ({ v, tipo: 'En Vacaciones', color: 'text-warning', icon: 'beach_access' })),
                                    ...vacProximas.map(v => ({ v, tipo: 'Inicia Vacaciones', color: 'text-primary', icon: 'calendar_today' })),
                                    ...regresandoProx.map(v => ({ v, tipo: 'Regresa Pronto', color: 'text-success', icon: 'login' }))
                                ].map(({ v, tipo, color, icon }) => (
                                    <div key={v.id + tipo} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-slate-900 truncate">{v.nombre}</p>
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${color}`}>{tipo}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-[#25D366]/20 to-transparent border border-[#25D366]/30 rounded-[32px] text-center">
                        <div className="size-14 bg-[#25D366] rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-[#25D366]/20">
                            <span className="material-symbols-outlined text-3xl notranslate" translate="no">chat</span>
                        </div>
                        <h4 className="font-bold mb-2 uppercase tracking-widest text-slate-800">WhatsApp Enlazado</h4>
                        <p className="text-[11px] text-[#25D366] font-bold tracking-widest uppercase opacity-80 mb-6">Canal activo de alertas</p>
                        <button onClick={() => setIsWhatsAppModalOpen(true)} className="text-slate-700 text-[10px] font-bold uppercase tracking-widest underline underline-offset-8 decoration-[#25D366]/40 hover:text-slate-900 transition-colors">
                            Ver mensajes del sistema
                        </button>
                    </div>
                </div>
            </div>

            {/* WhatsApp Modal */}
            {isWhatsAppModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-10">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsWhatsAppModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white border border-slate-100 rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="bg-[#25D366]/5 p-8 flex items-center justify-between border-b border-slate-100">
                            <div className="flex items-center gap-5">
                                <div className="size-16 bg-[#25D366] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#25D366]/20">
                                    <span className="material-symbols-outlined text-4xl notranslate" translate="no">chat</span>
                                </div>
                                <div>
                                    <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">WhatsApp <span className="text-[#25D366]">Bridge</span></h4>
                                    <p className="text-[10px] text-[#25D366] font-black uppercase tracking-widest">Enlace Omnicanal Activo</p>
                                </div>
                            </div>
                            <button onClick={() => setIsWhatsAppModalOpen(false)} className="size-12 rounded-full flex items-center justify-center hover:bg-slate-50 text-slate-400 transition-all">
                                <span className="material-symbols-outlined text-[24px] notranslate" translate="no">close</span>
                            </button>
                        </div>
                        <div className="p-10 space-y-6 max-h-[450px] overflow-y-auto bg-slate-50/30">
                            <div className="bg-white p-6 rounded-[28px] rounded-tl-none border border-slate-100 max-w-[90%] shadow-sm">
                                <p className="text-[14px] text-slate-700 leading-relaxed mb-4 font-medium">⚠️ AVISO: {puestosSinCoverage.length > 0 ? `${puestosSinCoverage.length} puestos sin personal asignado.` : 'Sin alertas críticas activas.'}</p>
                                <p className="text-[10px] font-black text-slate-300 text-right uppercase tracking-widest">{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                            </div>
                            {vacProximas.map(v => (
                                <div key={v.id} className="bg-white p-6 rounded-[28px] rounded-tl-none border border-slate-100 max-w-[90%] shadow-sm opacity-80">
                                    <p className="text-[14px] text-slate-700 leading-relaxed mb-2 font-medium">📅 Próximas vacaciones: {v.nombre} inicia el {new Date(v.vacaciones!.inicio).toLocaleDateString('es-CO')}.</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-8 border-t border-slate-100 flex gap-4 bg-white">
                            <a 
                                href={`https://wa.me/573113836939?text=${encodeURIComponent(`📢 REPORTE DE NOVEDADES - CORAZA CTA\n\n${puestosSinCoverage.length > 0 ? `📍 Puestos sin personal: ${puestosSinCoverage.length}` : '✅ Cobertura OK'}\n👥 Ausentes: ${ausentes.length}\n🏖️ En Vacaciones: ${enVacacionesHoy.length}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-4 bg-[#25D366] text-white font-black rounded-2xl uppercase tracking-widest hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-[#25D366]/20 text-center flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                                Abrir WhatsApp
                            </a>
                            <button onClick={() => setIsWhatsAppModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase tracking-widest hover:bg-slate-200 transition-all">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Novedades;
