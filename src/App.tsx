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
  const { isAuthenticated, checkSession, loading } = useAuthStore();
  
  const [stuck, setStuck] = React.useState(false);
  const [debugLog, setDebugLog] = React.useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLog(prev => [...prev.slice(-4), msg]);
  };
  
  React.useEffect(() => {
    addLog('Iniciando sesión segura...');
    checkSession().then(() => addLog('Sesión verificada.'));
    
    // Emergency timeout for initial data load
    const timer = setTimeout(() => {
      if (loading || !isAuthenticated) return;
      setStuck(true);
    }, 15000); // 15 seconds
    return () => clearTimeout(timer);
  }, []); // Solo al montar

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050A14] flex flex-col items-center justify-center">
        <TacticalLoading />
        <div className="mt-8 text-[10px] font-mono text-primary/40 uppercase tracking-widest px-10 text-center">
          {debugLog.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
        </div>
      </div>
    );
  }
  
  if (stuck && isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050A14] flex flex-col items-center justify-center p-8 space-y-6">
        <div className="p-10 bg-danger/10 border border-danger/30 rounded-[40px] text-center max-w-lg">
          <span className="material-symbols-outlined text-danger text-5xl mb-4">report</span>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">Error de Sincronización</h2>
          <p className="text-slate-400 font-bold mt-4">
            El sistema no pudo completar la conexión con la base de datos de Coraza.
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 h-12 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl uppercase tracking-widest text-[11px] transition-all"
            >
              Cerrar y Reintentar
            </button>
            <button 
              onClick={() => { useAuthStore.getState().logout(); window.location.reload(); }}
              className="px-8 h-12 bg-danger text-white font-black rounded-2xl uppercase tracking-widest text-[11px] transition-all hover:scale-105"
            >
              Resetear Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <div className="fixed bottom-4 left-4 text-[9px] font-mono text-slate-500 uppercase">
          Status: Ready · DB: {import.meta.env.VITE_SUPABASE_URL ? 'Connected' : 'Missing Config'}
        </div>
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
