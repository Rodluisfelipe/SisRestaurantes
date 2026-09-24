/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        geist: ['Geist', 'system-ui', 'sans-serif'],
        'geist-mono': ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      screens: {
        'xs': '480px',
      },
      /* ── El sistema de diseño ─────────────────────────────────────────
         Los nombres se apoyan en las variables que emite `menuCssVars`
         (utils/menuTokens.js) en la raíz del menú: el color del negocio, su
         versión suave y el texto que contrasta, ya calculados. Cada uno trae
         un respaldo para las pantallas que no cuelgan del menú.

         Regla: en código nuevo, estos nombres y no hexadecimales sueltos. Hoy
         hay 223 colores distintos escritos a mano; así fue como se perdió la
         coherencia. */
      colors: {
        marca: {
          DEFAULT: 'var(--mb-accent, #2563eb)',
          suave: 'var(--mb-accent-soft, #eff6ff)',
          fuerte: 'var(--mb-accent-strong, #1d4ed8)',
        },
        'sobre-marca': 'var(--mb-on-accent, #ffffff)',
        tinta: {
          DEFAULT: 'var(--mb-ink, #0f172a)',
          2: 'var(--mb-ink-2, #64748b)',
          3: 'var(--mb-ink-3, #94a3b8)',
        },
        superficie: {
          DEFAULT: 'var(--mb-surface, #f9fafb)',
          2: 'var(--mb-surface-2, #f1f5f9)',
          tarjeta: 'var(--mb-card, #ffffff)',
        },
        linea: 'var(--mb-line, #e2e8f0)',
        /* Con significado fijo, sea cual sea la marca: verde confirma, rojo
           cancela, ámbar avisa. Una marca roja no puede volver rojo el botón
           de pagar. */
        accion: '#047857',
        exito: '#059669',
        aviso: '#b45309',
        peligro: '#dc2626',

        /* Las paletas fijas de cada producto, que antes se repetían a mano en
           cada pantalla como `bg-[#e8002d]`. */
        // MenuBy como marca: landing, ingreso y registro.
        menuby: {
          DEFAULT: '#e8002d',
          fuerte: '#a80020',
          suave: '#fbeee9',
          crema: '#fbfaf8',
          tinta: '#17120f',
          gris: '#6e655c',
          borde: '#efeae3',
        },
        // Pantallas de la plataforma: pago de la suscripción, resultados, 404.
        plataforma: {
          azul: '#3a7aff',
          tinta: '#1f2937',
          gris: '#6c7a92',
          borde: '#dce4f5',
          fondo: '#f4f6fb',
        },
        // La bandeja de WhatsApp se ve como WhatsApp, a propósito.
        wa: {
          verde: '#00a884',
          tinta: '#111b21',
          gris: '#54656f',
          'gris-2': '#667781',
          linea: '#e9edef',
          fondo: '#f0f2f5',
        },
        // MenuBy Crew.
        crew: {
          noche: '#0a0a14',
        },
      },
      /* La escala de letra. `2xs` (11 px) es el mínimo: por debajo no se lee
         en un celular, y el menú tenía más de 1.000 textos de 8 a 10 px. */
      fontSize: {
        '2xs': ['11px', { lineHeight: '14px' }],
      },
      borderRadius: {
        tarjeta: 'var(--mb-radius-card, 20px)',
        boton: 'var(--mb-radius-btn, 14px)',
        hoja: 'var(--mb-radius-sheet, 24px)',
      },
      boxShadow: {
        tarjeta: 'var(--mb-shadow-card, 0 8px 24px rgba(15, 23, 42, 0.08))',
        flotante: '0 10px 30px rgba(15, 23, 42, 0.14)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        /* "Entró al carrito": el círculo crece un poco de más y vuelve. En CSS
           corre en la GPU; con framer-motion costaba procesador en cada tarjeta. */
        agregado: {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '60%': { opacity: '1', transform: 'scale(1.15)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        aparecer: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // El check de "pedido confirmado" se dibuja de un trazo.
        trazo: {
          '0%': { strokeDashoffset: '48' },
          '100%': { strokeDashoffset: '0' },
        },
        subir: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // La barra de "abriendo WhatsApp en…" se vacía.
        vaciar: {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
      },
      animation: {
        agregado: 'agregado 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        aparecer: 'aparecer 180ms ease-out both',
        trazo: 'trazo 450ms 350ms ease-out both',
        subir: 'subir 420ms ease-out both',
        vaciar: 'vaciar 4s linear forwards',
      },
    },
  },
  plugins: [],
} 