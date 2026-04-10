import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useProgramacionStore } from './store/programacionStore';
import { useSupabaseInit } from './hooks/useSupabaseInit';
import AppLayout from './components/layout/AppLayout';
import TacticalLoading from './components/shared/TacticalLoading';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loading de módulos tácticos
const Dashboard       = React.lazy(() => import('./pages/Dashboard'));
const GestionPuestos  = React.lazy(() => import('./pages/GestionPuestos'));
const Vigilantes      = React.lazy(() => import('./pages/Vigilantes'));
const Puestos         = React.lazy(() => import('./pages/Puestos'));
const Inteligencia    = React.lazy(() => import('./pages/Inteligencia'));
const Login           = React.lazy(() => import('./pages/Login'));
const Novedades       = React.lazy(() => import('./pages/Novedades'));
const Resumen         = React.lazy(() => import('./pages/Resumen'));
const Auditoria       = React.lazy(() => import('./pages/AuditoriaInterna'));
const Configuracion   = React.lazy(() => import('./pages/Configuracion'));

/**
 * LOADER DE DATOS TÁCTICOS
 * Solo se invoca si el usuario está autenticado.
 */
const SupabaseDataLoader = ({ children }: { children: React.ReactNode }) => {
    const { isLoading, logs } = useSupabaseInit();
    const [showFailsafe, setShowFailsafe] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowFailsafe(true), 15000);
        return () => clearTimeout(timer);
    }, []);

    const forceStart = () => {
        const code = prompt('CÓDIGO DE BYPASS TÁCTICO:');
        if (code === 'CORAZA-FIX') {
            window.location.reload();
        }
    };

    if (isLoading && !showFailsafe) {
        return <TacticalLoading logs={logs} />;
    }

    if (isLoading && showFailsafe) {
        return <TacticalLoading onBypass={forceStart} logs={logs} />;
    }

    return <>{children}</>;
};

/**
 * GESTIÓN DE RUTAS Y ACCESO
 */
const AppRouter = () => {
  const { isAuthenticated, checkSession, loading: authLoading } = useAuthStore();
  
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (authLoading) return <TacticalLoading logs={['Autenticando...', 'Validando terminal...']} />;

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<TacticalLoading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <SupabaseDataLoader>
      <AppLayout>
        <Suspense fallback={<TacticalLoading logs={['Abriendo módulo...', 'Preparando interfaz...']} />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            
            {/* Cuadro Operativo */}
            <Route path="/vigilantes" element={<Vigilantes />} />
            <Route path="/disponibles" element={<Vigilantes defaultTab="reserva" />} />
            <Route path="/puestos" element={<Puestos />} />
            <Route path="/gestion-puestos" element={<GestionPuestos />} />
            <Route path="/resumen" element={<Resumen />} />
            
            {/* Inteligencia */}
            <Route path="/inteligencia" element={<Inteligencia />} />
            <Route path="/novedades" element={<Novedades />} />
            
            {/* Control Central */}
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/auditoria" element={<Auditoria />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </SupabaseDataLoader>
  );
};

/**
 * INDICADOR DE SINCRONIZACIÓN GLOBAL
 */
const SyncStatusBar = () => {
    const isSyncing = useProgramacionStore(s => s.isSyncing);
    if (!isSyncing) return null;
    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 bg-indigo-600 px-5 py-3 rounded-2xl shadow-[0_15px_40px_rgba(79,70,229,0.5)] border border-white/20 animate-pulse">
            <div className="size-2 bg-white rounded-full animate-ping" />
            <span className="material-symbols-outlined text-white animate-spin text-[18px]">sync</span>
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">Sincronizando Cambios...</span>
        </div>
    );
};

function App() {
  const isSyncing = useProgramacionStore(s => s.isSyncing);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasPending = useProgramacionStore.getState().hasPendingChanges();
      if (isSyncing || hasPending) {
        e.preventDefault();
        e.returnValue = '¡AVISO DE CORAZA! Hay cambios tácticos aún en proceso de guardado. Si cierra ahora, podría perder los últimos movimientos del tablero. ¿Seguro que desea salir?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSyncing]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#040810',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '16px 24px',
              fontSize: '12px',
              fontWeight: '700',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            },
          }}
        />
        <AppRouter />
        <SyncStatusBar />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
