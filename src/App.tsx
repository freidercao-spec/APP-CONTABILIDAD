// CORAZA CTA - Tactical Logic Core
console.log('[App] 🔍 Iniciando carga del nucleo...');

import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useSupabaseInit } from './hooks/useSupabaseInit';
import { useMotorInteligencia } from './store/useMotorInteligencia';
import Login from './pages/Login';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';

// Optimized Lazy Loading for all pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Vigilantes = lazy(() => import('./pages/Vigilantes'));
const Puestos = lazy(() => import('./pages/GestionPuestos'));
const Novedades = lazy(() => import('./pages/Novedades'));
const Resumen = lazy(() => import('./pages/Resumen'));
const Auditoria = lazy(() => import('./pages/AuditoriaInterna'));
const Configuracion = lazy(() => import('./pages/Configuracion'));

const TacticalLoading = ({ onBypass, logs }: { onBypass?: () => void, logs?: string[] }) => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[100vh] space-y-8 bg-[#050A14] text-white p-6 overflow-hidden relative">
    {/* Fondo tactico */}
    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#4318FF_0%,_transparent_70%)]"></div>
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"></div>

    <div className="relative">
      <div className="size-24 rounded-2xl border-2 border-[#4318FF]/30 flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(67,24,255,0.2)]">
        <div className="size-16 border-4 border-[#4318FF] rounded-full border-t-transparent animate-spin"></div>
      </div>
      <div className="absolute -top-1 -right-1 size-4 bg-[#30D158] rounded-full animate-ping"></div>
    </div>

    <div className="text-center space-y-3 relative z-10 max-w-sm">
      <h2 className="text-xl font-black tracking-[0.2em] uppercase text-white drop-shadow-md">CUADRO OPERATIVO</h2>
      <p className="text-[10px] font-bold text-[#4318FF] uppercase tracking-[0.3em] opacity-80">Sincronizando con Servidores Coraza</p>
      
      {/* Logs tracking */}
      {logs && logs.length > 0 && (
        <div className="mt-6 p-4 bg-black/40 border border-white/10 rounded-xl text-left font-mono text-[9px] text-slate-400 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
          {logs.slice(-5).map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-[#4318FF]/70">[{new Date().toLocaleTimeString()}]</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* BOTON DE EMERGENCIA: SI SE QUEDA PEGADO MAS DE 6 SEGUNDOS */}
    {onBypass && (
      <button 
        onClick={onBypass}
        className="mt-12 px-8 py-3 bg-[#FF4B4B]/10 hover:bg-[#FF4B4B]/20 border border-[#FF4B4B]/30 text-[#FF4B4B] text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all animate-bounce"
      >
        ⚠️ FORZAR ARRANQUE (BYPASS)
      </button>
    )}
  </div>
);

const SupabaseDataLoader = ({ children, onFinish }: { children: React.ReactNode, onFinish: () => void }) => {
  const { isLoading, logs } = useSupabaseInit();

  useEffect(() => {
    if (!isLoading) onFinish();
  }, [isLoading, onFinish]);

  if (isLoading) {
    return <TacticalLoading logs={logs} />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated, checkSession, loading, loginBypass } = useAuthStore();
  const [logs, setLogs] = useState<string[]>(['Nucleo iniciado.']);
  const [showFailsafe, setShowFailsafe] = useState(false);

  const addLog = (msg: string) => {
    console.log(`[CORAZA] ${msg}`);
    setLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    addLog('Verificando Sesion...');
    
    // Safety check for session
    const timeout = setTimeout(() => {
        if (loading) {
            addLog('⌛ El servidor de sesion no responde. Activando Failsafe...');
            setShowFailsafe(true);
        }
    }, 6000);

    checkSession()
      .then(() => {
        addLog('Sesion verificada.');
        clearTimeout(timeout);
      })
      .catch((err) => {
        addLog('Error en sesion: ' + (err?.message || 'Error Desconocido'));
        clearTimeout(timeout);
      });

    return () => clearTimeout(timeout);
  }, []);

  // Forzar entrada si el usuario decide que tardo demasiado
  const forceStart = () => {
    addLog('🔥 FORZANDO ARRANQUE... Bypass en proceso.');
    loginBypass && loginBypass(); 
  };

  if (loading && !showFailsafe) {
    return <TacticalLoading />;
  }

  if (loading && showFailsafe) {
    return <TacticalLoading onBypass={forceStart} logs={logs} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050A14]">
        <Login />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      {/* LOAD DATA FROM SUPABASE + RUN THE AI ENGINE */}
      <SupabaseDataLoader onFinish={() => addLog('Datos sincronizados.')}>
        <AppContent />
      </SupabaseDataLoader>
    </BrowserRouter>
  );
}

const AppContent = () => {
  useMotorInteligencia(); // Run AI engine in background
  
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="vigilantes" element={<Vigilantes />} />
        <Route path="puestos" element={<Puestos />} />
        <Route path="novedades" element={<Novedades />} />
        <Route path="config" element={<Configuracion />} />
        <Route path="auditoria" element={<Auditoria />} />
        
        <Route path="resumen" element={
          <Suspense fallback={<TacticalLoading />}>
            <Resumen />
          </Suspense>
        } />
        <Route path="resumen/pdf" element={
          <Suspense fallback={<TacticalLoading />}>
            <Resumen />
          </Suspense>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
