/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* Una caja se opera de pie y a un brazo de distancia: el cuerpo base es
         más grande que el de una web y los objetivos táctiles no bajan de 44px. */
      fontSize: { base: '16px' },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        /* El color del negocio, que llega del panel y se aplica en tiempo de
           ejecución sobre la variable CSS. Se usa en lo que el cajero mira mil
           veces al día: el botón de cobrar, la selección y los avisos. */
        marca: 'var(--marca)',
        'marca-viva': 'var(--marca-viva)',
        'sobre-marca': 'var(--sobre-marca)',
      },
      height: {
        /* El mínimo táctil. Está nombrado para que nadie vuelva a poner h-8 en
           un botón de la barra "porque se veía más compacto": en un monitor
           táctil descalibrado, 32px es un toque que falla. */
        toque: '2.75rem',
      },
      width: { toque: '2.75rem' },
      minHeight: { toque: '2.75rem' },
      minWidth: { toque: '2.75rem' },
    },
  },
  plugins: [],
};
