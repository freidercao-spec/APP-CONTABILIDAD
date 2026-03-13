import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                    <div className="size-20 bg-danger/10 rounded-3xl flex items-center justify-center mb-6 border border-danger/20">
                        <span className="material-symbols-outlined text-danger text-4xl">running_with_errors</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Error de Enlace Detectado</h1>
                    <p className="text-slate-500 max-w-md mb-8 font-medium">
                        Se ha detectado una anomalía en el núcleo de la aplicación. Los sistemas de seguridad han aislado el error para proteger sus datos.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-8 py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        Reiniciar Enlace Maestro
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
