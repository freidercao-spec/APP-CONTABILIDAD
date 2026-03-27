import { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../../store/aiStore';
import { analyzeSystemState } from '../../services/aiService';
import { useVigilanteStore } from '../../store/vigilanteStore';
import { usePuestoStore } from '../../store/puestoStore';
import corazaiAvatar from '../../assets/corazai-avatar.png';

export const CorazaAI = () => {
    const { actions, isAnalyzing, isOpen, toggleOpen, addAction, setAnalyzing, clearChat } = useAIStore();
    const vigilantes = useVigilanteStore(s => s.vigilantes);
    const puestos = usePuestoStore(s => s.puestos);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Filter only chat messages for the bot window as requested
    const chatActions = actions.filter(a => a.type === 'chat');
    const prevActionsLength = useRef(chatActions.length);

    // Auto-scroll to bottom of chat
    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        if (isOpen && chatActions.length > prevActionsLength.current) {
            scrollToBottom();
        }
        prevActionsLength.current = chatActions.length;
    }, [chatActions, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => scrollToBottom('auto'), 100);
        }
    }, [isOpen]);

    // System Analysis loop (Muted to avoid double notifications with useMotorInteligencia)
    // Only analyze system-wide report in long intervals if really needed, 
    // but the user prefers "strictly necessary" notifications.
    useEffect(() => {
        const interval = setInterval(async () => {
            if (document.visibilityState === 'visible' && !isOpen) {
                // Solo realizamos un chequeo profundo cada 15 minutos para el badge si no ha habido actividad
                // Pero por ahora lo dejamos en manos de useMotorInteligencia para consistencia.
            }
        }, 1000 * 60 * 15);

        return () => clearInterval(interval);
    }, [isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isAnalyzing) return;

        const userMsg = input.trim();
        setInput('');

        addAction({ text: userMsg, type: 'chat', sender: 'user' });
        setAnalyzing(true);

        const aiResponse = await analyzeSystemState(vigilantes, puestos, userMsg);

        addAction({ text: aiResponse, type: 'chat', sender: 'ai' });
        setAnalyzing(false);
    };

    const getPriorityIndicator = (priority?: string) => {
        switch (priority) {
            case 'high': return <span className="size-2 rounded-full bg-danger pulse-danger mr-2"></span>;
            case 'medium': return <span className="size-2 rounded-full bg-warning mr-2"></span>;
            case 'low': return <span className="size-2 rounded-full bg-success mr-2"></span>;
            default: return null;
        }
    };

    // Simple Markdown Renderer for **bold** and lists
    const FormattedText = ({ text }: { text: string }) => {
        const lines = text.split('\n');
        return (
            <div className="space-y-1">
                {lines.map((line, i) => {
                    // Handle lists
                    if (line.trim().startsWith('- ')) {
                        return (
                            <div key={i} className="flex gap-2 pl-2">
                                <span className="text-primary-light">•</span>
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
        <div className="fixed bottom-8 right-6 z-[100] flex flex-col items-end gap-0">
            {/* AI Chat Panel — only mounted when open so it never blocks clicks */}
            {isOpen && (
            <div className="fixed bottom-[88px] right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[420px] h-[calc(100vh-140px)] sm:h-[600px] horizon-card border-none shadow-[0_30px_90px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden origin-bottom-right animate-in slide-in-from-bottom-4 fade-in duration-300">
                {/* Header Section */}
                <div className="bg-[#0b1437]/90 p-5 flex items-center justify-between shrink-0 relative overflow-hidden border-b border-white/10 backdrop-blur-md">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/5"></div>
                    {/* HUD Corner Accents */}
                    <div className="absolute top-0 left-0 size-4 border-t-2 border-l-2 border-primary/40 rounded-tl-sm"></div>
                    <div className="absolute top-0 right-0 size-4 border-t-2 border-r-2 border-primary/40 rounded-tr-sm"></div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="relative group/avatar">
                            <div className="size-14 rounded-full p-[2px] bg-gradient-to-tr from-primary via-primary-light to-transparent animate-spin-slow shadow-[0_0_20px_rgba(67,24,255,0.3)]">
                                <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden border border-white/10">
                                    <img 
                                        src={corazaiAvatar} 
                                        alt="CorazAI" 
                                        className="w-full h-full object-cover object-top scale-[1.35] origin-top brightness-110" 
                                    />
                                </div>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 size-4 bg-[#0b1437] rounded-full flex items-center justify-center border border-white/10">
                                <span className="size-2.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(48,209,88,0.6)]"></span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-white font-black text-[16px] uppercase tracking-wider leading-none mb-1.5 flex items-center gap-2">
                                CorazAI
                                <span className="px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30 text-[8px] text-primary-light font-black tracking-tighter">V4.0 PRO</span>
                            </h3>
                            <div className="flex items-center gap-2 text-white/50 font-bold text-[9px] uppercase tracking-widest">
                                <span className="flex gap-0.5">
                                    <span className="size-1 bg-primary/40 rounded-full animate-bounce"></span>
                                    <span className="size-1 bg-primary/60 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                                    <span className="size-1 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                </span>
                                Sistema de Supervision Activo
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        <a 
                            href="https://wa.me/573113836939" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-3 h-8 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] rounded-lg text-[9px] font-black uppercase tracking-widest border border-[#25D366]/20 transition-all flex items-center gap-1.5 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[14px]">chat</span>
                            WhatsApp
                        </a>
                        <button
                            onClick={clearChat}
                            className="px-3 h-8 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10 transition-all flex items-center gap-1.5 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[14px]">add_comment</span>
                            Nuevo
                        </button>
                        <button onClick={toggleOpen} className="size-9 rounded-xl bg-black/20 text-white/70 hover:text-white hover:bg-black/40 transition-all flex items-center justify-center border border-white/5 active:scale-90">
                            <span className="material-symbols-outlined text-[20px]">expand_more</span>
                        </button>
                    </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0D1117]/95 backdrop-blur-3xl relative">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"></div>

                    {chatActions.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-4">
                            <span className="material-symbols-outlined text-5xl opacity-20 bg-primary/20 p-4 rounded-full">chat_bubble</span>
                            <div className="space-y-1">
                                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Enlace con CUADRO OPERATIVO</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">Soy CorazAI. Estoy aqui para supervisar la programacion y ayudarte con la asignacion de personal.</p>
                            </div>
                        </div>
                    )}

                    {chatActions.map((act) => (
                        <div key={act.id} className={`flex gap-4 ${act.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-3 duration-500 group/msg`}>
                            {act.sender === 'ai' && (
                                <div className="relative shrink-0 mt-1">
                                    <div className="size-10 rounded-full overflow-hidden border-2 border-primary/20 shadow-[0_5px_15px_rgba(0,0,0,0.3)] bg-slate-800">
                                        <img src={corazaiAvatar} alt="CorazAI" className="w-full h-full object-cover object-top scale-[1.35] origin-top" />
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 size-3 bg-success rounded-full border-2 border-[#0D1117]"></div>
                                </div>
                            )}
                            <div className={`flex flex-col gap-1.5 ${act.sender === 'user' ? 'items-end' : 'items-start'} max-w-[82%]`}>
                                <div className="flex items-center gap-2 px-1 opacity-60 group-hover/msg:opacity-100 transition-opacity">
                                    {act.sender === 'ai' && getPriorityIndicator(act.priority)}
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                                        {act.sender === 'user' ? 'Comando Central' : 'CorazAI Intelligence'}
                                    </span>
                                </div>

                                <div className={`rounded-3xl p-4.5 text-[14px] relative transition-all duration-300 ${act.sender === 'user'
                                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white rounded-tr-sm shadow-[0_10px_25px_rgba(67,24,255,0.25)] border border-white/10'
                                    : 'bg-[#1a1f2e] text-slate-100 border border-white/5 rounded-tl-sm shadow-xl'
                                    }`}>

                                    <div className="leading-relaxed font-bold tracking-wide mb-3">
                                        <FormattedText text={act.text} />
                                    </div>

                                    {act.sender === 'ai' && (act.priority === 'high' || act.text.toLowerCase().includes('alerta') || act.text.toLowerCase().includes('atencion')) && (
                                        <a 
                                            href={`https://wa.me/573113836939?text=${encodeURIComponent(`📢 REPORTE TACTICO CORAZAI:\n\n${act.text.replace(/\*\*/g, '')}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#25D366]/20"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">send</span>
                                            Reportar en WhatsApp
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isAnalyzing && (
                        <div className="flex flex-col items-start gap-1.5 animate-pulse">
                            <div className="px-2 font-black text-[9px] text-primary uppercase tracking-widest">CorazAI analizando programacion...</div>
                            <div className="bg-[#1a1f2e] rounded-[24px] rounded-tl-none p-4 w-16 flex justify-center gap-1.5 items-center border border-primary/20">
                                <div className="size-1.5 rounded-full bg-primary animate-bounce shadow-[0_0_8px_rgba(67,24,255,0.5)]"></div>
                                <div className="size-1.5 rounded-full bg-primary animate-bounce shadow-[0_0_8px_rgba(67,24,255,0.5)]" style={{ animationDelay: '0.1s' }}></div>
                                <div className="size-1.5 rounded-full bg-primary animate-bounce shadow-[0_0_8px_rgba(67,24,255,0.5)]" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-6 bg-[#0D1117] border-t border-white/10 flex flex-col gap-4 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-24 h-5 bg-gradient-to-t from-[#0D1117] to-transparent pointer-events-none"></div>
                    
                    <div className="flex gap-2">
                        <div className="flex-1 relative group/input">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Escriba un comando o pregunta..."
                                disabled={isAnalyzing}
                                className="w-full h-[52px] rounded-2xl pl-12 pr-4 text-[14px] bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-primary/50 focus:bg-white/10 focus:ring-4 focus:ring-primary/5 transition-all outline-none disabled:opacity-50 font-semibold"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary/40 group-focus-within/input:text-primary transition-colors text-[20px]">
                                {isAnalyzing ? 'sync' : 'emergency_home'}
                            </span>
                        </div>
                        <button
                            type="submit"
                            disabled={!input.trim() || isAnalyzing}
                            className="size-[52px] rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary-dark hover:shadow-[0_0_20px_rgba(67,24,255,0.4)] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                        >
                            <span className="material-symbols-outlined text-[22px]">{isAnalyzing ? 'more_horiz' : 'send'}</span>
                        </button>
                    </div>
                </form>
            </div>
            )}

            {/* Floating Action Button */}
            <div className={`mt-4 ${isOpen ? '' : 'animate-float'}`}>
                <button
                    onClick={toggleOpen}
                    className={`
                        size-14 rounded-[20px] flex items-center justify-center transition-all duration-500 outline-none relative group overflow-visible
                        ${isOpen 
                            ? 'bg-slate-900 shadow-2xl rotate-90 scale-90 border border-white/20' 
                            : 'bg-primary shadow-[0_15px_40px_rgba(67,24,255,0.4)] hover:shadow-[0_25px_60px_rgba(67,24,255,0.6)] hover:scale-110 hover:-rotate-3 border-2 border-white/30'}
                    `}
                >
                    {/* Tech Orbits (Rings) */}
                    {!isOpen && (
                        <>
                            <div className="absolute -inset-3 border border-primary/20 rounded-[26px] animate-spin-slower opacity-40 pointer-events-none"></div>
                            <div className="absolute -inset-1.5 border border-primary-light/10 rounded-[22px] animate-spin-reverse opacity-30 pointer-events-none"></div>
                        </>
                    )}

                    {/* Container for the image to keep it within bounds */}
                    <div className="absolute inset-0 rounded-[18px] overflow-hidden">
                        {/* High-Tech Background Layer */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-[#0D1117] opacity-95"></div>
                        
                        {/* Tech Scanlines Effect */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%] pointer-events-none opacity-20"></div>

                        {/* Internal Glow */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        {isOpen ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-[26px] text-white relative z-10 transition-transform duration-500 -rotate-90">close</span>
                            </div>
                        ) : (
                            <div className="relative z-10 w-full h-full flex items-center justify-center">
                                <img 
                                    src={corazaiAvatar} 
                                    alt="CorazAI" 
                                    className="size-full object-cover object-top scale-[1.3] origin-top transition-all duration-700 group-hover:scale-[1.4] brightness-125 contrast-110" 
                                />
                                {/* Elegant Lens Flare/Sheen Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            </div>
                        )}
                    </div>

                    {/* Refined Status indicator */}
                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center justify-center">
                        <span className="absolute size-3 bg-success rounded-full animate-ping opacity-40 scale-150"></span>
                        <div className="size-2.5 rounded-full bg-success ring-2 ring-[#0D1117] shadow-[0_0_10px_rgba(48,209,88,1)]"></div>
                    </div>
                </button>
            </div>
        </div>
    );
};
