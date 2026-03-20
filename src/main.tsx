// Core entry point for CORAZA CTA App
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary';

const root = document.getElementById('root');
if (!root) throw new Error('[CORAZA] Elemento #root no encontrado en el DOM.');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
