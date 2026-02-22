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
        manualChunks(id) {
          // Function-based chunking avoids circular-dependency TDZ errors
          // that array-based manualChunks causes with framer-motion
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router') ||
                id.includes('/react/') || id.includes('react/jsx')) {
              return 'vendor-react';
            }
            if (id.includes('@sentry')) {
              return 'vendor-sentry';
            }
            // Let framer-motion stay in the default shared chunk
            // so Rollup resolves initialization order automatically
          }
        }
      }
    }
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
}))
