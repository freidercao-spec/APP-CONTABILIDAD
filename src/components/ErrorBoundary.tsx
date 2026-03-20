import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        errorMessage: '',
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error.message };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[CORAZA] Error crítico capturado:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#050A14] flex flex-col items-center justify-center p-6 text-center">
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                    <div className="relative max-w-md w-full">
                        {/* Danger glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none" />

                        {/* Icon */}
                        <div className="relative size-24 mx-auto mb-6">
                            <div className="absolute inset-0 bg-red-500/20 rounded-3xl blur-xl animate-pulse" />
                            <div className="relative size-24 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-500 text-[42px]">running_with_errors</span>
                            </div>
                        </div>

                        <h1 className="text-[22px] font-black text-white uppercase tracking-tighter mb-2">
                            Error de Sistema Detectado
                        </h1>
                        <p className="text-slate-500 text-[13px] font-medium leading-relaxed mb-2">
                            Se ha detectado una anomalía en el núcleo de la aplicación. Los módulos de seguridad han aislado el error para proteger sus datos.
                        </p>

                        {this.state.errorMessage && (
                            <div className="my-4 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-left">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Diagnóstico Técnico</p>
                                <p className="text-[11px] font-mono text-red-400 break-words">{this.state.errorMessage}</p>
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                                className="flex-1 px-6 py-3.5 bg-white/5 border border-white/10 text-white font-bold rounded-2xl uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all"
                            >
                                Reintentar
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 px-6 py-3.5 bg-primary text-white font-black rounded-2xl uppercase tracking-widest text-[11px] hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
                            >
                                Reiniciar Sistema
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
