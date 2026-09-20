/// <reference types="vitest/config" />
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
  /* Las pruebas van en este mismo archivo y no en uno aparte para que no
     haya dos sitios donde declarar los alias y los plugins. Cuando se
     separan, el que se olvida de actualizar es siempre el de las pruebas, y
     el síntoma es un fallo que no se reproduce al ejecutar la app.

     `happy-dom` y no `jsdom`: arranca en una fracción del tiempo y lo que
     se prueba aquí son hooks y aritmética, no APIs raras del navegador.

     Solo `src/`: `src-tauri/target` tiene miles de archivos y `core/` es
     Rust. Sin acotar, la búsqueda de pruebas tarda más que las pruebas. */
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.prueba.{ts,tsx}'],
    globals: true,
    restoreMocks: true,
  },
});
