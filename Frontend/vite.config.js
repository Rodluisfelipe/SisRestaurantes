import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false // Desactivar el overlay de errores por defecto
    }
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      external: ['jspdf'],
      output: {
        globals: {
          jspdf: 'jspdf'
        }
      }
    }
  }
})
