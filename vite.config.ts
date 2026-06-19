import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Shims for certain libraries that might still look for node types/modules
      'path': './src/shims/node-empty.js',
      'fs': './src/shims/node-empty.js',
      'url': './src/shims/node-empty.js',
      'child_process': './src/shims/node-empty.js',
      'http': './src/shims/node-empty.js',
      'https': './src/shims/node-empty.js',
      'util': './src/shims/node-empty.js',
      'zlib': './src/shims/node-empty.js',
      'stream': './src/shims/node-empty.js',
    }
  },
  build: {
    chunkSizeWarningLimit: 2000,
    minify: 'esbuild',
    sourcemap: false,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          zustand: ['zustand'],
          pdf: ['jspdf', 'jspdf-autotable'],
          maps: ['maplibre-gl', '@deck.gl/react', '@deck.gl/layers', 'deck.gl'],
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'jspdf',
      'jspdf-autotable',
      'deck.gl',
      '@deck.gl/react',
      '@deck.gl/layers',
      'maplibre-gl'
    ]
  }
})
