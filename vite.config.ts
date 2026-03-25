import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Optimized chunking for faster initial load
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor core - always cached
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase isolated
          'vendor-supabase': ['@supabase/supabase-js'],
          // State management
          'vendor-zustand': ['zustand'],
          // Map libraries (heavy, kept separate)
          'vendor-maps': ['leaflet', 'react-leaflet', 'maplibre-gl'],
          // PDF generation (large, lazy loaded)
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // OpenAI / AI SDK
          'vendor-ai': ['openai'],
          // Toast notifications
          'vendor-ui': ['react-hot-toast'],
        },
      },
    },
    // Increase chunk warning limit slightly for map libraries
    chunkSizeWarningLimit: 800,
    // Enable minification optimizations
    minify: 'esbuild',
    // Target modern browsers for smaller output
    target: 'es2020',
    // Source maps for production debugging (can be disabled for privacy)
    sourcemap: false,
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'zustand',
      'react-hot-toast',
    ],
    // Exclude heavy/optional packages from pre-bundling
    exclude: ['leaflet', 'maplibre-gl', 'jspdf', 'openai'],
  },
  // Resolve aliases for browser compatibility
  resolve: {
    alias: {
      'child_process': path.resolve(__dirname, './src/lib/node-empty.ts')
    }
  },
  // Performance hints
  esbuild: {
    // Remove console.log in production for smaller bundle and better perf
    drop: ['debugger'],
    // Trim whitespace in production
    legalComments: 'none',
  },
})
