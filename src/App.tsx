import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import { useAuthStore } from './store/authStore';
import { useMotorInteligencia } from './store/useMotorInteligencia';
import { useSupabaseInit } from './hooks/useSupabaseInit';

// Optimized Lazy Loading for all pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Vigilantes = lazy(() => import('./pages/Vigilantes'));
const Puestos = lazy(() => import('./pages/Puestos'));
const Inteligencia = lazy(() => import('./pages/Inteligencia'));
const Novedades = lazy(() => import('./pages/Novedades'));
const Resumen = lazy(() => import('./pages/Resumen'));
const AuditoriaInterna = lazy(() => import('./pages/AuditoriaInterna'));
const GestionPuestos = lazy(() => import('./pages/GestionPuestos'));

const TacticalLoading = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
    <div className="relative size-20">
      <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
      <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-xl">security</span>
      </div>
    </div>
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] animate-pulse">Sincronizando con Servidores Coraza</span>
      <div className="w-32 h-1 bg-slate-100 rounded-full mt-4 overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 bg-primary animate-[translate_2s_infinite_linear]" style={{ width: '40%' }}></div>
      </div>
    </div>
  </div>
);

// Component to run the AI engine only when authenticated
const InteligenciaEngine = () => {
  useMotorInteligencia();
  return null;
};

// Component to load data from Supabase
const SupabaseDataLoader = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useSupabaseInit();

  if (isLoading) {
    return <TacticalLoading />;
  }

  return <>{children}</>;
};

function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  
  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <Toaster position="bottom-right" />
      </>
    );
  }

  return (
    <BrowserRouter>
      {/* LOAD DATA FROM SUPABASE + RUN THE AI ENGINE */}
      <SupabaseDataLoader>
      <InteligenciaEngine />
      
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={
            <Suspense fallback={<TacticalLoading />}>
              <Dashboard />
            </Suspense>
          } />
          <Route path="vigilantes" element={
            <Suspense fallback={<TacticalLoading />}>
              <Vigilantes />
            </Suspense>
          } />
          <Route path="disponibles" element={
            <Suspense fallback={<TacticalLoading />}>
              <Vigilantes defaultTab="reserva" />
            </Suspense>
          } />
          <Route path="puestos" element={
            <Suspense fallback={<TacticalLoading />}>
              <Puestos />
            </Suspense>
          } />
          <Route path="inteligencia" element={
            <Suspense fallback={<TacticalLoading />}>
              <Inteligencia />
            </Suspense>
          } />
          <Route path="novedades" element={
            <Suspense fallback={<TacticalLoading />}>
              <Novedades />
            </Suspense>
          } />
          <Route path="configuracion" element={
            <Suspense fallback={<TacticalLoading />}>
              <Configuracion />
            </Suspense>
          } />
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
          <Route path="auditoria" element={
            <Suspense fallback={<TacticalLoading />}>
              <AuditoriaInterna />
            </Suspense>
          } />
          <Route path="gestion-puestos" element={
            <Suspense fallback={<TacticalLoading />}>
              <GestionPuestos />
            </Suspense>
          } />
        </Route>
      </Routes>
      </SupabaseDataLoader>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(45, 39, 255, 0.3)',
            borderRadius: '24px',
            color: '#fff',
            padding: '18px 28px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 40px rgba(45, 39, 255, 0.1)',
            minWidth: '380px',
          },
          success: {
            iconTheme: {
              primary: '#00b377',
              secondary: '#fff',
            },
            style: {
              borderColor: 'rgba(0, 179, 119, 0.4)',
              boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 30px rgba(0, 179, 119, 0.15)',
            }
          },
          error: {
            iconTheme: {
              primary: '#ff4d4d',
              secondary: '#fff',
            },
            style: {
              borderColor: 'rgba(255, 77, 77, 0.4)',
              boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 30px rgba(255, 77, 77, 0.15)',
            }
          },
          loading: {
            style: {
              borderColor: 'rgba(45, 39, 255, 0.4)',
            }
          }
        }}
      />
    </BrowserRouter>
  );
}

export default App;
