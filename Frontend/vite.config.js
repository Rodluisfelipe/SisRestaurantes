import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    sourcemap: false,
    outDir: 'dist',
    rollupOptions: {
      output: {
        /* Nombres sin palabras: los bloqueadores de anuncios cortan archivos
           como "AdminPopups", "SalesTracking" o "pushNotifications", y en ese
           navegador la pantalla nunca carga (en incógnito, sin extensiones,
           sí). El de entrada conserva "index-" porque el rescate de
           index.html lo busca por ese nombre. */
        entryFileNames: 'assets/index-[hash].js',
        chunkFileNames: 'assets/c-[hash].js',
        assetFileNames: 'assets/a-[hash][extname]',
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas'],
        }
      }
    }
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
}))
