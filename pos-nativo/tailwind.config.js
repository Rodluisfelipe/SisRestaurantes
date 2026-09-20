/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* Una caja se opera de pie y a un brazo de distancia: el cuerpo base es
         más grande que el de una web y los objetivos táctiles no bajan de 44px. */
      fontSize: { base: '16px' },
    },
  },
  plugins: [],
};
