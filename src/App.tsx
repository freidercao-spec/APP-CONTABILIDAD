// CORAZA CTA — Tactical Logic Core v1.6.0

import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useSupabaseInit } from './hooks/useSupabaseInit';
import Login from './pages/Login';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';

// ─── LAZY PAGES ───────────────────────────────────────────────────────────────
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const Vigilantes      = lazy(() => import('./pages/Vigilantes'));
const MapaPuestos     = lazy(() => import('./pages/Puestos'));
const GestionPuestos  = lazy(() => import('./pages/GestionPuestos'));
const Inteligencia    = lazy(() => import('./pages/Inteligencia'));
const Novedades       = lazy(() => import('./pages/Novedades'));
const Configuracion   = lazy(() => import('./pages/Configuracion'));
const Auditoria       = lazy(() => import('./pages/AuditoriaInterna'));
const Resumen         = lazy(() => import('./pages/Resumen'));

// ─── LOADING COMPONENT ────────────────────────────────────────────────────────
const TacticalLoading = ({ onBypass, logs = [] }: { onBypass?: () => void; logs?: string[] }) => (
  <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[9999] p-6">
    <div className="relative mb-12">
      <div className="w-24 h-24 border-2 border-[#4f46e5]/20 rounded-full animate-spin-slow" />
      <div className="absolute inset-0 w-24 h-24 border-t-2 border-[#4f46e5] rounded-full animate-spin" />
      <div className="absolute inset-4 bg-[#4f46e5]/10 rounded-full animate-pulse flex items-center justify-center">
        <span className="material-symbols-outlined text-[#4f46e5] text-3xl">radar</span>
      </div>
    </div>

    <div className="text-center space-y-4 max-w-md w-full">
      <h2 className="text-2xl font-black text-white tracking-widest uppercase animate-pulse">Sincronizando</h2>
      <p className="text-slate-400 text-sm font-medium tracking-wide">Cargando DNA Operativo y Protocolos...</p>
      
      <div className="bg-slate-900/50 rounded-xl border border-white/5 p-4 h-48 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-[#4f46e5]/20 animate-scanline" />
        <div className="flex flex-col gap-1 text-left font-mono text-[10px]">
          {logs.slice(-10).map((log, i) => (
            <div key={i} className="text-slate-500 flex gap-2">
              <span className="text-[#4f46e5] opacity-50">[{new Date().toLocaleTimeString()}]</span>
              <span className={i === logs.slice(-10).length - 1 ? 'text-[#4f46e5]' : ''}>{log}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-slate-600 italic">Iniciando terminal...</div>}
        </div>
      </div>

      {onBypass && (
        <button 
          onClick={onBypass}
          className="text-[10px] text-slate-600 hover:text-danger uppercase font-black tracking-widest mt-4 transition-colors"
        >
          Protocolo de Emergencia
        </button>
      )}
    </div>
  </div>
);

// ─── DATA LOADER ──────────────────────────────────────────────────────────────
const SupabaseDataLoader = ({ children, onFinish }: { children: React.ReactNode, onFinish: () => void }) => {
  const { isLoading, logs } = useSupabaseInit();
  
  useEffect(() => {
    if (!isLoading) {
      onFinish();
    }
  }, [isLoading, onFinish]);

  if (isLoading) {
    return <TacticalLoading logs={logs} />;
  }

  return <>{children}</>;
};

// ─── ROUTES CONTENT ───────────────────────────────────────────────────────────
const AppContent = () => (
  <Routes>
    <Route path="/" element={<AppLayout />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Suspense fallback={<TacticalLoading />}><Dashboard /></Suspense>} />
      <Route path="vigilantes" element={<Suspense fallback={<TacticalLoading />}><Vigilantes /></Suspense>} />
      <Route path="puestos" element={<Suspense fallback={<TacticalLoading />}><MapaPuestos /></Suspense>} />
      <Route path="gestion-puestos" element={<Suspense fallback={<TacticalLoading />}><GestionPuestos /></Suspense>} />
      <Route path="inteligencia" element={<Suspense fallback={<TacticalLoading />}><Inteligencia /></Suspense>} />
      <Route path="novedades" element={<Suspense fallback={<TacticalLoading />}><Novedades /></Suspense>} />
      <Route path="configuracion" element={<Suspense fallback={<TacticalLoading />}><Configuracion /></Suspense>} />
      <Route path="auditoria" element={<Suspense fallback={<TacticalLoading />}><Auditoria /></Suspense>} />
      <Route path="resumen" element={<Suspense fallback={<TacticalLoading />}><Resumen /></Suspense>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function AppInner() {
  const { isAuthenticated, checkSession, loading, loginBypass } = useAuthStore();
  const [logs, setLogs] = useState<string[]>(['Núcleo iniciado.']);
  const [showFailsafe, setShowFailsafe] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [syncDone, setSyncDone] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-40), msg]);
  }, []);

  const handleSyncFinish = useCallback(() => {
    setSyncDone(true);
    addLog('Datos sincronizados con éxito.');
  }, [addLog]);

  useEffect(() => {
    addLog('Verificando sesión...');
    const timeout = setTimeout(() => {
      if (loading) {
        addLog('⌛ Servidor no responde. Activando Failsafe...');
        setShowFailsafe(true);
      }
    }, 8000);

    checkSession()
      .then(() => { 
        addLog('Sesión verificada.'); 
        clearTimeout(timeout); 
      })
      .catch((err) => { 
        addLog('Error: ' + (err?.message || 'Desconocido')); 
        clearTimeout(timeout); 
      });

    return () => clearTimeout(timeout);
  }, [checkSession, loading, addLog]);

  const forceStart = () => {
    const code = prompt('Código de emergencia:');
    const emergencyCode = import.meta.env.VITE_BYPASS_CODE || 'CORAZA-SOPORTE';
    if (code === emergencyCode) {
      addLog('🔥 Bypass autorizado.');
      loginBypass?.();
    } else {
      addLog('❌ Código incorrecto. Acceso denegado.');
    }
  };

  if (loading && !showFailsafe) return <TacticalLoading />;
  if (loading && showFailsafe) return <TacticalLoading onBypass={forceStart} logs={logs} />;

  if (!isAuthenticated) return <Login />;

  return (
    <SupabaseDataLoader onFinish={handleSyncFinish}>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </SupabaseDataLoader>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0b1437',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            fontSize: '12px',
            fontWeight: '700',
          },
        }}
      />
      <AppInner />
    </BrowserRouter>
  );
}

export default App;
