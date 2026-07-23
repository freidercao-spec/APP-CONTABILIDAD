import { useState, useMemo, useEffect } from 'react';
import { useVigilanteStore } from '../store/vigilanteStore';
import { usePuestoStore } from '../store/puestoStore';

import { supabase } from '../lib/supabase';

const Novedades = () => {
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    
    // Estados del Formulario de Reporte
    const [reportTitle, setReportTitle] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [reportType, setReportType] = useState('INCIDENTE');
    const [reportSeverity, setReportSeverity] = useState('alta');
    const [reportFile, setReportFile] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [dbNovedades, setDbNovedades] = useState<any[]>([]);
    const [loadingNovedades, setLoadingNovedades] = useState(true);
    const [novedadesError, setNovedadesError] = useState(false);
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const puestos = usePuestoStore(s => s.puestos);

    // Solicitar permiso de notificaciones nativas del navegador
    useEffect(() => {
        import('../utils/browserNotifications').then(m => {
            m.requestNotificationPermission();
        });
    }, []);

    // Fetch de novedades de Supabase con sincronización Realtime y notificaciones push
    useEffect(() => {
        const fetchDbNovedades = async () => {
            try {
                const { data, error } = await supabase
                    .from('novedades')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (error) throw error;
                if (data) setDbNovedades(data);
            } catch (err) {
                console.error('Error fetching db novedades:', err);
                setNovedadesError(true);
            } finally {
                setLoadingNovedades(false);
            }
        };

        fetchDbNovedades();

        // Suscripción Realtime
        const channel = supabase
            .channel('novedades_live')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'novedades',
                },
                (payload) => {
                    fetchDbNovedades();
                    // Alerta push nativa si se inserta una novedad crítica/alta
                    if (payload.eventType === 'INSERT') {
                        const newRecord = payload.new;
                        if (newRecord && (newRecord.gravedad === 'alta' || newRecord.gravedad === 'critica' || newRecord.gravedad === 'critical')) {
                            import('../utils/browserNotifications').then(m => {
                                m.sendBrowserNotification(
                                    `⚠️ INCIDENTE CRÍTICO: ${newRecord.titulo || 'Novedad de Sistema'}`,
                                    newRecord.descripcion || 'Se ha registrado una novedad crítica en el panel de control.'
                                );
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // FIX: envolver en useMemo para evitar O(N) recalculación en cada render
    const allHistory = useMemo(() => vigilantes
        .flatMap(v => v.historial.map(h => ({ ...h, guardName: v.nombre, guardId: v.id })))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    , [vigilantes]);
    
    // Combine local guard history with strategic DB novedades
    const combinedNovedades = useMemo(() => {
        const historyMapped = allHistory.slice(0, 10).map(h => ({
            id: h.id,
            timestamp: h.timestamp,
            title: h.guardName,
            details: h.details,
            action: h.action,
            type: 'GUARD_HISTORY' as const,
            severity: 'info'
        }));

        const dbMapped = dbNovedades.map(n => ({
            id: n.id,
            timestamp: n.created_at,
            title: n.titulo || 'Alerta de Sistema',
            details: n.descripcion,
            action: n.tipo === 'IA_INSIGHT' ? 'CorazAI Insight' : n.tipo,
            type: 'DB_NOVELTY' as const,
            severity: n.gravedad === 'alta' ? 'critical' : 'warning',
            evidencia: n.evidencia_url || null
        }));

        return [...dbMapped, ...historyMapped].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12);
    }, [allHistory, dbNovedades]);

    // Vacation intelligence
    const enVacacionesHoy = useMemo(() => {
        const today = new Date();
        return vigilantes.filter(v => {
            if (!v.vacaciones) return false;
            const inicio = new Date(v.vacaciones.inicio);
            const fin = new Date(v.vacaciones.fin);
            return today >= inicio && today <= fin;
        });
    }, [vigilantes]);

    const vacProximas = useMemo(() => {
        const today = new Date();
        return vigilantes.filter(v => {
            if (!v.vacaciones) return false;
            const inicio = new Date(v.vacaciones.inicio);
            const diff = (inicio.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            return diff > 0 && diff <= 7;
        });
    }, [vigilantes]);

    const regresandoProx = useMemo(() => {
        const today = new Date();
        return vigilantes.filter(v => {
            if (!v.vacaciones) return false;
            const fin = new Date(v.vacaciones.fin);
            const diff = (fin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 7;
        });
    }, [vigilantes]);

    const ausentes = vigilantes.filter(v => v.estado === 'ausente');
    const puestosAlerta = puestos.filter(p => p.estado === 'alerta');
    const puestosSinCoverage = puestos.filter(p => !p.turnos || p.turnos.length === 0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setReportFile(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportTitle.trim() || !reportDescription.trim()) return;
        setIsSubmitting(true);
        try {
            const newNovedad = {
                titulo: reportTitle,
                descripcion: reportDescription,
                tipo: reportType,
                gravedad: reportSeverity,
                evidencia_url: reportFile,
                created_at: new Date().toISOString()
            };
            const { error } = await supabase.from('novedades').insert(newNovedad);
            if (error) throw error;
            
            const { useAuditStore } = await import('../store/auditStore');
            useAuditStore.getState().logAction('NOVEDADES', 'Reporte Manual', `Incidente registrado: ${reportTitle} (${reportSeverity.toUpperCase()})`, reportSeverity === 'alta' ? 'critical' : 'warning');
            
            // Reset
            setReportTitle('');
            setReportDescription('');
            setReportType('INCIDENTE');
            setReportSeverity('alta');
            setReportFile(null);
            setIsReportModalOpen(false);
            
            const { showTacticalToast } = await import('../utils/tacticalToast');
            showTacticalToast({ title: 'Novedad Reportada', message: 'El incidente ha sido registrado en la bitacora y transmitido en tiempo real.', type: 'success' });
        } catch (err) {
            console.error('Error reporting incident:', err);
            // Fallback
            setDbNovedades(prev => [
                {
                    id: crypto.randomUUID(),
                    titulo: reportTitle,
                    descripcion: reportDescription,
                    tipo: reportType,
                    gravedad: reportSeverity,
                    evidencia_url: reportFile,
                    created_at: new Date().toISOString()
                },
                ...prev
            ]);
            setIsReportModalOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page-container space-y-10 animate-in fade-in duration-500 pb-20">

            {/* Error de conexión */}
            {novedadesError && (
                <div className="flex items-center gap-4 px-6 py-4 bg-danger/10 border border-danger/30 rounded-2xl text-danger">
                    <span className="material-symbols-outlined text-[22px] notranslate shrink-0" translate="no">wifi_off</span>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest">Error de conexión con la base de datos</p>
                        <p className="text-[10px] font-medium opacity-70 mt-0.5">No se pudieron cargar las novedades en tiempo real. Verificar conexión con Supabase.</p>
                    </div>
                </div>
            )}

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
                    <button onClick={() => setIsReportModalOpen(true)} className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 shadow-md shadow-primary/20">
                        <span className="material-symbols-outlined text-[18px] notranslate" translate="no">add_alert</span>
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none pt-0.5">Reportar Incidente</span>
                    </button>
                    <button onClick={() => setIsWhatsAppModalOpen(true)} className="px-6 py-3 bg-success/10 border border-success/20 text-success rounded-xl hover:bg-success/20 transition-all flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] notranslate" translate="no">chat</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none pt-0.5">WhatsApp Bridge</span>
                    </button>
                </div>
            </div>

            {/* IA Novedades Criticas */}
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
                            <div><p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Vacaciones proximas (7d)</p><p className="text-sm font-black text-slate-900">{vacProximas.length} Vigilantes</p><p className="text-[10px] text-slate-500 mt-1">{vacProximas.map(v=>v.nombre).join(', ')}</p></div>
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
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{v.nombre} - Regresa de vacaciones</h3>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">El vigilante <strong>{v.nombre}</strong> finaliza su periodo de vacaciones el <strong>{new Date(v.vacaciones!.fin).toLocaleDateString('es-CO', { dateStyle: 'long' })}</strong>. Prepare su reincorporacion y asignacion de turno.</p>
                        </div>
                    ))}

                    {vacProximas.map(v => (
                        <div key={v.id} className="bg-white border border-slate-100 rounded-[32px] p-7 border-l-8 border-l-warning group hover:border-warning/40 transition-all shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-3 py-1 bg-warning/10 text-warning text-[10px] font-black uppercase tracking-widest rounded-xl border border-warning/10">Vacaciones</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inicia: {new Date(v.vacaciones!.inicio).toLocaleDateString('es-CO')}</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{v.nombre} - Vacaciones proximas</h3>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">El vigilante <strong>{v.nombre}</strong> inicia vacaciones el <strong>{new Date(v.vacaciones!.inicio).toLocaleDateString('es-CO', { dateStyle: 'long' })}</strong>. Asegure cobertura del turno correspondiente antes de esa fecha.</p>
                        </div>
                    ))}

                    {/* Real Dynamic History */}
                    {loadingNovedades && combinedNovedades.length === 0 ? (
                        <div className="space-y-6">
                            {[1, 2, 3].map(n => (
                                <div key={n} className="bg-white border border-slate-100 rounded-[32px] p-7 border-l-8 border-l-slate-200 animate-pulse shadow-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="h-4 w-20 bg-slate-200 rounded-lg" />
                                        <div className="h-3 w-32 bg-slate-100 rounded" />
                                    </div>
                                    <div className="h-6 w-3/4 bg-slate-200 rounded mb-2" />
                                    <div className="h-4 w-5/6 bg-slate-100 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : combinedNovedades.length === 0 ? (
                        <div className="bg-white border border-slate-100 rounded-[32px] p-10 text-center shadow-sm">
                            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">info</span>
                            <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Sin novedades recientes</h3>
                            <p className="text-slate-400 text-xs mt-1">No se han registrado novedades ni registros de historial en las últimas horas.</p>
                        </div>
                    ) : (
                        combinedNovedades.map((n, i) => (
                            <div key={n.id} className={`bg-white border border-slate-100 rounded-[32px] p-7 border-l-8 ${n.severity === 'critical' ? 'border-l-danger bg-danger/5' : n.severity === 'warning' ? 'border-l-warning' : (i === 0 ? 'border-l-primary shadow-md' : 'border-l-slate-200')} group hover:border-primary/40 transition-all ${i > 5 ? 'opacity-60' : ''} shadow-sm`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`px-3 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg ${n.severity === 'critical' ? 'bg-danger/10 text-danger border border-danger/20' : i === 0 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                        {n.action}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {new Date(n.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(n.timestamp).toLocaleDateString('es-CO')}
                                    </span>
                                    {n.type === 'DB_NOVELTY' && <span className="material-symbols-outlined text-[14px] text-primary">psychology</span>}
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter">{n.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">{n.details}</p>
                            
                            {/* Renderizar evidencia fotográfica si existe */}
                            {n.type === 'DB_NOVELTY' && n.evidencia && (
                                <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden max-w-sm bg-slate-50 shadow-xs">
                                    <img 
                                        src={n.evidencia} 
                                        alt="Evidencia adjunta" 
                                        className="w-full h-auto max-h-48 object-cover cursor-zoom-in hover:opacity-95 transition-opacity" 
                                        onClick={() => {
                                            const w = window.open();
                                            if (w) w.document.write(`<img src="${n.evidencia}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                        }}
                                    />
                                    <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center justify-between">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Evidencia Adjunta</span>
                                        <button 
                                            onClick={() => {
                                                const w = window.open();
                                                if (w) w.document.write(`<img src="${n.evidencia}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                            }}
                                            className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[12px] notranslate" translate="no">open_in_new</span>
                                            Ver completo
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )))}

                    {vacProximas.length === 0 && regresandoProx.length === 0 && combinedNovedades.length === 0 && (
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
                                    {ausentes.length > 0 || puestosSinCoverage.length > 0 ? 'Requiere Atencion' : 'Estable'}
                                </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${ausentes.length > 0 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.max(10, 100 - ((puestosSinCoverage.length + ausentes.length) * 10))}%` }} />
                            </div>
                        </div>

                        {/* Proximas vacaciones panel */}
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

            {/* Modal de Reporte de Incidente Manual */}
            {isReportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsReportModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white border border-slate-100 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary text-[22px] notranslate" translate="no">add_alert</span>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">Reportar Novedad / Incidente</h3>
                            </div>
                            <button onClick={() => setIsReportModalOpen(false)} className="size-10 rounded-full flex items-center justify-center hover:bg-slate-200/50 text-slate-400 transition-all">
                                <span className="material-symbols-outlined text-[20px] notranslate" translate="no">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleReportSubmit} className="p-8 space-y-5">
                            {/* Titulo */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Título del Incidente *</label>
                                <input
                                    type="text"
                                    required
                                    value={reportTitle}
                                    onChange={e => setReportTitle(e.target.value)}
                                    placeholder="Ej: Falla de energía en Garita Principal..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary transition-all shadow-xs"
                                />
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Descripción Detallada *</label>
                                <textarea
                                    required
                                    value={reportDescription}
                                    onChange={e => setReportDescription(e.target.value)}
                                    placeholder="Describa el incidente, hora aproximada y personal involucrado..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 outline-none focus:border-primary h-24 resize-none transition-all shadow-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Tipo */}
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Clase de Novedad</label>
                                    <select
                                        value={reportType}
                                        onChange={e => setReportType(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 font-bold outline-none focus:border-primary transition-all"
                                    >
                                        <option value="INCIDENTE">INCIDENTE</option>
                                        <option value="AUSENCIA">AUSENCIA</option>
                                        <option value="INCAPACIDAD">INCAPACIDAD</option>
                                        <option value="ALERTA_SISTEMA">ALERTA GENERAL</option>
                                    </select>
                                </div>

                                {/* Gravedad */}
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Gravedad / Prioridad</label>
                                    <select
                                        value={reportSeverity}
                                        onChange={e => setReportSeverity(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 font-bold outline-none focus:border-primary transition-all"
                                    >
                                        <option value="baja">BAJA</option>
                                        <option value="media">MEDIA (Advertencia)</option>
                                        <option value="alta">ALTA (Crítica)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Evidencia Adjunta */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">Evidencia Fotográfica (Opcional)</label>
                                <div className="flex items-center gap-3">
                                    <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-slate-300 hover:bg-slate-50 cursor-pointer text-slate-500 hover:text-slate-800 transition-all">
                                        <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Subir Archivo / Captura</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                {reportFile && (
                                    <div className="relative size-20 rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 group">
                                        <img src={reportFile} alt="Vista previa" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setReportFile(null)}
                                            className="absolute top-1 right-1 size-5 rounded-full bg-danger text-white flex items-center justify-center hover:scale-105 transition-transform"
                                        >
                                            <span className="material-symbols-outlined text-[10px] notranslate" translate="no">close</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Acciones */}
                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsReportModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !reportTitle.trim() || !reportDescription.trim()}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-primary/95 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-primary/10"
                                >
                                    {isSubmitting ? 'Transmitiendo...' : 'Transmitir Alerta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
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
                                <p className="text-[14px] text-slate-700 leading-relaxed mb-4 font-medium">⚠️ AVISO: {puestosSinCoverage.length > 0 ? `${puestosSinCoverage.length} puestos sin personal asignado.` : 'Sin alertas criticas activas.'}</p>
                                <p className="text-[10px] font-black text-slate-300 text-right uppercase tracking-widest">{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                            </div>
                            {vacProximas.map(v => (
                                <div key={v.id} className="bg-white p-6 rounded-[28px] rounded-tl-none border border-slate-100 max-w-[90%] shadow-sm opacity-80">
                                    <p className="text-[14px] text-slate-700 leading-relaxed mb-2 font-medium">📅 Proximas vacaciones: {v.nombre} inicia el {new Date(v.vacaciones!.inicio).toLocaleDateString('es-CO')}.</p>
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
