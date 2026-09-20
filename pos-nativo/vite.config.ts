import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* El puerto es fijo y distinto al de MenuBy (5173): las dos cosas se
   desarrollan al tiempo y Tauri necesita saber a dónde apuntar. */
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5174, strictPort: true },
  /* El webview de Tauri no es Chrome de hoy: en Windows es WebView2 (al día) y
     en Linux WebKitGTK, que va atrás. Se compila a un target conservador para
     no descubrir en el mostrador del cliente que una sintaxis no existe. */
  build: { target: 'es2020', minify: 'esbuild', sourcemap: false },
});
