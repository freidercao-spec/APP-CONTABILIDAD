import React, { useRef, useEffect, useMemo } from 'react';
import { usePuestoStore } from '../store/puestoStore';
import { useVigilanteStore } from '../store/vigilanteStore';
import { useProgramacionStore } from '../store/programacionStore';
import { useAIStore } from '../store/aiStore';
import { showTacticalToast } from '../utils/tacticalToast';

const Inteligencia = () => {
    const { actions, clearHistory } = useAIStore();
    const puestos = usePuestoStore(s => s.puestos);
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const programaciones = useProgramacionStore(s => s.programaciones);

    // Obtener alertas criticas reales desde el Motor de Inteligencia
    const iaAlertas = useMemo(() => 
        actions.filter(a => a.type === 'notification' && a.sender === 'ai' && (a.priority === 'high' || a.priority === 'medium')).reverse()
    , [actions]);

    const feedEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of tactical feed
    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [actions]);

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'high': return 'text-danger border-danger/30 bg-danger/10';
            case 'medium': return 'text-warning border-warning/30 bg-warning/10';
            case 'low': return 'text-success border-success/30 bg-success/10';
            default: return 'text-primary border-primary/30 bg-primary/10';
        }
    };

    // Simple Markdown Renderer for **bold** and lists
    const FormattedText = ({ text }: { text: string }) => {
        const lines = text.split('\n');
        return (
            <div className="space-y-2">
                {lines.map((line, i) => {
                    // Handle lists
                    if (line.trim().startsWith('- ')) {
                        return (
                            <div key={i} className="flex gap-2 pl-2">
                                <span className="text-primary-light font-black">•</span>
                                <div>{parseBold(line.trim().substring(2))}</div>
                            </div>
                        );
                    }
                    return <div key={i}>{parseBold(line)}</div>;
                })}
            </div>
        );
    };

    const parseBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-white font-black">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="page-container space-y-10 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                        <span>Comando TACTICO</span>
                        <span className="material-symbols-outlined text-[14px] notranslate" translate="no">chevron_right</span>
                        <span className="text-primary font-black">Analisis de Prediccion</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Inteligencia <span className="text-primary">Operativa</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (window.confirm('¿Seguro que desea purgar el historial tactico?')) {
                                clearHistory();
                                showTacticalToast({
                                    title: 'Historial Purgado',
                                    message: 'La memoria tactica del sistema ha sido restablecida.',
                                    type: 'info'
                                });
                            }
                        }}
                        className="px-4 py-2 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-400 hover:text-danger hover:border-danger/30 transition-all uppercase tracking-widest bg-white shadow-sm"
                    >
                        Purgar Historial
                    </button>
                    <div className="bg-white border border-slate-200 p-1 rounded-xl flex shadow-sm">
                        <button className="px-6 py-2.5 text-[10px] font-bold rounded-lg bg-primary text-white shadow-lg shadow-primary/20 uppercase tracking-widest transition-all">Hoy</button>
                        <button className="px-6 py-2.5 text-[10px] font-bold rounded-lg text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-all">Historial</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Tactical Feed (65%) */}
                <div className="lg:col-span-8 flex flex-col h-[750px] horizon-card border-none bg-slate-950 shadow-2xl relative overflow-hidden">
                    {/* Interior tactical grid effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>

                    <div className="p-8 flex items-center justify-between gap-4 border-b border-white/5 relative z-10 bg-slate-950/50 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Registro de Actividad Tactica</h2>
                            <span className="px-3 py-1 rounded-full bg-primary/20 text-primary-light text-[10px] font-black border border-primary/20">{actions.length} EVENTOS</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-success animate-pulse"></span>
                            <span className="text-[10px] font-bold text-success/80 uppercase tracking-widest">Enlace Estable</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6 relative z-10">
                        {/* Timeline vertical line */}
                        <div className="absolute left-[39px] top-8 bottom-8 w-px bg-gradient-to-b from-primary via-primary/20 to-transparent opacity-30"></div>

                        {actions.map((action, idx) => (
                            <div key={action.id} className="relative pl-14 group animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                                {/* Timeline Dot */}
                                <div className={`absolute left-[33px] top-6 size-3.5 rounded-full border-4 border-slate-950 z-10 transition-transform group-hover:scale-125 ${action.sender === 'user' ? 'bg-primary shadow-[0_0_15px_rgba(67,24,255,0.6)]' :
                                    action.priority === 'high' ? 'bg-danger shadow-[0_0_15px_rgba(238,93,80,0.6)] pulse-danger' :
                                        action.priority === 'medium' ? 'bg-warning shadow-[0_0_15px_rgba(255,181,71,0.6)]' :
                                            'bg-success shadow-[0_0_15px_rgba(5,205,153,0.6)]'
                                    }`}></div>

                                <div className={`p-6 rounded-[24px] border border-white/5 transition-all group-hover:border-white/10 ${action.sender === 'user' ? 'bg-white/5' : 'bg-white/[0.03]'
                                    } shadow-xl`}>
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getPriorityColor(action.priority)}`}>
                                                {action.sender === 'user' ? 'OPERADOR' : 'CORAZA AI'}
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                                                T+: {new Date(action.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>
                                        {action.type === 'notification' && (
                                            <span className="material-symbols-outlined text-[18px] text-primary animate-pulse">sensors</span>
                                        )}
                                    </div>

                                    <div className={`text-[14px] leading-relaxed tracking-wide ${action.sender === 'user' ? 'text-slate-400 font-medium italic' : 'text-slate-100 font-bold'}`}>
                                        <FormattedText text={action.text} />
                                    </div>

                                    {action.priority === 'high' && action.sender === 'ai' && (
                                        <div className="mt-5 flex gap-3">
                                            <button className="px-4 py-2 bg-danger text-white text-[10px] font-black rounded-xl hover:brightness-110 transition-all uppercase tracking-widest shadow-lg shadow-danger/20">
                                                Intervenir Ahora
                                            </button>
                                            <button className="px-4 py-2 bg-white/5 text-slate-400 text-[10px] font-black rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest border border-white/5">
                                                Ignorar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={feedEndRef} />

                        {actions.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700 space-y-6">
                                <span className="material-symbols-outlined text-8xl opacity-10">biotech</span>
                                <p className="text-xs font-black uppercase tracking-[0.4em] opacity-30">Silencio TACTICO en el Sector</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Insights Sidebar (35%) */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Nucleo de Inteligencia</h2>
                    </div>

                    <div className="section-card p-10 bg-slate-900 border-none relative overflow-hidden group shadow-2xl">
                        <div className="absolute -top-10 -right-10 size-48 bg-primary/20 blur-[80px] rounded-full group-hover:bg-primary/30 transition-all duration-700"></div>

                        <div className="flex items-center gap-4 mb-10 relative z-10">
                            <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20 shadow-inner">
                                <span className="material-symbols-outlined text-primary text-3xl animate-pulse">psychology</span>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Estado de Enlace</h4>
                                <p className="text-2xl font-mono font-black text-white tracking-tighter">OPERATIVO <span className="text-[11px] text-success font-black font-sans tracking-normal ml-2">● ACTIVO</span></p>
                            </div>
                        </div>

                        <div className="space-y-8 relative z-10">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="p-5 bg-white/5 rounded-[20px] border border-white/5">
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Analitica</p>
                                    <p className="text-xl font-mono font-black text-white">99.8%</p>
                                </div>
                                <div className="p-5 bg-white/5 rounded-[20px] border border-white/5">
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Latencia</p>
                                    <p className="text-xl font-mono font-black text-white">12ms</p>
                                </div>
                            </div>

                            <button className="w-full py-5 bg-primary text-white text-[11px] font-black rounded-2xl uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-95 shadow-2xl shadow-primary/30 transition-all pt-1">
                                Sincronizar Base de Datos
                            </button>
                        </div>
                    </div>

                    {/* Active Alerts Summary */}
                    <div className={`section-card p-8 border-none shadow-xl transition-all duration-500 ${iaAlertas.length > 0 ? 'bg-danger/10 shadow-danger/20' : 'bg-success/5 shadow-success/10'}`}>
                        <div className="flex items-center justify-between mb-6">
                            <h4 className={`text-[11px] font-black uppercase tracking-widest ${iaAlertas.length > 0 ? 'text-danger' : 'text-success'}`}>
                                Alertas Activas del Motor IA
                            </h4>
                            <span className={`px-3 py-1 text-white text-[10px] font-black rounded-lg uppercase shadow-lg ${iaAlertas.length > 0 ? 'bg-danger shadow-danger/20' : 'bg-success shadow-success/20'}`}>
                                {iaAlertas.length} Tareas
                            </span>
                        </div>
                        <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                            {iaAlertas.length > 0 ? iaAlertas.map(alerta => (
                                <div key={alerta.id} className="flex flex-col gap-2 p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-danger/20 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                    <div className="flex items-center gap-3">
                                        <span className={`size-3 rounded-full ${alerta.priority === 'high' ? 'bg-danger pulse-danger' : 'bg-warning'}`}></span>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${alerta.priority === 'high' ? 'text-danger' : 'text-warning'}`}>
                                            {alerta.priority === 'high' ? 'PRIORIDAD CRITICA' : 'ATENCION REQUERIDA'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-800 leading-snug">
                                        {alerta.text.replace(/\*\*/g, '')}
                                    </p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-slate-400">
                                            {new Date(alerta.timestamp).toLocaleTimeString()}
                                        </span>
                                        <button className="text-[9px] px-3 py-1.5 rounded-lg bg-slate-900 text-white font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">
                                            Atender
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 bg-success/10 rounded-2xl border border-success/20 border-dashed">
                                    <span className="material-symbols-outlined text-success text-3xl mb-2">verified</span>
                                    <p className="text-[11px] text-success/80 font-black uppercase tracking-widest">Sistemas Optimos</p>
                                    <p className="text-[10px] text-success/60 mt-1">Garantia total de operatividad.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="section-card p-8 border-slate-200 bg-white">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Sugerencias Estrategicas</h4>
                        <div className="space-y-5">
                            <div className="flex gap-5 p-4 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group border border-transparent hover:border-slate-100">
                                <div className="size-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-warning text-xl group-hover:scale-110 transition-transform">lightbulb</span>
                                </div>
                                <p className="text-[12px] text-slate-600 font-bold leading-snug">Optimizar ruta de patrulla en Cuadrante 4 para reducir fatiga en agentes.</p>
                            </div>
                            <div className="flex gap-5 p-4 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group border border-transparent hover:border-slate-100">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary text-xl group-hover:scale-110 transition-transform">verified_user</span>
                                </div>
                                <p className="text-[12px] text-slate-600 font-bold leading-snug">Nueva certificacion disponible para agentes de nivel 2.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Inteligencia;
