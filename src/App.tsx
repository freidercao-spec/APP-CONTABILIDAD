import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useSupabaseInit } from './hooks/useSupabaseInit';
import AppLayout from './components/layout/AppLayout';
import TacticalLoading from './components/shared/TacticalLoading';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loading de módulos tácticos
const Dashboard      = React.lazy(() => import('./pages/Dashboard'));
const GestionPuestos = React.lazy(() => import('./pages/GestionPuestos'));
const Vigilantes     = React.lazy(() => import('./pages/Vigilantes'));
const Puestos        = React.lazy(() => import('./pages/Puestos'));
const Inteligencia   = React.lazy(() => import('./pages/Inteligencia'));
const Login          = React.lazy(() => import('./pages/Login'));

/**
 * LOADER DE DATOS TÁCTICOS
 * Solo se invoca si el usuario está autenticado. Esto evita errores de RLS.
 */
const SupabaseDataLoader = ({ children }: { children: React.ReactNode }) => {
    const { isLoading, logs } = useSupabaseInit();
    const [showFailsafe, setShowFailsafe] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowFailsafe(true), 12000);
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
            <Route path="/gestion-puestos" element={<GestionPuestos />} />
            <Route path="/vigilantes" element={<Vigilantes />} />
            <Route path="/puestos" element={<Puestos />} />
            <Route path="/inteligencia" element={<Inteligencia />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </SupabaseDataLoader>
  );
};

function App() {
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
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
