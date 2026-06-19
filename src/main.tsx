// Core entry point for CORAZA CTA App
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary';

// Global Error Handler for early boot issues
window.onerror = (msg, url, line, col, error) => {
  console.error('[CORAZA FATAL]', { msg, url, line, col, error });
  return false;
};

console.log('[CORAZA] 🚀 Iniciando Nucleo del Sistema...');

// Handle Vite dynamic import failures (common after new deployments)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[CORAZA] Error de precarga detectado. Reiniciando núcleo...', event);
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  const msg = '[CORAZA] ❌ Elemento #root no encontrado en el DOM.';
  console.error(msg);
  document.body.innerHTML = `<div style="padding:20px;color:red;font-family:sans-serif;">${msg}</div>`;
  throw new Error(msg);
}

try {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
  console.log('[CORAZA] ✅ Renderizado inicial completado.');
} catch (err) {
  console.error('[CORAZA] ❌ Error durante el renderizado inicial:', err);
}

