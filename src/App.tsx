// CORAZA CTA — Tactical Logic Core v1.5.0

import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useSupabaseInit } from './hooks/useSupabaseInit';
import { useMotorInteligencia } from './store/useMotorInteligencia';
import Login from './pages/Login';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';

// ─── LAZY PAGES ───────────────────────────────────────────────────────────────
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Vigilantes    = lazy(() => import('./pages/Vigilantes'));
const MapaPuestos   = lazy(() => import('./pages/Puestos'));
const GestionPuestos = lazy(() => import('./pages/GestionPuestos'));
const Inteligencia  = lazy(() => import('./pages/Inteligencia'));
const Novedades     = lazy(() => import('./pages/Novedades'));
const Resumen       = lazy(() => import('./pages/Resumen'));
const Auditoria     = lazy(() => import('./pages/AuditoriaInterna'));
const Configuracion = lazy(() => import('./pages/Configuracion'));

// ─── PAGE LOADER ──────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
    <div className="relative size-14">
      <div className="absolute inset-0 border-4 border-primary/10 rounded-full" />
      <div className="absolute inset-0 border-4 border-t-primary border-r-primary/40 rounded-full animate-spin" />
      <div className="absolute inset-2 border-4 border-b-indigo-400/60 border-l-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
      Cargando módulo...
    </p>
  </div>
);

// ─── TACTICAL LOADING (FULLSCREEN) ────────────────────────────────────────────
const TacticalLoading = ({ onBypass, logs }: { onBypass?: () => void; logs?: string[] }) => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#050A14] text-white p-6 overflow-hidden z-50">
    {/* Fondo táctico */}
    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_#4318FF_0%,_transparent_60%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

    <div className="relative mb-8">
      <div className="absolute -inset-4 border border-primary/20 rounded-full animate-ping opacity-30" />
      <div className="size-20 rounded-2xl border-2 border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(67,24,255,0.25)] bg-primary/5">
        <div className="size-12 border-4 border-primary rounded-full border-t-transparent animate-spin" />
      </div>
      <div className="absolute -top-1 -right-1 size-3.5 bg-emerald-400 rounded-full animate-ping shadow-[0_0_8px_#10b981]" />
    </div>

    <div className="text-center space-y-2 relative z-10 max-w-xs">
      <h2 className="text-lg font-black tracking-[0.25em] uppercase text-white">CUADRO OPERATIVO</h2>
      <p className="text-[10px] font-bold text-primary/70 uppercase tracking-[0.3em]">Sincronizando con Servidores Coraza</p>

      {logs && logs.length > 0 && (
        <div className="mt-5 p-3 bg-black/40 border border-white/10 rounded-xl text-left font-mono text-[9px] text-slate-400 space-y-1 max-h-28 overflow-y-auto w-full">
          {logs.slice(-5).map((log, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-primary/60 shrink-0">[SYS]</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="flex gap-3 mt-10">
      {onBypass && (
        <button
          onClick={onBypass}
          className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all hover:scale-105 active:scale-95"
        >
          ⚠ BYPASS
        </button>
      )}
      
      <button
        onClick={() => {
          localStorage.clear();
          window.location.reload();
        }}
        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all hover:scale-105 active:scale-95"
      >
        REINTENTAR / SALIR
      </button>
    </div>
  </div>
);

// ─── DATA LOADER (POST AUTH) ──────────────────────────────────────────────────
const SupabaseDataLoader = ({ children, onFinish }: { children: React.ReactNode; onFinish: () => void }) => {
  const { isLoading, logs } = useSupabaseInit();

  useEffect(() => {
    if (!isLoading) onFinish();
  }, [isLoading, onFinish]);

  if (isLoading) return <TacticalLoading logs={logs} />;
  return <>{children}</>;
};

// ─── ANIMATED OUTLET WRAPPER ──────────────────────────────────────────────────
const AnimatedPage = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
  <div
    key={location.pathname}
    style={{
      animation: 'pageEnter 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
    }}
  >
    {children}
  </div>
  );
};

// ─── APP CONTENT (ROUTES) ─────────────────────────────────────────────────────
const AppContent = () => {
  useMotorInteligencia();
  const location = useLocation();

  return (
    <Routes location={location}>
      <Route path="/" element={<AppLayout />}>
        <Route index                element={<Suspense fallback={<PageLoader />}><AnimatedPage><Dashboard /></AnimatedPage></Suspense>} />
        <Route path="dashboard"     element={<Suspense fallback={<PageLoader />}><AnimatedPage><Dashboard /></AnimatedPage></Suspense>} />
        <Route path="vigilantes"    element={<Suspense fallback={<PageLoader />}><AnimatedPage><Vigilantes /></AnimatedPage></Suspense>} />
        <Route path="disponibles"   element={<Suspense fallback={<PageLoader />}><AnimatedPage><Vigilantes defaultTab="reserva" /></AnimatedPage></Suspense>} />
        <Route path="puestos"       element={<Suspense fallback={<PageLoader />}><AnimatedPage><MapaPuestos /></AnimatedPage></Suspense>} />
        <Route path="gestion-puestos" element={<Suspense fallback={<PageLoader />}><AnimatedPage><GestionPuestos /></AnimatedPage></Suspense>} />
        <Route path="inteligencia"  element={<Suspense fallback={<PageLoader />}><AnimatedPage><Inteligencia /></AnimatedPage></Suspense>} />
        <Route path="novedades"     element={<Suspense fallback={<PageLoader />}><AnimatedPage><Novedades /></AnimatedPage></Suspense>} />
        <Route path="configuracion" element={<Suspense fallback={<PageLoader />}><AnimatedPage><Configuracion /></AnimatedPage></Suspense>} />
        <Route path="config"        element={<Navigate to="/configuracion" replace />} />
        <Route path="auditoria"     element={<Suspense fallback={<PageLoader />}><AnimatedPage><Auditoria /></AnimatedPage></Suspense>} />
        <Route path="resumen"       element={<Suspense fallback={<PageLoader />}><AnimatedPage><Resumen /></AnimatedPage></Suspense>} />
        <Route path="resumen/pdf"   element={<Suspense fallback={<PageLoader />}><AnimatedPage><Resumen /></AnimatedPage></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function AppInner() {
  const { isAuthenticated, checkSession, loading, loginBypass } = useAuthStore();
  const [logs, setLogs] = useState<string[]>(['Nucleo iniciado.']);
  const [showFailsafe, setShowFailsafe] = useState(false);
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
    }, 6000);

    checkSession()
      .then(() => { addLog('Sesión verificada.'); clearTimeout(timeout); })
      .catch((err) => { addLog('Error: ' + (err?.message || 'Desconocido')); clearTimeout(timeout); });

    return () => clearTimeout(timeout);
  }, []);

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

  // Sistema cargando sesión
  if (loading && !showFailsafe) return <TacticalLoading />;
  if (loading && showFailsafe) return <TacticalLoading onBypass={forceStart} logs={logs} />;

  // No autenticado → Login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Login />
      </div>
    );
  }

  // Autenticado → Cargar datos + Rutas
  return (
    <SupabaseDataLoader onFinish={handleSyncFinish}>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </SupabaseDataLoader>
  );
}

// BrowserRouter envuelve TODO — crítico para que useLocation/useNavigate
// funcione en cualquier hijo del árbol
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
