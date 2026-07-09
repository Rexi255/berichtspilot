// ESLint-Flat-Config: Renderer (Browser/JSX) und Electron-Main (Node/CommonJS)
// werden getrennt behandelt. `npm run lint` läuft auch in der CI.
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'release/**', 'node_modules/**'] },

  js.configs.recommended,

  // Renderer: React im Browser-Kontext (Vite)
  {
    files: ['src/**/*.{js,jsx}', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      // markiert in JSX benutzte Komponenten/Variablen als „verwendet"
      'react/jsx-uses-vars': 'error',
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },

  // Node-Kontext: Electron-Main/Preload (CommonJS) + Vite-Config
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
]
