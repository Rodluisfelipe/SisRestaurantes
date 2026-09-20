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

         Queda en aviso y no en error porque la regla es léxica, no temporal:
         también señala los usos dentro de un callback, que corren después de
         que la constante existe y son correctos. Esos avisos son ruido; el
         que importa —una constante leída en el cuerpo del componente antes de
         declararse— sale en la misma lista y ese sí rompe. */
      'no-use-before-define': ['warn', { functions: false, classes: true, variables: true }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
