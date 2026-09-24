import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      /* Usar un `const` antes de declararlo revienta en tiempo de ejecución con
         "Cannot access X before initialization", y no se ve al leer el código:
         una constante puesta seis líneas más abajo de donde se usa parece
         correcta. Pasó de verdad en la ficha de producto y dejó el menú sin
         abrir para todo el que tocara un producto.

         `functions: false` porque las declaraciones de función sí se elevan y
         llamarlas antes es idiomático en React.

         Costó dos caídas del menú en producción. La segunda fue la peligrosa:
         la constante se leía en la **lista de dependencias** de un efecto, que
         se evalúa en cada render y no cuando el efecto corre. Al leer el
         código parecía estar dentro del callback.

         Queda en aviso porque la regla es léxica y no temporal: también señala
         los usos del cuerpo de un callback, que sí son correctos, y hoy hay
         96 así en el repositorio. Ponerla en error obligaría a tocarlos todos.

         Dónde mirar cuando aparezca: si la línea señalada es una lista de
         dependencias —`}, [algo]);`— **eso revienta**. Si está dentro del
         cuerpo de una función, no. La diferencia es cuándo se evalúa. */
      'no-use-before-define': ['warn', { functions: false, classes: true, variables: true }],
      /* El sistema de diseño (tailwind.config.js). Letra de menos de 11 px no
         se lee en un celular, y el menú llegó a tener más de 1.000 textos de
         8 a 10 px. En aviso y no en error porque todavía quedan en pantallas
         del panel sin migrar; que no entren nuevos. Usar `text-2xs` (11 px) o
         la escala normal de Tailwind. */
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/text-.(8|9|10)(.5)?px/]',
          message: 'Letra de menos de 11 px no se lee en un celular: usa text-2xs o text-xs.',
        },
        {
          selector: 'TemplateElement[value.raw=/text-.(8|9|10)(.5)?px/]',
          message: 'Letra de menos de 11 px no se lee en un celular: usa text-2xs o text-xs.',
        },
      ],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
